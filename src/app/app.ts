import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { TabBar } from './layout/tab-bar/tab-bar';
import { LibrarySidebar } from './layout/library-sidebar/library-sidebar';
import { PlayerBar } from './layout/player-bar/player-bar';
import { MiniPlayer } from './layout/mini-player/mini-player';
import { NowPlayingSheet } from './layout/now-playing-sheet/now-playing-sheet';
import { Toast } from './shared/toast/toast';
import { TrackMenu } from './shared/add-to-playlist/add-to-playlist';
import { PlayerService } from './state/player.service';
import { ToastService } from './state/toast.service';
import { LayoutService } from './state/layout.service';
import { PanelStateService } from './state/panel-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, TabBar, LibrarySidebar, PlayerBar, MiniPlayer, NowPlayingSheet, Toast, TrackMenu],
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

  constructor() {
    effect(() => {
      const message = this.player.error();
      if (message) this.toast.show(message);
    });
    effect(() => {
      // The sheet only exists on phones.
      if (this.layout.mode() !== 'phone') this.sheetOpen.set(false);
    });
  }
}
