import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerService } from '../../state/player.service';
import { ToastService } from '../../state/toast.service';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackMenuService } from '../../shared/add-to-playlist/track-menu.service';
import { formatTime } from '../../shared/utils/format';

/** Phone: full-screen player opened from the mini player. */
@Component({
  selector: 'app-now-playing-sheet',
  imports: [RouterLink, Cover, LikeButton],
  templateUrl: './now-playing-sheet.html',
  styleUrl: './now-playing-sheet.scss',
  host: { '(document:keydown.escape)': 'open() && close.emit()' },
})
export class NowPlayingSheet {
  protected readonly player = inject(PlayerService);
  private readonly toast = inject(ToastService);
  protected readonly trackMenu = inject(TrackMenuService);

  readonly open = input(false);
  /** Background colour; Task 15 passes the artwork colour. */
  readonly color = input('var(--surface-2)');
  readonly close = output<void>();
  readonly openQueue = output<void>();

  protected readonly dragValue = signal<number | null>(null);
  protected readonly shownTime = computed(() => this.dragValue() ?? this.player.time());
  protected readonly progressPct = computed(() => {
    const d = this.player.duration();
    return d > 0 ? (this.shownTime() / d) * 100 : 0;
  });
  protected readonly repeatLabel = computed(() =>
    ({ off: 'Repeat', all: 'Repeat all', one: 'Repeat one' })[this.player.repeat()],
  );
  protected readonly formatTime = formatTime;

  protected onSeekInput(event: Event): void {
    this.dragValue.set(Number((event.target as HTMLInputElement).value));
  }

  protected onSeekChange(event: Event): void {
    this.player.seek(Number((event.target as HTMLInputElement).value));
    this.dragValue.set(null);
  }

  protected async share(): Promise<void> {
    const track = this.player.current();
    if (!track) return;
    const url = `https://audius.co${track.permalink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: track.title, text: `${track.title} by ${track.artistName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        this.toast.show('Link copied');
      }
    } catch {
      // User cancelled the share sheet.
    }
  }
}
