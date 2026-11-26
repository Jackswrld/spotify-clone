import { TestBed } from '@angular/core/testing';
import { THEMES, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;
  beforeEach(() => {
    localStorage.clear();
    delete root.dataset['theme'];
  });
  afterEach(() => {
    localStorage.clear();
    delete root.dataset['theme'];
  });

  const make = () => TestBed.inject(ThemeService);

  it('starts on the classic green-on-black theme', () => {
    const s = make();
    expect(s.theme().id).toBe('classic');
    expect(root.dataset['theme']).toBe('classic');
  });

  it('switches the site colours and remembers the choice for next time', () => {
    make().set('blossom');
    expect(root.dataset['theme']).toBe('blossom');
    expect(root.style.colorScheme).toBe('light');
    TestBed.resetTestingModule();
    expect(make().theme().id).toBe('blossom');
  });

  it('ignores an unknown saved theme', () => {
    localStorage.setItem('theme', JSON.stringify('neon-nope'));
    expect(make().theme().id).toBe('classic');
  });

  it('offers white & pink and black & blue among light and dark themes', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('blossom');
    expect(ids).toContain('midnight');
    expect(THEMES.some((t) => t.mode === 'light')).toBeTrue();
    expect(THEMES.some((t) => t.mode === 'dark')).toBeTrue();
  });

  it('every theme has its colours defined in the stylesheet', () => {
    for (const t of THEMES) {
      root.dataset['theme'] = t.id;
      const accent = getComputedStyle(root).getPropertyValue('--accent').trim().toLowerCase();
      expect(accent).withContext(t.id).toBe(t.swatch[1]);
    }
  });
});
