import { Component, computed, inject, output } from '@angular/core';
import { PlayerService } from '../../state/player.service';
import { Cover } from '../../shared/cover/cover';

/** Phone: compact player above the tab bar. Tapping it opens the full sheet. */
@Component({
  selector: 'app-mini-player',
  imports: [Cover],
  template: `
    @if (player.current(); as track) {
      <div class="mini">
        <div class="progress" [style.width.%]="progressPct()"></div>
        <button type="button" class="open" (click)="open.emit()" [attr.aria-label]="'Open player: ' + track.title">
          <app-cover class="art" [src]="track.artwork.small" [seed]="track.id" />
          <span class="meta">
            <span class="title">{{ track.title }}</span>
            <span class="artist">{{ track.artistName }}</span>
          </span>
        </button>
        <button
          type="button"
          class="play"
          [attr.aria-label]="player.isPlaying() ? 'Pause' : 'Play'"
          (click)="player.toggle()"
        >
          <i class="fa-solid" [class.fa-pause]="player.isPlaying()" [class.fa-play]="!player.isPlaying()" aria-hidden="true"></i>
        </button>
      </div>
    }
  `,
  styles: `
    @use 'ui';
    .mini {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      height: var(--mini-h);
      margin: 0 8px;
      padding: 0 4px 0 8px;
      border-radius: var(--radius-m);
      background: var(--surface-2);
      overflow: hidden;
    }
    .progress {
      position: absolute;
      top: 0;
      left: 0;
      height: 2px;
      background: var(--text);
    }
    .open {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      min-height: var(--tap);
      border: 0;
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .art {
      width: 44px;
      flex: 0 0 44px;
    }
    .meta {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .title {
      @include ui.truncate;
      font-size: 14px;
      font-weight: 600;
    }
    .artist {
      @include ui.truncate;
      font-size: 12px;
      color: var(--text-muted);
    }
    .play {
      @include ui.icon-button(var(--tap));
      color: var(--text);
      font-size: 20px;
    }
  `,
})
export class MiniPlayer {
  protected readonly player = inject(PlayerService);
  readonly open = output<void>();

  protected readonly progressPct = computed(() => {
    const d = this.player.duration();
    return d > 0 ? (this.player.time() / d) * 100 : 0;
  });
}
