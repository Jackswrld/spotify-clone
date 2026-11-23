import { TestBed } from '@angular/core/testing';
import { Cover } from './cover';

function render(src: string | null) {
  const fixture = TestBed.createComponent(Cover);
  fixture.componentRef.setInput('src', src);
  fixture.componentRef.setInput('seed', 'seed-1');
  fixture.componentRef.setInput('alt', 'Cover art');
  fixture.detectChanges();
  return fixture;
}

describe('Cover', () => {
  it('shows the image when src is set', () => {
    const el = render('https://cdn.test/a.jpg').nativeElement as HTMLElement;
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://cdn.test/a.jpg');
    expect(el.querySelector('.fallback')).toBeNull();
  });

  it('falls back to a gradient when src is null', () => {
    const el = render(null).nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    const fallback = el.querySelector('.fallback') as HTMLElement;
    expect(fallback.style.background).toContain('linear-gradient');
  });

  it('falls back to a gradient after an img error event', () => {
    const fixture = render('https://cdn.test/broken.jpg');
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.fallback')).toBeTruthy();
  });
});
