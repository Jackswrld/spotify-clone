import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { Track } from '../models';
import { lyricsTitle } from '../title';

export type MatchFound = { videoId: string; title: string; channel: string };
export type MatchMissing = { videoId: null; reason: 'no-match' | 'quota' | 'no-key' | 'offline' | 'busy' | 'server' };
export type MatchResult = MatchFound | MatchMissing;

/** Asks the relay which YouTube video is the official version of a catalog song. */
@Injectable({ providedIn: 'root' })
export class YouTubeMatchApi {
  private readonly http = inject(HttpClient);
  /** Per-session memory of answers that won't change soon (a video, or "no match"). */
  private readonly known = new Map<string, MatchResult>();

  match(track: Track): Observable<MatchResult> {
    const hit = this.known.get(track.id);
    if (hit) return of(hit);

    let params = new HttpParams().set('artist', track.artistName).set('title', lyricsTitle(track));
    if (track.duration > 0) params = params.set('duration', String(Math.round(track.duration)));

    return this.http
      .get<{ videoId: string | null; title?: string; channel?: string; reason?: MatchMissing['reason'] }>(
        '/api/youtube/match',
        { params },
      )
      .pipe(
        map((r): MatchResult =>
          r.videoId
            ? { videoId: r.videoId, title: r.title ?? '', channel: r.channel ?? '' }
            : { videoId: null, reason: r.reason ?? 'no-match' },
        ),
        catchError((err: unknown) => {
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          // 0 = no answer at all (offline); 429 = the relay's per-minute limit; anything else = a server problem.
          const reason = status === 0 ? 'offline' : status === 429 ? 'busy' : 'server';
          return of<MatchResult>({ videoId: null, reason });
        }),
        tap((result) => {
          const keep = result.videoId !== null || result.reason === 'no-match';
          if (keep) this.known.set(track.id, result);
        }),
      );
  }

  /** A match already known this session, without asking the relay (never spends a search). */
  cached(trackId: string): MatchFound | null {
    const hit = this.known.get(trackId);
    return hit && hit.videoId ? hit : null;
  }

  /** Forget a match (e.g. the video was removed or blocked from embedding). */
  forget(trackId: string): void {
    this.known.delete(trackId);
  }
}
