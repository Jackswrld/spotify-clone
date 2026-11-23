import { Component, inject } from '@angular/core';
import { PanelStateService } from '../../state/panel-state.service';
import { NowPlayingView } from './now-playing-view';
import { QueueView } from './queue-view';

/** Desktop/tablet right column: Now playing or Queue. */
@Component({
  selector: 'app-right-panel',
  imports: [NowPlayingView, QueueView],
  template: `
    @if (panel.view(); as view) {
      <div class="panel">
        <header class="head">
          <h2>{{ view === 'queue' ? 'Queue' : 'Now playing' }}</h2>
          <button type="button" class="close" [attr.aria-label]="'Close ' + (view === 'queue' ? 'queue' : 'now playing')" (click)="panel.close()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </header>
        <div class="content">
          @if (view === 'queue') {
            <app-queue-view />
          } @else {
            <app-now-playing-view />
          }
        </div>
      </div>
    }
  `,
  styles: `
    @use 'ui';
    :host {
      display: block;
      height: 100%;
    }
    .panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      h2 {
        font-size: 16px;
        font-weight: 700;
      }
    }
    .close {
      @include ui.icon-button(32px);
    }
    .content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
  `,
})
export class RightPanel {
  protected readonly panel = inject(PanelStateService);
}
