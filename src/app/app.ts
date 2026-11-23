import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './layout/navbar/navbar';
import { TabBar } from './layout/tab-bar/tab-bar';
import { Library } from './library/library';
import { NowPlayingBarComponent } from './components/now-playing-bar/now-playing-bar';
import { LayoutService } from './state/layout.service';
import { PanelStateService } from './state/panel-state.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, TabBar, Library, NowPlayingBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly layout = inject(LayoutService);
  protected readonly panel = inject(PanelStateService);
}
