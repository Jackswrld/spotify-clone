import { TestBed } from '@angular/core/testing';
import { ThemePicker } from './theme-picker';
import { ThemeService } from '../../state/theme.service';

describe('ThemePicker', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  function setup() {
    const fixture = TestBed.createComponent(ThemePicker);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('button.palette')!;
    return { fixture, el, button, themes: TestBed.inject(ThemeService) };
  }

  it('opens a list of themes from the palette button', () => {
    const t = setup();
    expect(t.el.querySelector('[role="radiogroup"]')).toBeNull();
    t.button.click();
    t.fixture.detectChanges();
    expect(t.button.getAttribute('aria-expanded')).toBe('true');
    expect(t.el.querySelectorAll('[role="radio"]').length).toBeGreaterThan(5);
    expect(t.el.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toContain('Classic');
  });

  it('picking a theme applies it and marks it chosen', () => {
    const t = setup();
    t.button.click();
    t.fixture.detectChanges();
    const pink = [...t.el.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => b.textContent?.includes('Blossom'))!;
    pink.click();
    t.fixture.detectChanges();
    expect(t.themes.theme().id).toBe('blossom');
    expect(pink.getAttribute('aria-checked')).toBe('true');
  });

  it('Escape closes the list', () => {
    const t = setup();
    t.button.click();
    t.fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    t.fixture.detectChanges();
    expect(t.el.querySelector('[role="radiogroup"]')).toBeNull();
  });
});
