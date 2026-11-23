import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError, switchMap, of } from 'rxjs';
import { APP_CONFIG } from '../config';
import { Artist, Playlist, Track } from '../models';
import { Raw, isPlayable, toArtist, toPlaylist, toTrack } from './audius-mappers';

type Params = Record<string, string | number | undefined>;

@Injectable({ providedIn: 'root' })
export class AudiusApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  trendingTracks(
    opts: { genre?: string; time?: 'week' | 'month' | 'allTime'; limit?: number } = {},
  ): Observable<Track[]> {
    return this.tracks('/tracks/trending', { genre: opts.genre, time: opts.time, limit: opts.limit });
  }

  undergroundTrending(limit?: number): Observable<Track[]> {
    return this.tracks('/tracks/trending/underground', { limit });
  }

  trendingPlaylists(limit?: number): Observable<Playlist[]> {
    return this.get<Raw[]>('/playlists/trending', { limit }).pipe(map((list) => list.map(toPlaylist)));
  }

  searchTracks(q: string, limit?: number): Observable<Track[]> {
    return this.tracks('/tracks/search', { query: q, limit });
  }

  searchArtists(q: string, limit?: number): Observable<Artist[]> {
    return this.get<Raw[]>('/users/search', { query: q, limit }).pipe(map((list) => list.map(toArtist)));
  }

  searchPlaylists(q: string, limit?: number): Observable<Playlist[]> {
    return this.get<Raw[]>('/playlists/search', { query: q, limit }).pipe(
      map((list) => list.map(toPlaylist)),
    );
  }

  track(id: string): Observable<Track> {
    return this.get<Raw>(`/tracks/${encodeURIComponent(id)}`).pipe(
      switchMap((raw) =>
        raw && isPlayable(raw) ? of(toTrack(raw)) : throwError(() => new Error('Track not available')),
      ),
    );
  }

  artist(id: string): Observable<Artist> {
    return this.get<Raw>(`/users/${encodeURIComponent(id)}`).pipe(map(toArtist));
  }

  artistTracks(id: string, opts: { sort?: 'plays' | 'date'; limit?: number } = {}): Observable<Track[]> {
    return this.tracks(`/users/${encodeURIComponent(id)}/tracks`, { sort: opts.sort, limit: opts.limit });
  }

  artistPlaylists(id: string, limit?: number): Observable<Playlist[]> {
    return this.get<Raw[]>(`/users/${encodeURIComponent(id)}/playlists`, { limit }).pipe(
      map((list) => list.map(toPlaylist)),
    );
  }

  /** Note: Audius returns this endpoint's data as a one-element array. */
  playlist(id: string): Observable<Playlist> {
    return this.get<Raw[]>(`/playlists/${encodeURIComponent(id)}`).pipe(
      switchMap((list) =>
        list?.length ? of(toPlaylist(list[0])) : throwError(() => new Error('Playlist not found')),
      ),
    );
  }

  playlistTracks(id: string): Observable<Track[]> {
    return this.tracks(`/playlists/${encodeURIComponent(id)}/tracks`, {});
  }

  /** Direct audio URL; it redirects to the content node that serves the file. */
  streamUrl(trackId: string): string {
    const appName = encodeURIComponent(this.config.audiusAppName);
    return `${this.config.audiusBaseUrl}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${appName}`;
  }

  private tracks(path: string, params: Params): Observable<Track[]> {
    return this.get<Raw[]>(path, params).pipe(
      map((list) => (list ?? []).filter(isPlayable).map(toTrack)),
    );
  }

  private get<T>(path: string, params: Params = {}): Observable<T> {
    let httpParams = new HttpParams().set('app_name', this.config.audiusAppName);
    if (this.config.audiusApiKey) httpParams = httpParams.set('api_key', this.config.audiusApiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') httpParams = httpParams.set(key, String(value));
    }
    return this.http
      .get<{ data: T }>(`${this.config.audiusBaseUrl}${path}`, { params: httpParams })
      .pipe(map((res) => res.data));
  }
}
