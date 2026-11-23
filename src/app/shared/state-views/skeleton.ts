import { Component, computed, input } from '@angular/core';

/** Grey placeholder blocks shown while data loads. */
@Component({
  selector: 'app-skeleton',
  template: `
    @for (i of items(); track i) {
      <div class="block" [class]="shape()" aria-hidden="true">
        @if (shape() === 'card') {
          <div class="art"></div>
          <div class="line"></div>
          <div class="line short"></div>
        } @else if (shape() === 'row') {
          <div class="art small"></div>
          <div class="lines">
            <div class="line"></div>
            <div class="line short"></div>
          </div>
        } @else {
          <div class="line"></div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .block {
      animation: pulse 1.4s ease-in-out infinite;
    }
    .card {
      flex: 0 0 180px;
      padding: 12px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
    }
    .lines {
      flex: 1;
    }
    .art {
      aspect-ratio: 1;
      border-radius: var(--radius-m);
      background: var(--surface-2);
      margin-bottom: 10px;
    }
    .art.small {
      width: 40px;
      margin: 0;
      border-radius: var(--radius-s);
    }
    .line {
      height: 12px;
      margin: 6px 0;
      border-radius: 6px;
      background: var(--surface-2);
    }
    .short {
      width: 60%;
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
  `,
})
export class Skeleton {
  readonly shape = input<'card' | 'row' | 'text'>('card');
  readonly count = input(1);
  protected readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
