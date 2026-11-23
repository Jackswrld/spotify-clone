import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar';
import { Library } from './library/library';
import { NowPlayingPanelComponent } from './components/now-playing-panel/now-playing-panel';
import { NowPlayingBarComponent } from './components/now-playing-bar/now-playing-bar';
import { PanelStateService } from './services/panel-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, Library, NowPlayingPanelComponent, NowPlayingBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly panelState = inject(PanelStateService);

  // The async pipe in the template subscribes to this shared panel state and unsubscribes automatically.
  readonly isPanelOpen$ = this.panelState.isPanelOpen$;

  readonly openNowPlayingLabel = 'Open now playing panel';

  openNowPlayingPanel(): void {
    this.panelState.setPanelState(true);
  }
}
