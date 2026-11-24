import { Injectable, Signal, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { LyricsApi } from '../core/api/lyrics-api';
import { Lyrics, Track } from '../core/models';
import { lyricsTitle } from '../core/title';
import { PlayerService } from './player.service';

export interface LyricsState {
  trackId: string;
  status: 'idle' | 'loading' | 'ready' | 'none' | 'error';
  data: Lyrics | null;
}

/** Lines are highlighted slightly early so they feel in time with the singer. */
const LEAD_SECONDS = 0.25;

export { lyricsTitle } from '../core/title';

/** Lyrics for whatever is playing, plus which line is active right now. */
@Injectable({ providedIn: 'root' })
export class LyricsService {
  private readonly api = inject(LyricsApi);
  private readonly player = inject(PlayerService);

  readonly lyrics: Signal<LyricsState> = toSignal(
    toObservable(this.player.current).pipe(
      distinctUntilChanged((a, b) => a?.id === b?.id),
      switchMap((track): Observable<LyricsState> => {
        if (!track) return of({ trackId: '', status: 'idle', data: null });
        return this.fetchFor(track).pipe(
          map((data): LyricsState => ({ trackId: track.id, status: data ? 'ready' : 'none', data })),
          catchError(() => of<LyricsState>({ trackId: track.id, status: 'error', data: null })),
          startWith<LyricsState>({ trackId: track.id, status: 'loading', data: null }),
        );
      }),
    ),
    { initialValue: { trackId: '', status: 'idle', data: null } },
  );

  readonly activeIndex = computed(() => {
    const lines = this.lyrics().data?.lines ?? [];
    const now = this.player.time() + LEAD_SECONDS;
    let active = -1;
    for (let i = 0; i < lines.length && lines[i].time <= now; i++) active = i;
    return active;
  });

  /** Used by the track page for songs that aren't playing. */
  fetchFor(track: Track): Observable<Lyrics | null> {
    return this.api.get(track.artistName, lyricsTitle(track), track.duration);
  }
}
