import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { TabBar } from './layout/tab-bar/tab-bar';
import { LibrarySidebar } from './layout/library-sidebar/library-sidebar';
import { PlayerBar } from './layout/player-bar/player-bar';
import { RightPanel } from './layout/right-panel/right-panel';
import { QueueView } from './layout/right-panel/queue-view';
import { MiniPlayer } from './layout/mini-player/mini-player';
import { NowPlayingSheet } from './layout/now-playing-sheet/now-playing-sheet';
import { Toast } from './shared/toast/toast';
import { TrackMenu } from './shared/add-to-playlist/add-to-playlist';
import { VideoDock } from './layout/video-dock/video-dock';
import { PlayerService } from './state/player.service';
import { ToastService } from './state/toast.service';
import { ShortcutsService } from './state/shortcuts.service';
import { artworkColor } from './shared/utils/artwork-color';
import { LayoutService } from './state/layout.service';
import { PanelStateService } from './state/panel-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, TabBar, LibrarySidebar, PlayerBar, MiniPlayer, NowPlayingSheet, Toast, TrackMenu, RightPanel, QueueView, VideoDock],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly layout = inject(LayoutService);
  protected readonly panel = inject(PanelStateService);
  private readonly player = inject(PlayerService);
  private readonly toast = inject(ToastService);

  /** Phone: full-screen player open. */
  protected readonly sheetOpen = signal(false);
  /** Phone sheet background, sampled from the current artwork. */
  protected readonly sheetColor = artworkColor(computed(() => this.player.current()?.artwork.small));
  /** Phone: full-screen queue. */
  protected readonly queueOpen = signal(false);

  constructor() {
    inject(ShortcutsService).start();
    effect(() => {
      const message = this.player.error();
      if (message) this.toast.show(message);
    });
    effect(() => {
      const notice = this.player.notice();
      if (notice) this.toast.show(notice);
    });
    effect(() => {
      // The sheet only exists on phones.
      if (this.layout.mode() !== 'phone') {
        this.sheetOpen.set(false);
        this.queueOpen.set(false);
      }
    });
  }
}
