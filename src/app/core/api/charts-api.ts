import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Album, Track } from '../models';
import { appleArtwork } from './catalog-api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

function chartSong(r: Raw): Track {
  return {
    id: `apple:${r['id']}`,
    appleId: String(r['id']),
    source: 'catalog',
    title: r['name'] ?? '',
    artistId: `apple:${r['artistId']}`,
    artistName: r['artistName'] ?? '',
    artistHandle: '',
    artistVerified: false,
    duration: 0, // the chart feed has no length; looked up before matching a video
    artwork: appleArtwork(r['artworkUrl100']),
    genre: r['genres']?.[0]?.name ?? null,
    mood: null,
    tags: [],
    description: null,
    playCount: 0,
    likeCount: 0,
    repostCount: 0,
    releaseDate: r['releaseDate'] ?? null,
    permalink: '',
    albumId: null,
    albumName: null,
    appleUrl: r['url'] ?? null,
  };
}

function chartAlbum(r: Raw): Album {
  return {
    id: `apple:${r['id']}`,
    appleId: String(r['id']),
    name: r['name'] ?? '',
    artistName: r['artistName'] ?? '',
    artistId: `apple:${r['artistId']}`,
    artwork: appleArtwork(r['artworkUrl100']),
    releaseDate: r['releaseDate'] ?? null,
    trackCount: 0,
    genre: r['genres']?.[0]?.name ?? null,
    appleUrl: r['url'] ?? '',
  };
}

/** Apple "most played" charts, through the relay (the feed doesn't allow browser calls). */
@Injectable({ providedIn: 'root' })
export class ChartsApi {
  private readonly http = inject(HttpClient);

  topSongs(country: string, limit = 25): Observable<Track[]> {
    return this.feed(country, 'songs', limit).pipe(map((r) => r.map(chartSong)));
  }

  topAlbums(country: string, limit = 25): Observable<Album[]> {
    return this.feed(country, 'albums', limit).pipe(map((r) => r.map(chartAlbum)));
  }

  private feed(country: string, kind: 'songs' | 'albums', limit: number): Observable<Raw[]> {
    return this.http
      .get<{ feed?: { results?: Raw[] } }>(`/api/charts/${country}/${kind}/${limit}`)
      .pipe(map((r) => r.feed?.results ?? []));
  }
}
