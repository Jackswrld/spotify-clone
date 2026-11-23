import { Injectable, inject } from '@angular/core';
import { Observable, catchError, concatMap, filter, from, map, of, take, toArray } from 'rxjs';
import { AudiusApi } from '../core/api/audius-api';
import { LastFmApi } from '../core/api/lastfm-api';
import { Artist, ArtistInfo } from '../core/models';

const MAX_SIMILAR_NAMES = 10;
const MAX_FANS_ALSO_LIKE = 6;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Adds Last.fm data to Audius artists — but only when we're confident it's the same
 * person: the Audius artist must be verified and the names must match exactly.
 * Showing nothing beats showing a famous namesake's bio.
 */
@Injectable({ providedIn: 'root' })
export class ArtistEnrichmentService {
  private readonly lastfm = inject(LastFmApi);
  private readonly audius = inject(AudiusApi);

  infoFor(artist: Artist): Observable<ArtistInfo | null> {
    if (!artist.verified) return of(null);
    return this.lastfm.artistInfo(artist.name).pipe(
      map((info) => (info && sameName(info.name, artist.name) ? { bio: info.bio, tags: info.tags, url: info.url } : null)),
    );
  }

  /** Similar artists from Last.fm that exist on Audius as verified accounts with the exact name. */
  fansAlsoLike(artist: Artist): Observable<Artist[]> {
    if (!artist.verified) return of([]);
    return this.lastfm.similar(artist.name, MAX_SIMILAR_NAMES).pipe(
      concatMap((names) =>
        from(names.slice(0, MAX_SIMILAR_NAMES)).pipe(
          // One search at a time, to stay polite to Audius's rate limit.
          concatMap((name) =>
            this.audius.searchArtists(name, 5).pipe(
              map((results) => results.find((a) => a.verified && sameName(a.name, name)) ?? null),
              catchError(() => of(null)),
            ),
          ),
          filter((a): a is Artist => a !== null),
          take(MAX_FANS_ALSO_LIKE),
          toArray(),
        ),
      ),
    );
  }
}
