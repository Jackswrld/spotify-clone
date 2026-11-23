import { Component, ElementRef, effect, input, output, viewChildren } from '@angular/core';
import { LyricLine } from '../../core/models';

const MANUAL_SCROLL_PAUSE_MS = 3000;

/** Synced lyric lines: the active one is large and bright, clicking a line seeks to it. */
@Component({
  selector: 'app-lyrics-lines',
  template: `
    <div class="lines" [class.compact]="compact()" (wheel)="pauseAutoScroll()" (touchmove)="pauseAutoScroll()">
      @for (line of lines(); track $index; let i = $index) {
        <button
          #line
          type="button"
          class="line"
          [class.active]="i === activeIndex()"
          [class.past]="i < activeIndex()"
          [attr.aria-current]="i === activeIndex() ? 'true' : null"
          (click)="seek.emit(line.time)"
        >
          {{ line.text || '♪' }}
        </button>
      }
    </div>
  `,
  styles: `
    .lines {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .line {
      border: 0;
      background: none;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      text-align: left;
      color: var(--text);
      opacity: 0.5;
      cursor: pointer;
      transition: opacity 0.2s, font-size 0.2s;
      &:hover {
        opacity: 0.85;
        text-decoration: underline;
      }
    }
    .past {
      opacity: 0.35;
    }
    .active {
      font-size: 28px;
      opacity: 1;
    }
    .compact {
      max-height: calc(8 * 2.2em);
      overflow-y: auto;
      .line {
        font-size: 18px;
      }
      .active {
        font-size: 20px;
      }
    }
    @media (max-width: 767.98px) {
      .line {
        font-size: 18px;
      }
      .active {
        font-size: 22px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .line {
        transition: none;
      }
    }
  `,
})
export class LyricsLines {
  readonly lines = input.required<LyricLine[]>();
  readonly activeIndex = input(-1);
  readonly compact = input(false);
  readonly seek = output<number>();

  private readonly lineEls = viewChildren<ElementRef<HTMLElement>>('line');
  private pausedUntil = 0;

  constructor() {
    effect(() => {
      const index = this.activeIndex();
      const el = this.lineEls()[index]?.nativeElement;
      if (!el || Date.now() < this.pausedUntil) return;
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    });
  }

  protected pauseAutoScroll(): void {
    this.pausedUntil = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  }
}
