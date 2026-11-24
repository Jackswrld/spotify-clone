import { Component, computed, inject, signal } from '@angular/core';
import { albumLink, artistLink, trackLink } from '../../core/links';
import { RouterLink } from '@angular/router';
import { AudiusApi } from '../../core/api/audius-api';
import { Album, Playlist, Track } from '../../core/models';
import { ChartsApi } from '../../core/api/charts-api';
import { LastFmApi } from '../../core/api/lastfm-api';
import { CatalogApi } from '../../core/api/catalog-api';
import { CountryPicker, CountryService } from '../../shared/country-picker/country-picker';
import { ToastService } from '../../state/toast.service';
import { RelayStatusService } from '../../core/api/relay-status';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Shelf } from '../../shared/shelf/shelf';
import { MediaCard } from '../../shared/media-card/media-card';
import { Cover } from '../../shared/cover/cover';
import { loadable } from '../../shared/utils/loadable';
import { FUN_FACTS } from './fun-facts';

/** Exact Audius genre values. */
export const HOME_GENRES = [
  'All',
  'Electronic',
  'Hip-Hop/Rap',
  'Lo-Fi',
  'Pop',
  'R&B/Soul',
  'Alternative',
  'House',
  'Ambient',
] as const;

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

const LOAD_ERROR = "Couldn't load this right now.";

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Shelf, MediaCard, Cover, CountryPicker],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  protected readonly albumLink = albumLink;
  private readonly api = inject(AudiusApi);
  private readonly charts = inject(ChartsApi);
  private readonly lastfm = inject(LastFmApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);
  protected readonly countries = inject(CountryService);
  private readonly relay = inject(RelayStatusService);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);

  protected readonly greeting = greetingFor(new Date().getHours());
  protected readonly funFact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  protected readonly genres = HOME_GENRES;
  protected readonly genre = signal<(typeof HOME_GENRES)[number]>('All');
  protected readonly loadError = LOAD_ERROR;
  /** Charts come through the local relay; say so when it is unreachable. */
  protected readonly chartError = computed(() =>
    this.relay.status() === 'down' ? "Can't reach the music server." : LOAD_ERROR,
  );

  protected readonly trending = loadable(this.genre, (genre) =>
    this.api.trendingTracks({ genre: genre === 'All' ? undefined : genre, time: 'week', limit: 20 }),
  );
  protected readonly playlists = loadable(signal(null), () => this.api.trendingPlaylists(12));
  protected readonly underground = loadable(signal(null), () => this.api.undergroundTrending(20));

  /** Apple "most played" charts for the chosen country (through the relay). */
  protected readonly topSongs = loadable(this.countries.country, (c) => this.charts.topSongs(c, 25));
  protected readonly topAlbums = loadable(this.countries.country, (c) => this.charts.topAlbums(c, 25));
  /** Last.fm global chart: names only, resolved on Apple when clicked. Empty without a key. */
  protected readonly globalTop = loadable(signal(null), () => this.lastfm.topTracks(25));

  protected readonly hasLiked = computed(() => this.library.likedTracks().length > 0);
  /** Top chart songs, or Audius trending when the charts aren't available. */
  protected readonly quickPlay = computed(() => {
    const chart = this.topSongs.state().data ?? [];
    const source = chart.length ? chart : (this.trending.state().data ?? []);
    return source.slice(0, this.hasLiked() ? 5 : 6);
  });

  protected playFrom(list: Track[], index: number): void {
    this.player.playTracks(list, index);
  }

  protected retryCharts(): void {
    this.relay.recheck();
    this.topSongs.retry();
    this.topAlbums.retry();
  }

  protected playAlbum(album: Album): void {
    this.catalog.album(album.appleId).subscribe((r) => {
      if (r.tracks.length) this.player.playTracks(r.tracks, 0);
    });
  }

  /** Last.fm entries have no Apple id: find the exact song on Apple, then play it. */
  protected playGlobal(entry: { name: string; artist: string }): void {
    this.catalog.findSong(entry.artist, entry.name).subscribe((track) => {
      if (track) this.player.playTracks([track], 0);
      else this.toast.show("Couldn't find this on Apple Music");
    });
  }

  protected playPlaylist(playlist: Playlist): void {
    this.api.playlistTracks(playlist.id).subscribe((tracks) => {
      if (tracks.length) this.player.playTracks(tracks, 0);
    });
  }
}
