import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../../shared/cover/cover';
import { TrackRow } from '../../shared/track-row/track-row';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { loadable } from '../../shared/utils/loadable';
import { scrollMainToTopOn } from '../scroll-top';

@Component({
  selector: 'app-playlist-page',
  imports: [RouterLink, Cover, TrackRow, ErrorState, Skeleton],
  templateUrl: './playlist.html',
  styleUrl: './playlist.scss',
})
export class PlaylistPage {
  private readonly api = inject(AudiusApi);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);

  readonly id = input.required<string>();

  /** Header tint; Task 15 replaces this with the artwork colour. */
  protected readonly headerColor = signal('var(--surface-2)');

  protected readonly playlist = loadable(this.id, (id) => this.api.playlist(id));
  protected readonly tracks = loadable(this.id, (id) => this.api.playlistTracks(id));

  protected readonly saved = computed(() => this.library.isPlaylistSaved(this.id()));

  constructor() {
    scrollMainToTopOn(this.id);
  }

  protected play(index = 0): void {
    const tracks = this.tracks.state().data ?? [];
    if (tracks.length) this.player.playTracks(tracks, index);
  }

  protected shufflePlay(): void {
    const tracks = this.tracks.state().data ?? [];
    if (!tracks.length) return;
    if (!this.player.shuffle()) this.player.toggleShuffle();
    this.player.playTracks(tracks, Math.floor(Math.random() * tracks.length));
  }

  protected toggleSave(): void {
    const playlist = this.playlist.state().data;
    if (playlist) this.library.togglePlaylistSave(playlist);
  }
}
