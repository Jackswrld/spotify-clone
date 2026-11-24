import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { AudiusApi } from '../../core/api/audius-api';
import { Album, Artist, Playlist, Track } from '../../core/models';
import { CatalogApi } from '../../core/api/catalog-api';
import { albumLink, artistLink, trackLink } from '../../core/links';
import { normalise } from '../../core/title';
import { PlayerService } from '../../state/player.service';
import { LayoutService } from '../../state/layout.service';
import { TrackRow } from '../../shared/track-row/track-row';
import { MediaCard } from '../../shared/media-card/media-card';
import { Cover } from '../../shared/cover/cover';
import { Skeleton } from '../../shared/state-views/skeleton';
import { ErrorState } from '../../shared/state-views/error-state';
import { gradientFor } from '../../shared/utils/gradient';
import { HOME_GENRES } from '../home/home';

const MOODS = ['Chill', 'Energizing', 'Romantic', 'Fiery', 'Melancholy'];
const MIN_QUERY = 2;

type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; q: string }
  | { status: 'error'; q: string }
  | {
      status: 'ready';
      q: string;
      catalogSongs: Track[];
      audiusSongs: Track[];
      artists: Artist[];
      albums: Album[];
      playlists: Playlist[];
    };

type TopResult = { kind: 'artist'; artist: Artist } | { kind: 'track'; track: Track; index: number };

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TrackRow, MediaCard, Cover, Skeleton, ErrorState],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly api = inject(AudiusApi);
  private readonly catalog = inject(CatalogApi);
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  protected readonly albumLink = albumLink;
  protected readonly songTab = signal<'all' | 'audius'>('all');
  private readonly router = inject(Router);
  protected readonly player = inject(PlayerService);
  protected readonly layout = inject(LayoutService);

  protected readonly tiles = [...HOME_GENRES.filter((g) => g !== 'All'), ...MOODS].map((name) => ({
    name,
    background: gradientFor(name),
  }));

  private readonly query$ = inject(ActivatedRoute).queryParamMap.pipe(
    map((params) => (params.get('q') ?? '').trim()),
  );

  protected readonly rawQuery = toSignal(this.query$, { initialValue: '' });

  private readonly retry$ = new Subject<void>();

  protected readonly state = toSignal(
    this.query$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (q.length < MIN_QUERY) return of<SearchState>({ status: 'idle' });
        return this.retry$.pipe(
          startWith(undefined),
          switchMap(() => this.search$(q)),
        );
      }),
    ),
    { initialValue: { status: 'idle' } as SearchState },
  );

  /**
   * Both catalogs at once. One failing group still shows the others; only when every
   * request fails is it an error rather than "no results". Never calls YouTube.
   */
  private search$(q: string) {
    const orNull = <T>(source: Observable<T[]>) => source.pipe(catchError(() => of(null)));
    return forkJoin({
      catalogSongs: orNull(this.catalog.searchSongs(q, 20)),
      catalogArtists: orNull(this.catalog.searchArtists(q, 10)),
      albums: orNull(this.catalog.searchAlbums(q, 10)),
      audiusSongs: orNull(this.api.searchTracks(q, 20)),
      audiusArtists: orNull(this.api.searchArtists(q, 10)),
      playlists: orNull(this.api.searchPlaylists(q, 10)),
    }).pipe(
      map((r): SearchState =>
        Object.values(r).every((v) => v === null)
          ? { status: 'error', q }
          : {
              status: 'ready',
              q,
              catalogSongs: r.catalogSongs ?? [],
              audiusSongs: r.audiusSongs ?? [],
              artists: [...(r.catalogArtists ?? []), ...(r.audiusArtists ?? [])],
              albums: r.albums ?? [],
              playlists: r.playlists ?? [],
            },
      ),
      startWith<SearchState>({ status: 'loading', q }),
    );
  }

  /** Catalog songs first, then Audius songs that aren't the same song. */
  protected readonly allSongs = computed(() => {
    const s = this.state();
    if (s.status !== 'ready') return [];
    const key = (t: Track) => `${normalise(t.artistName)}|${normalise(t.title)}`;
    const seen = new Set(s.catalogSongs.map(key));
    return [...s.catalogSongs, ...s.audiusSongs.filter((t) => !seen.has(key(t)))];
  });

  protected retry(): void {
    this.retry$.next();
  }

  protected readonly songs = computed(() => {
    const s = this.state();
    if (s.status !== 'ready') return [];
    return (this.songTab() === 'audius' ? s.audiusSongs : this.allSongs()).slice(0, 10);
  });

  protected readonly topResult = computed<TopResult | null>(() => {
    const s = this.state();
    if (s.status !== 'ready') return null;
    const q = s.q.toLowerCase();
    const artist = s.artists.find((a) => a.name.toLowerCase() === q); // catalog artists come first
    if (artist) return { kind: 'artist', artist };
    const songs = this.allSongs();
    if (songs.length) return { kind: 'track', track: songs[0], index: 0 };
    if (s.artists.length) return { kind: 'artist', artist: s.artists[0] };
    return null;
  });

  protected readonly isEmpty = computed(() => {
    const s = this.state();
    return (
      s.status === 'ready' &&
      !s.catalogSongs.length &&
      !s.audiusSongs.length &&
      !s.artists.length &&
      !s.albums.length &&
      !s.playlists.length
    );
  });

  protected search(q: string): void {
    this.router.navigate(['/search'], { queryParams: q ? { q } : {}, replaceUrl: true });
  }

  protected playSong(index: number): void {
    this.player.playTracks(this.songs(), index);
  }

  /** The top result plays from the merged list, regardless of the songs tab. */
  protected playTop(index: number): void {
    this.player.playTracks(this.allSongs(), index);
  }

  protected playAlbum(album: Album): void {
    this.catalog.album(album.appleId).subscribe((r) => {
      if (r.tracks.length) this.player.playTracks(r.tracks, 0);
    });
  }

  protected playPlaylist(playlist: Playlist): void {
    this.api.playlistTracks(playlist.id).subscribe((tracks) => {
      if (tracks.length) this.player.playTracks(tracks, 0);
    });
  }
}
