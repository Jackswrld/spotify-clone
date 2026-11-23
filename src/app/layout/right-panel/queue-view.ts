import { Component, inject } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { PlayerService } from '../../state/player.service';
import { TrackRow } from '../../shared/track-row/track-row';

/** Now playing + reorderable "Next up". */
@Component({
  selector: 'app-queue-view',
  imports: [TrackRow, CdkDropList, CdkDrag, CdkDragHandle],
  template: `
    @if (player.current(); as current) {
      <section class="now" aria-label="Now playing">
        <h3>Now playing</h3>
        <app-track-row [track]="current" [index]="player.index()" />
      </section>
    }

    <section class="next" aria-label="Next up">
      <div class="next-head">
        <h3>Next up</h3>
        @if (player.upNext().length) {
          <button type="button" class="clear" (click)="player.clearQueue()">Clear queue</button>
        }
      </div>
      @if (player.upNext().length) {
        <div cdkDropList (cdkDropListDropped)="drop($event)">
          @for (t of player.upNext(); track $index; let i = $index) {
            <div class="drag-row" cdkDrag cdkDragLockAxis="y">
              <span class="handle" cdkDragHandle aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span>
              <app-track-row class="row" [track]="t" [index]="player.index() + 1 + i" (play)="playAt(i)" />
              <button type="button" class="remove" [attr.aria-label]="'Remove ' + t.title + ' from queue'" (click)="remove(i)">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </div>
          }
        </div>
      } @else {
        <p class="empty">Your queue is empty</p>
      }
    </section>
  `,
  styles: `
    @use 'ui';
    :host {
      display: block;
      padding: 0 8px 16px;
    }
    h3 {
      font-size: 15px;
      font-weight: 700;
      padding: 12px 8px 4px;
    }
    .next-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .clear {
      border: 0;
      background: none;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 12px 8px 4px;
      &:hover {
        color: var(--text);
      }
    }
    .drag-row {
      display: flex;
      align-items: center;
      background: var(--surface-1);
    }
    .row {
      flex: 1;
      min-width: 0;
    }
    .handle {
      display: grid;
      place-items: center;
      width: 20px;
      color: var(--text-muted);
      cursor: grab;
    }
    .remove {
      @include ui.icon-button(var(--tap));
    }
    .empty {
      padding: 16px 8px;
      color: var(--text-muted);
      font-size: 14px;
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
  `,
})
export class QueueView {
  protected readonly player = inject(PlayerService);

  /** View indices are relative to "Next up"; the queue continues after the current track. */
  private toQueueIndex(viewIndex: number): number {
    return this.player.index() + 1 + viewIndex;
  }

  protected drop(event: Pick<CdkDragDrop<unknown>, 'previousIndex' | 'currentIndex'>): void {
    this.player.moveInQueue(this.toQueueIndex(event.previousIndex), this.toQueueIndex(event.currentIndex));
  }

  protected remove(viewIndex: number): void {
    this.player.removeFromQueue(this.toQueueIndex(viewIndex));
  }

  protected playAt(viewIndex: number): void {
    this.player.playTracks(this.player.queue(), this.toQueueIndex(viewIndex));
  }
}
