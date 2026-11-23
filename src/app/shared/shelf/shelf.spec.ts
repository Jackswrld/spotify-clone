import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { Shelf } from './shelf';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

@Component({
  imports: [Shelf],
  template: `
    <app-shelf title="First" [count]="3"><div class="item">a</div></app-shelf>
    <app-shelf title="Second" [count]="3"><div class="item">b</div></app-shelf>
    <app-shelf
      title="Third"
      [count]="count()"
      [loading]="loading()"
      [error]="error()"
      (retry)="retries = retries + 1"
    ></app-shelf>
  `,
})
class Host {
  count = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);
  retries = 0;
}

describe('Shelf', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const shelves = [...(fixture.nativeElement as HTMLElement).querySelectorAll('app-shelf')] as HTMLElement[];
    return { fixture, host: fixture.componentInstance, shelves };
  }

  it('arrows scroll only their own row', () => {
    const { shelves } = setup();
    const row1 = shelves[0].querySelector('.row') as HTMLElement;
    const row2 = shelves[1].querySelector('.row') as HTMLElement;
    const spy1 = spyOn(row1, 'scrollBy');
    const spy2 = spyOn(row2, 'scrollBy');
    (shelves[1].querySelector('button[aria-label="Scroll right"]') as HTMLButtonElement).click();
    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  });

  it('shows skeletons when loading', () => {
    const { fixture, host, shelves } = setup();
    host.loading.set(true);
    fixture.detectChanges();
    expect(shelves[2].querySelectorAll('app-skeleton').length).toBeGreaterThan(0);
  });

  it('shows an error state with retry', () => {
    const { fixture, host, shelves } = setup();
    host.error.set("Couldn't load this.");
    fixture.detectChanges();
    expect(shelves[2].textContent).toContain("Couldn't load this.");
    (shelves[2].querySelector('button.retry') as HTMLButtonElement).click();
    expect(host.retries).toBe(1);
  });

  it('renders nothing when count is 0 and not loading', () => {
    const { shelves } = setup();
    expect(shelves[2].querySelector('section')).toBeNull();
  });

  it('hides arrows on phone', () => {
    media.setWidth(375);
    const { shelves } = setup();
    expect(shelves[0].querySelector('button[aria-label="Scroll right"]')).toBeNull();
  });
});
