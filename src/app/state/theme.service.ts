import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { safeStorage } from './safe-storage';

export interface Theme {
  id: string;
  name: string;
  /** What it looks like, for the picker's label. */
  description: string;
  mode: 'dark' | 'light';
  /** [background, accent], shown as the theme's swatch. Must match styles/_themes.scss. */
  swatch: [string, string];
}

/** Every theme's text passes WCAG AA contrast (4.5:1) on its backgrounds and buttons. */
export const THEMES: readonly Theme[] = [
  { id: 'classic', name: 'Classic', description: 'Black & green', mode: 'dark', swatch: ['#121212', '#1db954'] },
  { id: 'midnight', name: 'Midnight', description: 'Black & blue', mode: 'dark', swatch: ['#0b0f19', '#3b9bff'] },
  { id: 'amethyst', name: 'Amethyst', description: 'Black & purple', mode: 'dark', swatch: ['#120d1a', '#b18cff'] },
  { id: 'sunset', name: 'Sunset', description: 'Black & orange', mode: 'dark', swatch: ['#15100c', '#ff8a3d'] },
  { id: 'ocean', name: 'Ocean', description: 'Black & teal', mode: 'dark', swatch: ['#0a1414', '#2dd4bf'] },
  { id: 'crimson', name: 'Crimson', description: 'Black & red', mode: 'dark', swatch: ['#140b0d', '#ff5c74'] },
  { id: 'daylight', name: 'Daylight', description: 'White & green', mode: 'light', swatch: ['#ffffff', '#0f7d3b'] },
  { id: 'blossom', name: 'Blossom', description: 'White & pink', mode: 'light', swatch: ['#fff8fb', '#c2185b'] },
  { id: 'sky', name: 'Sky', description: 'White & blue', mode: 'light', swatch: ['#f8fbff', '#1d63d8'] },
];

const KEY = 'theme';

/** The site's colour theme: applied as <html data-theme="…"> and remembered on this device. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly id = signal(this.saved());

  readonly themes = THEMES;
  readonly theme = computed(() => THEMES.find((t) => t.id === this.id()) ?? THEMES[0]);

  constructor() {
    this.apply();
  }

  set(id: string): void {
    if (!THEMES.some((t) => t.id === id)) return;
    this.id.set(id);
    safeStorage.set(KEY, id);
    this.apply();
  }

  private saved(): string {
    const id = safeStorage.get<unknown>(KEY, THEMES[0].id);
    return THEMES.some((t) => t.id === id) ? (id as string) : THEMES[0].id;
  }

  private apply(): void {
    const t = this.theme();
    this.root.dataset['theme'] = t.id;
    this.root.style.colorScheme = t.mode; // native scrollbars and form controls follow
    this.root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.swatch[0]);
  }
}
