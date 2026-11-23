import { Component, computed, effect, input, signal } from '@angular/core';
import { gradientFor } from '../utils/gradient';

/** Artwork image, or a generated gradient when there is none or it fails to load. */
@Component({
  selector: 'app-cover',
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" (error)="failed.set(true)" />
    } @else {
      <div class="fallback" [style.background]="gradient()" role="img" [attr.aria-label]="alt() || null">
        <i class="fa-solid fa-music" aria-hidden="true"></i>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: var(--radius-s);
      background: var(--surface-2);
    }
    :host(.round) {
      border-radius: 50%;
    }
    img,
    .fallback {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fallback {
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: clamp(12px, 30%, 48px);
    }
  `,
  host: { '[class.round]': 'round()' },
})
export class Cover {
  readonly src = input<string | null>(null);
  readonly seed = input('');
  readonly alt = input('');
  readonly round = input(false);

  protected readonly failed = signal(false);
  protected readonly gradient = computed(() => gradientFor(this.seed()));

  constructor() {
    // A new image gets a fresh chance to load.
    effect(() => {
      this.src();
      this.failed.set(false);
    });
  }
}
