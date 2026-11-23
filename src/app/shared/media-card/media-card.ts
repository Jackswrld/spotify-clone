import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Cover } from '../cover/cover';

/** Square card for a track, playlist or artist, with a hover play button. */
@Component({
  selector: 'app-media-card',
  imports: [RouterLink, Cover],
  template: `
    <div class="card">
      <a class="link" [routerLink]="link()">
        <app-cover [src]="image()" [seed]="seed()" [round]="round()" [alt]="''" />
        <span class="title">{{ title() }}</span>
        @if (subtitle()) {
          <span class="subtitle">{{ subtitle() }}</span>
        }
      </a>
      @if (playable()) {
        <button
          type="button"
          class="play"
          [attr.aria-label]="'Play ' + title()"
          (click)="$event.stopPropagation(); play.emit()"
        >
          <i class="fa-solid fa-play" aria-hidden="true"></i>
        </button>
      }
    </div>
  `,
  styles: `
    @use 'ui';
    :host {
      display: block;
      flex: 0 0 180px;
      min-width: 0;
      scroll-snap-align: start;
    }
    .card {
      @include ui.card;
      position: relative;
      background: transparent;
      height: 100%;
    }
    .link {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    app-cover {
      margin-bottom: 8px;
      box-shadow: 0 8px 24px var(--scrim);
    }
    .title {
      @include ui.truncate;
      font-weight: 600;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .play {
      @include ui.icon-button(48px);
      position: absolute;
      right: 20px;
      top: calc(180px - 24px - 64px);
      background: var(--accent);
      color: var(--on-accent);
      font-size: 18px;
      opacity: 0;
      transform: translateY(8px);
      box-shadow: 0 8px 16px var(--scrim);
      &:hover:not(:disabled) {
        background: var(--accent-hover);
        color: var(--on-accent);
        transform: scale(1.05);
      }
    }
    .card:hover .play,
    .card:focus-within .play {
      opacity: 1;
      transform: none;
    }
    @media (hover: none) {
      .play {
        opacity: 1;
        transform: none;
        width: var(--tap);
        height: var(--tap);
      }
    }
    @include ui.phone {
      :host {
        flex-basis: 150px;
      }
      .play {
        top: calc(150px - 24px - 56px);
      }
    }
  `,
})
export class MediaCard {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly image = input<string | null>(null);
  readonly seed = input('');
  readonly round = input(false);
  readonly link = input.required<unknown[] | string>();
  readonly playable = input(true);
  readonly play = output<void>();
}
