export type Rgb = [number, number, number];

const MIN_CONTRAST = 4.5;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between white text and this background. */
export function contrastWithWhite(rgb: Rgb): number {
  return 1.05 / (luminance(rgb) + 0.05);
}

/** Darkens a colour (keeping its hue) until white text on it has ≥ 4.5:1 contrast. */
export function darkenForText(rgb: Rgb): Rgb {
  let out: Rgb = [...rgb];
  for (let i = 0; i < 60 && contrastWithWhite(out) < MIN_CONTRAST; i++) {
    out = out.map((c) => Math.floor(c * 0.9)) as Rgb;
  }
  return out;
}

export function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}
