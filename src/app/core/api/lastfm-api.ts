import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { APP_CONFIG } from '../config';
import { ArtistInfo } from '../models';

const LASTFM_URL = 'https://ws.audioscrobbler.com/2.0/';
const MAX_TAGS = 5;

/** Last.fm artist info plus the name Last.fm matched, so callers can check it is the same artist. */
export type LastFmArtistInfo = ArtistInfo & { name: string };

/** Removes Last.fm's trailing "Read more" link and any other HTML. */
function cleanBio(summary: string | undefined): string | null {
  if (!summary) return null;
  const text = summary
    .replace(/<a\s[^>]*>\s*Read more on Last\.fm\s*<\/a>\.?/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  return text || null;
}

/** Last.fm (free key, non-commercial). Every call returns nothing when no key is configured. */
@Injectable({ providedIn: 'root' })
export class LastFmApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  artistInfo(name: string): Observable<LastFmArtistInfo | null> {
    if (!this.config.lastFmApiKey) return of(null);
    return this.call('artist.getinfo', { artist: name }).pipe(
      map((res) => {
        const artist = res?.['artist'];
        if (!artist) return null;
        const tags = (artist.tags?.tag ?? []) as { name: string }[];
        return {
          name: String(artist.name ?? ''),
          bio: cleanBio(artist.bio?.summary),
          tags: tags.map((t) => t.name).slice(0, MAX_TAGS),
          url: String(artist.url ?? ''),
        };
      }),
      catchError(() => of(null)),
    );
  }

  /** Last.fm's global top tracks (names only; resolve on Apple before playing). */
  topTracks(limit = 25): Observable<{ name: string; artist: string; image: string | null }[]> {
    if (!this.config.lastFmApiKey) return of([]);
    return this.call('chart.gettoptracks', { limit: String(limit) }).pipe(
      map((res) =>
        ((res?.['tracks']?.track ?? []) as { name: string; artist?: { name?: string }; image?: { size: string; '#text': string }[] }[]).map(
          (t) => ({
            name: t.name,
            artist: t.artist?.name ?? '',
            image: [...(t.image ?? [])].reverse().find((i) => i['#text'])?.['#text'] ?? null,
          }),
        ),
      ),
      catchError(() => of([])),
    );
  }

  similar(name: string, limit = 10): Observable<string[]> {
    if (!this.config.lastFmApiKey) return of([]);
    return this.call('artist.getsimilar', { artist: name, limit: String(limit) }).pipe(
      map((res) => ((res?.['similarartists']?.artist ?? []) as { name: string }[]).map((a) => a.name)),
      catchError(() => of([])),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private call(method: string, extra: Record<string, string>): Observable<Record<string, any> | null> {
    const params = new HttpParams({
      fromObject: { method, ...extra, api_key: this.config.lastFmApiKey, format: 'json', autocorrect: '0' },
    });
    // Last.fm reports errors as 200 with an "error" field.
    return this.http
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .get<Record<string, any>>(LASTFM_URL, { params })
      .pipe(map((res) => (res && 'error' in res ? null : res)));
  }
}
