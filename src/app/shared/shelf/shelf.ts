import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { LayoutService } from '../../state/layout.service';
import { Skeleton } from '../state-views/skeleton';
import { ErrorState } from '../state-views/error-state';

/** A titled horizontal row of cards with its own scroll arrows. */
@Component({
  selector: 'app-shelf',
  imports: [Skeleton, ErrorState],
  template: `
    @if (loading() || error() || count() > 0) {
      <section [attr.aria-label]="title()">
        <header class="head">
          <div>
            @if (subtitle()) {
              <p class="sub">{{ subtitle() }}</p>
            }
            <h2>{{ title() }}</h2>
          </div>
          @if (layout.mode() !== 'phone' && !loading() && !error()) {
            <div class="arrows">
              <button type="button" aria-label="Scroll left" (click)="scroll(-1)">
                <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              </button>
              <button type="button" aria-label="Scroll right" (click)="scroll(1)">
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
          }
        </header>

        @if (error(); as message) {
          <app-error-state [message]="message" (retry)="retry.emit()" />
        } @else {
          <div class="row" #row>
            @if (loading()) {
              <app-skeleton shape="card" [count]="6" />
            } @else {
              <ng-content />
            }
          </div>
        }
      </section>
    }
  `,
  styles: `
    @use 'ui';
    section {
      margin-bottom: 32px;
    }
    .head {
      @include ui.section-header;
    }
    h2 {
      font-size: 22px;
      font-weight: 700;
    }
    .sub {
      font-size: 13px;
      color: var(--text-muted);
    }
    .arrows {
      display: flex;
      gap: 8px;
    }
    .arrows button {
      @include ui.icon-button(32px);
      background: var(--surface-2);
      color: var(--text);
    }
    .row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      margin: 0 -12px;
      padding: 0 12px;
      &::-webkit-scrollbar {
        display: none;
      }
    }
  `,
})
export class Shelf {
  protected readonly layout = inject(LayoutService);

  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Number of projected items; the shelf hides itself when there are none. */
  readonly count = input.required<number>();
  readonly retry = output<void>();

  private readonly row = viewChild<ElementRef<HTMLElement>>('row');

  protected scroll(direction: 1 | -1): void {
    const el = this.row()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }
}
