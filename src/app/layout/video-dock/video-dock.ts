import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { LayoutService } from '../../state/layout.service';
import { VideoDockService } from '../../state/video-dock.service';

const HEADER = 32;
const DESKTOP_SIZE = 240;
const PHONE_SIZE = 200;
const MARGIN = 16;
const PHONE_MARGIN = 12;
const PLAYER_BAR = 90;
const PHONE_BOTTOM = 56 + 64; // tab bar + mini player
const CORNERS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'] as const;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Places the one YouTube player (VideoDockService.host) where it may be seen:
 * over the active video slot, or in a small floating card. Its controls live in a
 * header strip *above* the video, so nothing ever covers the player.
 */
@Component({
  selector: 'app-video-dock',
  template: `
    @if (floatingBox(); as box) {
      <div
        class="card"
        role="region"
        aria-label="Video player"
        [style.left.px]="box.left"
        [style.top.px]="box.top - header"
        [style.width.px]="box.width"
      >
        <span class="label">Playing via YouTube</span>
        @if (isPhone()) {
          <button type="button" class="close" aria-label="Close video and pause" (click)="closeCard()">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        } @else {
          <button type="button" class="move" aria-label="Move video to another corner" (click)="moveCorner()">
            <i class="fa-solid fa-up-down-left-right" aria-hidden="true"></i>
          </button>
          <button type="button" class="open-panel" aria-label="Open now playing" (click)="panel.open('now-playing')">
            <i class="fa-solid fa-table-columns" aria-hidden="true"></i>
          </button>
        }
      </div>
    }
  `,
  styles: `
    .card {
      position: fixed;
      z-index: 110;
      display: flex;
      align-items: center;
      gap: 4px;
      height: 32px;
      padding: 0 4px 0 10px;
      border-radius: var(--radius-m) var(--radius-m) 0 0;
      background: var(--surface-2);
      box-shadow: 0 -4px 16px var(--scrim);
    }
    .label {
      flex: 1;
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      &:hover {
        color: var(--text);
        background: var(--hover);
      }
    }
  `,
})
export class VideoDock {
  private readonly player = inject(PlayerService);
  private readonly dock = inject(VideoDockService);
  private readonly layout = inject(LayoutService);
  protected readonly panel = inject(PanelStateService);

  protected readonly header = HEADER;
  private readonly corner = signal(0);
  /** Bumped on scroll/resize so positions are recomputed. */
  private readonly tick = signal(0);

  protected readonly isPhone = computed(() => this.layout.mode() === 'phone');
  private readonly isCatalog = computed(() => this.player.current()?.source === 'catalog');

  /** The floating card's video area, or null when the video sits in a slot or is hidden. */
  protected readonly floatingBox = computed<Box | null>(() => {
    this.tick();
    if (!this.isCatalog() || this.dock.activeSlot()) return null;
    if (this.isPhone()) {
      if (this.dock.floatingClosed()) return null;
      return {
        left: window.innerWidth - PHONE_SIZE - PHONE_MARGIN,
        top: window.innerHeight - PHONE_BOTTOM - PHONE_MARGIN - PHONE_SIZE,
        width: PHONE_SIZE,
        height: PHONE_SIZE,
      };
    }
    const corner = CORNERS[this.corner()];
    const left = corner.endsWith('right') ? window.innerWidth - DESKTOP_SIZE - MARGIN : MARGIN;
    const top = corner.startsWith('bottom')
      ? window.innerHeight - PLAYER_BAR - MARGIN - DESKTOP_SIZE
      : 64 + MARGIN + HEADER; // below the navbar, leaving room for the header strip
    return { left, top, width: DESKTOP_SIZE, height: DESKTOP_SIZE };
  });

  constructor() {
    const bump = () => this.tick.update((n) => n + 1);
    window.addEventListener('resize', bump);
    document.addEventListener('scroll', bump, true); // capture: panels scroll inside their own boxes
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('resize', bump);
      document.removeEventListener('scroll', bump, true);
    });

    effect(() => this.place());
  }

  protected moveCorner(): void {
    this.corner.update((c) => (c + 1) % CORNERS.length);
  }

  protected closeCard(): void {
    // PlayerService pauses YouTube as soon as it can no longer be seen.
    this.dock.floatingClosed.set(true);
  }

  private place(): void {
    this.tick();
    const host = this.dock.host;
    const slot = this.dock.activeSlot();
    let box: Box | null = null;
    if (this.isCatalog()) {
      if (slot) {
        const r = slot.getBoundingClientRect();
        box = { left: r.left, top: r.top, width: r.width, height: r.height };
      } else {
        box = this.floatingBox();
      }
    }
    if (!box) {
      host.style.display = 'none';
      return;
    }
    Object.assign(host.style, {
      display: 'block',
      position: 'fixed',
      zIndex: '110',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      overflow: 'hidden',
      borderRadius: slot ? 'var(--radius-m)' : '0 0 var(--radius-m) var(--radius-m)',
      background: 'var(--video-bg)',
    });
  }
}
