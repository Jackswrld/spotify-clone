import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

const MIN_SIZE = 200;
/** Sub-pixel rounding allowance when comparing rectangles. */
const EPSILON = 1;

function inside(r: DOMRect, box: { left: number; top: number; right: number; bottom: number }): boolean {
  return (
    r.left >= box.left - EPSILON &&
    r.top >= box.top - EPSILON &&
    r.right <= box.right + EPSILON &&
    r.bottom <= box.bottom + EPSILON
  );
}

/**
 * True when the whole element can be seen: inside the window and not clipped by any
 * scrolling or clipping ancestor (e.g. the right panel scrolled down to the lyrics).
 */
function fullyVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (!inside(r, { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight })) return false;
  for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      if (!inside(r, parent.getBoundingClientRect())) return false;
    }
  }
  return true;
}

interface Slot {
  el: HTMLElement;
  priority: number;
}

/**
 * Where the YouTube player may appear, and whether it can be seen right now.
 * YouTube's rules: the player must be visible on the page the user is viewing and at
 * least 200×200, so the app only plays YouTube songs while `canShow()` is true.
 *
 * There is exactly one player element (`host`). It is never moved in the DOM (that would
 * reload the iframe); the VideoDock component positions it over the active slot instead.
 */
@Injectable({ providedIn: 'root' })
export class VideoDockService {
  private readonly doc = inject(DOCUMENT);
  private readonly slots = signal<Slot[]>([]);
  /** Bumped when layout may have changed (slot added/removed, resize). */
  private readonly layoutTick = signal(0);
  private readonly pageVisible = signal(true);

  /** The single element that hosts the YouTube iframe. */
  readonly host: HTMLElement;
  /** Phone: the floating card was closed with ×. Reset when a slot opens. */
  readonly floatingClosed = signal(false);

  readonly activeSlot = computed<HTMLElement | null>(() => {
    this.layoutTick();
    const usable = this.slots()
      .filter(({ el }) => {
        if (!el.isConnected) return false;
        const r = el.getBoundingClientRect();
        return r.width >= MIN_SIZE && r.height >= MIN_SIZE && fullyVisible(el);
      })
      .sort((a, b) => b.priority - a.priority);
    return usable[0]?.el ?? null;
  });

  /** True when a YouTube player could be visible to the user right now. */
  readonly canShow = computed(() => this.pageVisible() && (this.activeSlot() !== null || !this.floatingClosed()));

  constructor() {
    this.host = this.doc.createElement('div');
    this.host.className = 'yt-host';
    this.doc.body.appendChild(this.host);

    this.pageVisible.set(this.doc.visibilityState !== 'hidden');
    this.doc.addEventListener('visibilitychange', () => {
      this.pageVisible.set(this.doc.visibilityState !== 'hidden');
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.relayout());
      // Capture: element scrolls (panels, the phone sheet) don't bubble but reach window in capture.
      window.addEventListener('scroll', () => this.relayout(), true);
    }
  }

  /** A place where the video should appear; higher priority wins. Returns an unregister function. */
  registerSlot(el: HTMLElement, priority: number): () => void {
    const slot = { el, priority };
    this.slots.update((list) => [...list, slot]);
    this.floatingClosed.set(false);
    return () => this.slots.update((list) => list.filter((s) => s !== slot));
  }

  relayout(): void {
    this.layoutTick.update((n) => n + 1);
  }
}
