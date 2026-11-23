import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Track } from '../../core/models';
import { PlayerService } from '../../state/player.service';
import { Cover } from '../cover/cover';
import { formatTime } from '../utils/format';

export interface TrackMenuEvent {
  track: Track;
  anchor: HTMLElement;
}

/** One playable song in a list. */
@Component({
  selector: 'app-track-row',
  imports: [RouterLink, Cover],
  templateUrl: './track-row.html',
  styleUrl: './track-row.scss',
})
export class TrackRow {
  private readonly player = inject(PlayerService);

  readonly track = input.required<Track>();
  readonly index = input(0);
  readonly showArtwork = input(true);
  readonly showAlbumArtist = input(true);

  readonly play = output<void>();
  readonly menu = output<TrackMenuEvent>();

  protected readonly isCurrent = computed(() => this.player.current()?.id === this.track().id);
  protected readonly isPlaying = computed(() => this.isCurrent() && this.player.isPlaying());
  protected readonly duration = computed(() => formatTime(this.track().duration));

  protected openMenu(event: MouseEvent): void {
    this.menu.emit({ track: this.track(), anchor: event.currentTarget as HTMLElement });
  }
}
