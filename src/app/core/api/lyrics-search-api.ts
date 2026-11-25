import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

/** A song whose lyrics contain the searched words (Genius, confirmed on Deezer by the music server). */
export interface LyricHit {
  title: string;
  artist: string;
  image: string | null;
  durationS: number;
}

export type LyricsSearchResult = LyricHit[] | 'not-set-up' | 'error';

interface Response {
  results?: { title: string; artist: string; image: string | null; durationS: number }[];
  reason?: 'no-key';
}

@Injectable({ providedIn: 'root' })
export class LyricsSearchApi {
  private readonly http = inject(HttpClient);

  search(q: string): Observable<LyricsSearchResult> {
    return this.http.get<Response>('/api/lyrics/search', { params: new HttpParams().set('q', q) }).pipe(
      map((r): LyricsSearchResult =>
        r?.reason === 'no-key'
          ? 'not-set-up'
          : (r?.results ?? []).map(({ title, artist, image, durationS }) => ({ title, artist, image: image ?? null, durationS })),
      ),
      catchError(() => of<LyricsSearchResult>('error')),
    );
  }
}
