import { Injectable, Signal, effect, inject, signal } from '@angular/core';
import { Rgb, darkenForText, luminance, rgbToCss } from './color';

export const DEFAULT_TINT = 'var(--surface-2)';
const SAMPLE = 16;

/** Average colour of an image, darkened for readable white text. Cached per URL. */
@Injectable({ providedIn: 'root' })
export class ArtworkColorService {
  private readonly cache = new Map<string, Promise<string>>();

  colorFor(url: string | null | undefined): Promise<string> {
    if (!url) return Promise.resolve(DEFAULT_TINT);
    let hit = this.cache.get(url);
    if (!hit) {
      hit = this.sample(url);
      this.cache.set(url, hit);
    }
    return hit;
  }

  private sample(url: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onerror = () => resolve(DEFAULT_TINT);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = SAMPLE;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) return resolve(DEFAULT_TINT);
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data; // throws if the canvas is tainted
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            const px: Rgb = [data[i], data[i + 1], data[i + 2]];
            const l = luminance(px);
            if (l > 0.9 || l < 0.05) continue; // skip near-white and near-black
            r += px[0];
            g += px[1];
            b += px[2];
            n++;
          }
          if (!n) return resolve(DEFAULT_TINT);
          resolve(rgbToCss(darkenForText([Math.round(r / n), Math.round(g / n), Math.round(b / n)])));
        } catch {
          resolve(DEFAULT_TINT);
        }
      };
      img.src = url;
    });
  }
}

/** Signal of the artwork colour for a changing image URL. Call in an injection context. */
export function artworkColor(url: Signal<string | null | undefined>): Signal<string> {
  const service = inject(ArtworkColorService);
  const color = signal(DEFAULT_TINT);
  effect((onCleanup) => {
    const current = url();
    let stale = false;
    onCleanup(() => (stale = true)); // a newer URL wins even if its colour resolves first
    service.colorFor(current).then((c) => {
      // Light themes blend the colour into the page (--tint-mix) so dark text stays readable on it.
      if (!stale) color.set(c === DEFAULT_TINT ? c : `color-mix(in srgb, ${c} var(--tint-mix), var(--bg))`);
    });
  });
  return color.asReadonly();
}
