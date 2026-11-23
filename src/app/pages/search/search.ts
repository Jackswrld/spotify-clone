import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { AudiusApi } from '../../core/api/audius-api';
import { Artist, Playlist, Track } from '../../core/models';
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
  | { status: 'ready'; q: string; tracks: Track[]; artists: Artist[]; playlists: Playlist[] };

type TopResult = { kind: 'artist'; artist: Artist } | { kind: 'track'; track: Track; index: number };

@Component({
  selector: 'app-search-page',
  imports: [RouterLink, TrackRow, MediaCard, Cover, Skeleton, ErrorState],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly api = inject(AudiusApi);
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

  /** One failing group still shows the others; if all three fail, it's an error, not "no results". */
  private search$(q: string) {
    const orNull = <T>(source: Observable<T[]>) => source.pipe(catchError(() => of(null)));
    return forkJoin({
      tracks: orNull(this.api.searchTracks(q, 20)),
      artists: orNull(this.api.searchArtists(q, 10)),
      playlists: orNull(this.api.searchPlaylists(q, 10)),
    }).pipe(
      map(({ tracks, artists, playlists }): SearchState =>
        tracks === null && artists === null && playlists === null
          ? { status: 'error', q }
          : { status: 'ready', q, tracks: tracks ?? [], artists: artists ?? [], playlists: playlists ?? [] },
      ),
      startWith<SearchState>({ status: 'loading', q }),
    );
  }

  protected retry(): void {
    this.retry$.next();
  }

  protected readonly songs = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.tracks.slice(0, 10) : [];
  });

  protected readonly topResult = computed<TopResult | null>(() => {
    const s = this.state();
    if (s.status !== 'ready') return null;
    const q = s.q.toLowerCase();
    const artist = s.artists.find((a) => a.name.toLowerCase() === q);
    if (artist) return { kind: 'artist', artist };
    if (s.tracks.length) return { kind: 'track', track: s.tracks[0], index: 0 };
    if (s.artists.length) return { kind: 'artist', artist: s.artists[0] };
    return null;
  });

  protected readonly isEmpty = computed(() => {
    const s = this.state();
    return s.status === 'ready' && !s.tracks.length && !s.artists.length && !s.playlists.length;
  });

  protected search(q: string): void {
    this.router.navigate(['/search'], { queryParams: q ? { q } : {}, replaceUrl: true });
  }

  protected playSong(index: number): void {
    this.player.playTracks(this.songs(), index);
  }

  protected playPlaylist(playlist: Playlist): void {
    this.api.playlistTracks(playlist.id).subscribe((tracks) => {
      if (tracks.length) this.player.playTracks(tracks, 0);
    });
  }
}
