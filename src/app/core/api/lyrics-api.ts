import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError, timer } from 'rxjs';
import { APP_CONFIG } from '../config';
import { Lyrics } from '../models';
import { parseLrc } from './lrc-parser';

const LRCLIB_GET = 'https://lrclib.net/api/get';

interface LrclibRecord {
  plainLyrics: string | null;
  syncedLyrics: string | null;
  instrumental: boolean;
}

/** Lyrics from LRCLIB (free, no key). */
@Injectable({ providedIn: 'root' })
export class LyricsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  /** Null when LRCLIB has no lyrics for the song (or is rate limiting twice in a row). */
  get(artist: string, title: string, durationSec: number): Observable<Lyrics | null> {
    return this.request(artist, title, durationSec).pipe(
      catchError((err: unknown) => {
        if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
        if (err.status === 404) return of(null);
        if (err.status === 429) {
          // Wait Retry-After plus up to 30% jitter, as LRCLIB asks, then try once more.
          const seconds = Number(err.headers.get('Retry-After')) || 1;
          const wait = seconds * 1000 * (1 + Math.random() * 0.3);
          return timer(wait).pipe(
            switchMap(() => this.request(artist, title, durationSec)),
            catchError((again: unknown) =>
              again instanceof HttpErrorResponse && (again.status === 404 || again.status === 429)
                ? of(null)
                : throwError(() => again),
            ),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  private request(artist: string, title: string, durationSec: number): Observable<Lyrics> {
    let params = new HttpParams().set('artist_name', artist).set('track_name', title);
    if (durationSec > 0) params = params.set('duration', String(Math.round(durationSec)));
    const headers = new HttpHeaders({ 'Lrclib-Client': this.config.lrclibClient });
    return this.http.get<LrclibRecord>(LRCLIB_GET, { params, headers }).pipe(
      map((r) => ({
        plain: r.plainLyrics ?? '',
        lines: parseLrc(r.syncedLyrics),
        instrumental: r.instrumental === true,
      })),
    );
  }
}
