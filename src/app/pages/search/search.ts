import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Observable,
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { ArtistPhotoApi } from '../../core/api/artist-photo-api';
import { LyricHit, LyricsSearchApi, LyricsSearchResult } from '../../core/api/lyrics-search-api';
import { ToastService } from '../../state/toast.service';
import { AudiusApi } from '../../core/api/audius-api';
import { Album, Artist, Playlist, Track } from '../../core/models';
import { CatalogApi } from '../../core/api/catalog-api';
import { albumLink, artistLink, trackLink } from '../../core/links';
import { exactKey } from '../../core/title';
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
/** Fewer Deezer fans than this = a namesake, not the artist people mean. */
const MIN_FANS = 1_000;
const MAX_ARTISTS = 6;
/** An artist this big beats a song with the same title for Top result (Wizkid, Drake). */
const BIG_ARTIST_FANS = 100_000;
/** From this many words a query looks like a remembered lyric line. */
const LYRIC_WORDS = 4;

type LyricsState = null | 'loading' | LyricsSearchResult;

const wordCount = (q: string) => q.split(/\s+/).filter(Boolean).length;

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
  imports: [RouterLink, NgTemplateOutlet, TrackRow, MediaCard, Cover, Skeleton, ErrorState],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly api = inject(AudiusApi);
  private readonly catalog = inject(CatalogApi);
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  protected readonly albumLink = albumLink;
  private readonly photos = inject(ArtistPhotoApi);
  private readonly lyricsApi = inject(LyricsSearchApi);
  private readonly toast = inject(ToastService);
  protected readonly songTab = signal<'all' | 'independent' | 'lyrics'>('all');
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

  private readonly settledQuery$ = this.query$.pipe(debounceTime(300), distinctUntilChanged(), shareReplay(1));

  protected readonly state = toSignal(
    this.settledQuery$.pipe(
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
   * Apple for mainstream results, Audius only for the Independent tab. One failing group still
   * shows the others; only when every request fails is it an error rather than "no results".
   * Never calls YouTube.
   */
  private search$(q: string) {
    const orNull = <T>(source: Observable<T[]>) => source.pipe(catchError(() => of(null)));
    return forkJoin({
      catalogSongs: orNull(this.catalog.searchSongs(q, 20)),
      catalogArtists: orNull(this.catalog.searchArtists(q, 10)),
      albums: orNull(this.catalog.searchAlbums(q, 10)),
      audiusSongs: orNull(this.api.searchTracks(q, 20)),
      playlists: orNull(this.api.searchPlaylists(q, 10)),
    }).pipe(
      switchMap((r) =>
        this.realArtists(r.catalogArtists ?? []).pipe(map((artists) => ({ ...r, artists, failed: Object.values(r).every((v) => v === null) }))),
      ),
      map((r): SearchState =>
        r.failed
          ? { status: 'error', q }
          : {
              status: 'ready',
              q,
              catalogSongs: r.catalogSongs ?? [],
              audiusSongs: r.audiusSongs ?? [],
              artists: r.artists,
              albums: r.albums ?? [],
              playlists: r.playlists ?? [],
            },
      ),
      startWith<SearchState>({ status: 'loading', q }),
    );
  }

  /**
   * Apple's artists with their real photo and fan count. Namesakes nobody listens to are dropped
   * (unless that would drop everyone); the rest are sorted by fans.
   */
  private realArtists(artists: Artist[]): Observable<Artist[]> {
    if (!artists.length) return of([]);
    const withPhoto = (a: Artist) =>
      this.photos.photoFor(a.name).pipe(
        map((p) => ({
          ...a,
          avatar: p.image ? { small: p.image, medium: p.image, large: p.image } : a.avatar,
          followerCount: p.fans,
        })),
      );
    return forkJoin(artists.map(withPhoto)).pipe(
      map((withPhotos) => {
        // Apple often lists several artists with one name; they share a photo, so show one.
        const seen = new Set<string>();
        const unique = withPhotos.filter((a) => !seen.has(exactKey(a.name)) && seen.add(exactKey(a.name)));
        const real = unique.filter((a) => a.followerCount >= MIN_FANS);
        const shown = real.length ? real : unique;
        return [...shown].sort((a, b) => b.followerCount - a.followerCount).slice(0, MAX_ARTISTS);
      }),
    );
  }

  private readonly lyricsRetry$ = new Subject<void>();

  /** Each new search starts on "All", so a tab picked earlier can't hide its results. */
  private readonly resetTab = this.settledQuery$.pipe(takeUntilDestroyed()).subscribe(() => this.songTab.set('all'));

  /**
   * Songs whose lyrics contain the query: automatic from 4 words, or on the Lyrics tab. Kept apart
   * from the main results so a slow lyric search never holds them up.
   */
  protected readonly lyrics = toSignal(
    combineLatest([this.settledQuery$, toObservable(this.songTab)]).pipe(
      map(([q, tab]) => (q.length >= MIN_QUERY && (tab === 'lyrics' || wordCount(q) >= LYRIC_WORDS) ? q : '')),
      distinctUntilChanged(),
      switchMap((q) =>
        !q
          ? of<LyricsState>(null)
          : this.lyricsRetry$.pipe(
              startWith(undefined),
              switchMap(() => this.lyricsApi.search(q).pipe(startWith<LyricsState>('loading'))),
            ),
      ),
    ),
    { initialValue: null as LyricsState },
  );

  protected readonly lyricHits = computed(() => {
    const l = this.lyrics();
    return Array.isArray(l) ? l : [];
  });

  /** The automatic section under Songs (the Lyrics tab shows the same hits in the Songs list instead). */
  protected readonly showLyricSection = computed(
    () => this.songTab() !== 'lyrics' && wordCount(this.rawQuery()) >= LYRIC_WORDS && this.lyrics() !== null,
  );

  protected readonly lyricStatus = computed(() => {
    const l = this.lyrics();
    return l === null || Array.isArray(l) ? 'hits' : l;
  });

  protected retryLyrics(): void {
    this.lyricsRetry$.next();
  }

  protected playLyric(hit: LyricHit): void {
    this.catalog.findSong(hit.artist, hit.title).subscribe({
      next: (song) => (song ? this.player.playTracks([song], 0) : this.toast.show("Couldn't find this song to play")),
      error: () => this.toast.show("Couldn't find this song to play"),
    });
  }

  /** The mainstream (Apple) songs. */
  protected readonly allSongs = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.catalogSongs : [];
  });

  protected readonly hasSongs = computed(() => {
    const s = this.state();
    return s.status === 'ready' && (s.catalogSongs.length > 0 || s.audiusSongs.length > 0);
  });

  protected retry(): void {
    this.retry$.next();
  }

  protected readonly songs = computed(() => {
    const s = this.state();
    if (s.status !== 'ready') return [];
    return (this.songTab() === 'independent' ? s.audiusSongs : this.allSongs()).slice(0, 10);
  });

  protected readonly topResult = computed<TopResult | null>(() => {
    const s = this.state();
    if (s.status !== 'ready') return null;
    const q = exactKey(s.q);
    const artist = s.artists.find((a) => exactKey(a.name) === q);
    const songs = this.allSongs();
    const titleMatch = songs.findIndex((t) => exactKey(t.title) === q);
    // "calm down": the song, not a small artist called "Calm Down". "wizkid": the artist.
    if (artist && (titleMatch < 0 || artist.followerCount >= BIG_ARTIST_FANS)) return { kind: 'artist', artist };
    if (titleMatch >= 0) return { kind: 'track', track: songs[titleMatch], index: titleMatch };
    if (artist) return { kind: 'artist', artist };
    if (songs.length) return { kind: 'track', track: songs[0], index: 0 };
    if (s.artists.length) return { kind: 'artist', artist: s.artists[0] };
    return null;
  });

  protected readonly isEmpty = computed(() => {
    const s = this.state();
    return (
      s.status === 'ready' &&
      this.lyricHits().length === 0 &&
      this.lyrics() !== 'loading' &&
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
