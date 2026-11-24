import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Album, Artist, Artwork, Track } from '../models';
import { exactKey } from '../title';
import { CountryService } from '../../shared/country-picker/country-picker';

const ITUNES = 'https://itunes.apple.com';

/** The store country for catalog requests: the one chosen in the country picker. */
export const CATALOG_COUNTRY = new InjectionToken<Signal<string>>('CATALOG_COUNTRY', {
  factory: () => inject(CountryService).country,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/** Apple's 100px artwork URLs can be re-sized by rewriting the size segment. */
export function appleArtwork(url100: string | null | undefined): Artwork {
  if (!url100) return { small: null, medium: null, large: null };
  return {
    small: url100,
    medium: url100.replace('100x100bb', '300x300bb'),
    large: url100.replace('100x100bb', '600x600bb'),
  };
}

export function itunesSong(r: Raw): Track {
  return {
    id: `apple:${r['trackId']}`,
    appleId: String(r['trackId']),
    source: 'catalog',
    title: r['trackName'] ?? '',
    artistId: `apple:${r['artistId']}`,
    artistName: r['artistName'] ?? '',
    artistHandle: '',
    artistVerified: false,
    duration: r['trackTimeMillis'] ? r['trackTimeMillis'] / 1000 : 0,
    artwork: appleArtwork(r['artworkUrl100']),
    genre: r['primaryGenreName'] ?? null,
    mood: null,
    tags: [],
    description: null,
    playCount: 0,
    likeCount: 0,
    repostCount: 0,
    releaseDate: r['releaseDate'] ?? null,
    permalink: '',
    albumId: r['collectionId'] ? `apple:${r['collectionId']}` : null,
    albumName: r['collectionName'] ?? null,
    appleUrl: r['trackViewUrl'] ?? null,
  };
}

export function itunesAlbum(r: Raw): Album {
  return {
    id: `apple:${r['collectionId']}`,
    appleId: String(r['collectionId']),
    name: r['collectionName'] ?? '',
    artistName: r['artistName'] ?? '',
    artistId: `apple:${r['artistId']}`,
    artwork: appleArtwork(r['artworkUrl100']),
    releaseDate: r['releaseDate'] ?? null,
    trackCount: Number(r['trackCount'] ?? 0),
    genre: r['primaryGenreName'] ?? null,
    appleUrl: r['collectionViewUrl'] ?? '',
  };
}

export function itunesArtist(r: Raw): Artist {
  return {
    id: `apple:${r['artistId']}`,
    name: r['artistName'] ?? '',
    handle: '',
    verified: false,
    followerCount: 0,
    trackCount: 0,
    playlistCount: 0,
    bio: null,
    avatar: { small: null, medium: null, large: null },
    coverPhoto: null,
    permalink: '',
    source: 'catalog',
    appleUrl: r['artistLinkUrl'] ?? null,
  };
}

const sameTitle = (a: string, b: string) => exactKey(a) === exactKey(b);

/** iTunes Search and Lookup (free, no key, works from the browser). Never uses previews. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly country = inject(CATALOG_COUNTRY);

  searchSongs(q: string, limit = 20): Observable<Track[]> {
    return this.search(q, 'song', limit).pipe(map((r) => r.filter((x) => x['kind'] === 'song').map(itunesSong)));
  }

  searchArtists(q: string, limit = 10): Observable<Artist[]> {
    return this.search(q, 'musicArtist', limit).pipe(map((r) => r.map(itunesArtist)));
  }

  searchAlbums(q: string, limit = 10): Observable<Album[]> {
    return this.search(q, 'album', limit).pipe(map((r) => r.map(itunesAlbum)));
  }

  song(appleId: string): Observable<Track> {
    return this.lookup({ id: appleId }).pipe(
      map((r) => {
        const song = r.find((x) => x['wrapperType'] === 'track');
        if (!song) throw new Error('Song not found');
        return itunesSong(song);
      }),
    );
  }

  album(appleId: string): Observable<{ album: Album; tracks: Track[] }> {
    return this.lookup({ id: appleId, entity: 'song' }).pipe(
      map((r) => {
        const collection = r.find((x) => x['wrapperType'] === 'collection');
        if (!collection) throw new Error('Album not found');
        return {
          album: itunesAlbum(collection),
          tracks: r.filter((x) => x['wrapperType'] === 'track' && x['kind'] === 'song').map(itunesSong),
        };
      }),
    );
  }

  artist(appleId: string): Observable<Artist> {
    return this.lookup({ id: appleId }).pipe(
      map((r) => {
        const artist = r.find((x) => x['wrapperType'] === 'artist');
        if (!artist) throw new Error('Artist not found');
        return itunesArtist(artist);
      }),
    );
  }

  /** The artist's albums and singles, newest first. */
  artistAlbums(appleId: string, limit = 20): Observable<Album[]> {
    return this.lookup({ id: appleId, entity: 'album', sort: 'recent', limit: String(limit) }).pipe(
      map((r) =>
        r
          .filter((x) => x['wrapperType'] === 'collection')
          .map(itunesAlbum)
          .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '')),
      ),
    );
  }

  artistTopSongs(appleId: string, limit = 10): Observable<Track[]> {
    return this.lookup({ id: appleId, entity: 'song', limit: String(limit) }).pipe(
      map((r) => r.filter((x) => x['wrapperType'] === 'track' && x['kind'] === 'song').map(itunesSong)),
    );
  }

  /** Resolves a song known only by name (e.g. from Last.fm). Exact artist + title only. */
  findSong(artist: string, title: string): Observable<Track | null> {
    return this.searchSongs(`${artist} ${title}`, 5).pipe(
      map((songs) => songs.find((s) => sameTitle(s.artistName, artist) && sameTitle(s.title, title)) ?? null),
    );
  }

  /** Resolves an artist known only by name. Exact name only. */
  findArtist(name: string): Observable<Artist | null> {
    return this.searchArtists(name, 5).pipe(map((list) => list.find((a) => sameTitle(a.name, name)) ?? null));
  }

  private search(term: string, entity: string, limit: number): Observable<Raw[]> {
    const params = new HttpParams({
      fromObject: { term, media: 'music', entity, limit: String(limit), country: this.country() },
    });
    return this.http.get<{ results: Raw[] }>(`${ITUNES}/search`, { params }).pipe(map((r) => r.results ?? []));
  }

  private lookup(extra: Record<string, string>): Observable<Raw[]> {
    const params = new HttpParams({ fromObject: { ...extra, country: this.country() } });
    return this.http.get<{ results: Raw[] }>(`${ITUNES}/lookup`, { params }).pipe(map((r) => r.results ?? []));
  }
}
