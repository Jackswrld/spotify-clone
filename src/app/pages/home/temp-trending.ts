import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';

/** TEMPORARY (Milestone 1): replaced by the real Home page in Task 6. */
@Component({
  selector: 'app-temp-trending',
  template: `
    <h1>Trending this week</h1>
    <ol>
      @for (track of tracks(); track track.id; let i = $index) {
        <li>
          <button type="button" (click)="player.playTracks(tracks(), i)">
            {{ track.title }} — {{ track.artistName }}
          </button>
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; padding: 24px; }
    h1 { margin-bottom: 16px; }
    button { border: 0; background: none; padding: 8px 0; cursor: pointer; text-align: left; }
    button:hover { text-decoration: underline; }
  `,
})
export class TempTrending {
  protected readonly player = inject(PlayerService);
  protected readonly tracks = toSignal(inject(AudiusApi).trendingTracks({ time: 'week', limit: 20 }), {
    initialValue: [],
  });
}
