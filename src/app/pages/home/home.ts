import { Component, computed, inject, signal } from '@angular/core';
import { artistLink, trackLink } from '../../core/links';
import { RouterLink } from '@angular/router';
import { AudiusApi } from '../../core/api/audius-api';
import { Playlist, Track } from '../../core/models';
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
  imports: [RouterLink, Shelf, MediaCard, Cover],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomePage {
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  private readonly api = inject(AudiusApi);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);

  protected readonly greeting = greetingFor(new Date().getHours());
  protected readonly funFact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
  protected readonly genres = HOME_GENRES;
  protected readonly genre = signal<(typeof HOME_GENRES)[number]>('All');
  protected readonly loadError = LOAD_ERROR;

  protected readonly trending = loadable(this.genre, (genre) =>
    this.api.trendingTracks({ genre: genre === 'All' ? undefined : genre, time: 'week', limit: 20 }),
  );
  protected readonly playlists = loadable(signal(null), () => this.api.trendingPlaylists(12));
  protected readonly underground = loadable(signal(null), () => this.api.undergroundTrending(20));

  protected readonly hasLiked = computed(() => this.library.likedTracks().length > 0);
  protected readonly quickPlay = computed(() =>
    (this.trending.state().data ?? []).slice(0, this.hasLiked() ? 5 : 6),
  );

  protected playFrom(list: Track[], index: number): void {
    this.player.playTracks(list, index);
  }

  protected playPlaylist(playlist: Playlist): void {
    this.api.playlistTracks(playlist.id).subscribe((tracks) => {
      if (tracks.length) this.player.playTracks(tracks, 0);
    });
  }
}
