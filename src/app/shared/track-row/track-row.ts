import { Component, computed, inject, input, output } from '@angular/core';
import { artistLink, trackLink } from '../../core/links';
import { RouterLink } from '@angular/router';
import { Track } from '../../core/models';
import { PlayerService } from '../../state/player.service';
import { Cover } from '../cover/cover';
import { LikeButton } from '../like-button/like-button';
import { TrackMenuExtra, TrackMenuService } from '../add-to-playlist/track-menu.service';
import { formatTime } from '../utils/format';

export interface TrackMenuEvent {
  track: Track;
  anchor: HTMLElement;
}

/** One playable song in a list. */
@Component({
  selector: 'app-track-row',
  imports: [RouterLink, Cover, LikeButton],
  templateUrl: './track-row.html',
  styleUrl: './track-row.scss',
})
export class TrackRow {
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  private readonly player = inject(PlayerService);
  private readonly trackMenu = inject(TrackMenuService);

  readonly track = input.required<Track>();
  readonly index = input(0);
  readonly showArtwork = input(true);
  readonly showAlbumArtist = input(true);
  /** Extra menu entries for this list, e.g. "Remove from this playlist". */
  readonly extraMenuItems = input<TrackMenuExtra[]>([]);

  readonly play = output<void>();
  readonly menu = output<TrackMenuEvent>();

  protected readonly isCurrent = computed(() => this.player.current()?.id === this.track().id);
  protected readonly isPlaying = computed(() => this.isCurrent() && this.player.isPlaying());
  protected readonly duration = computed(() => formatTime(this.track().duration));

  protected openMenu(event: MouseEvent): void {
    const anchor = event.currentTarget as HTMLElement;
    this.menu.emit({ track: this.track(), anchor });
    this.trackMenu.open(this.track(), anchor, this.extraMenuItems());
  }
}
