import { contrastWithWhite, darkenForText, rgbToCss } from './color';

describe('color utils', () => {
  it('darkenForText yields contrast >= 4.5 against white', () => {
    for (const c of [
      [255, 255, 0],
      [200, 200, 200],
      [255, 255, 255],
      [29, 185, 84],
    ] as [number, number, number][]) {
      expect(contrastWithWhite(darkenForText(c))).withContext(String(c)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('darkenForText leaves an already-dark colour unchanged', () => {
    expect(darkenForText([20, 20, 20])).toEqual([20, 20, 20]);
    expect(darkenForText([10, 10, 10])).toEqual([10, 10, 10]);
  });

  it('darkenForText keeps the hue (scales channels together)', () => {
    const [r, g, b] = darkenForText([255, 128, 0]);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('rgbToCss formats a colour', () => {
    expect(rgbToCss([1, 2, 3])).toBe('rgb(1 2 3)');
  });
});
