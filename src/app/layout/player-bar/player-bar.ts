import { Component, computed, inject, signal } from '@angular/core';
import { artistLink, trackLink } from '../../core/links';
import { RouterLink } from '@angular/router';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { RelayStatusService } from '../../core/api/relay-status';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackMenuService } from '../../shared/add-to-playlist/track-menu.service';
import { formatTime } from '../../shared/utils/format';

/** Full playback bar for desktop and tablet. */
@Component({
  selector: 'app-player-bar',
  imports: [RouterLink, Cover, LikeButton],
  templateUrl: './player-bar.html',
  styleUrl: './player-bar.scss',
})
export class PlayerBar {
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  protected readonly player = inject(PlayerService);
  protected readonly panel = inject(PanelStateService);
  protected readonly trackMenu = inject(TrackMenuService);
  private readonly relay = inject(RelayStatusService);

  protected readonly youtubeOffText = "YouTube playback isn't set up";

  /** A YouTube song can't play until the relay has a YouTube key. */
  protected readonly youtubeUnavailable = computed(
    () => this.player.current()?.source === 'catalog' && !this.relay.youtubeReady(),
  );

  /** Value shown while the user drags the seek slider; null when not dragging. */
  protected readonly dragValue = signal<number | null>(null);
  protected readonly shownTime = computed(() => this.dragValue() ?? this.player.time());
  protected readonly remaining = computed(() =>
    formatTime(Math.max(0, this.player.duration() - this.shownTime())),
  );
  protected readonly progressPct = computed(() => {
    const d = this.player.duration();
    return d > 0 ? (this.shownTime() / d) * 100 : 0;
  });
  protected readonly volumePct = computed(() => (this.player.muted() ? 0 : this.player.volume() * 100));
  protected readonly repeatLabel = computed(() =>
    ({ off: 'Repeat', all: 'Repeat all', one: 'Repeat one' })[this.player.repeat()],
  );
  protected readonly volumeIcon = computed(() => {
    const v = this.player.muted() ? 0 : this.player.volume();
    return v === 0 ? 'fa-volume-xmark' : v < 0.5 ? 'fa-volume-low' : 'fa-volume-high';
  });

  protected readonly formatTime = formatTime;

  protected onSeekInput(event: Event): void {
    this.dragValue.set(Number((event.target as HTMLInputElement).value));
  }

  protected onSeekChange(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
    this.dragValue.set(null);
  }

  protected onVolume(event: Event): void {
    this.player.setVolume(Number((event.target as HTMLInputElement).value) / 100);
  }
}
