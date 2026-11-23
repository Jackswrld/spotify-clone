import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout.service';
import { FakeMedia, installFakeMatchMedia } from './testing-media';

describe('LayoutService', () => {
  let media: FakeMedia;
  afterEach(() => media.restore());

  it('reports phone below 768px', () => {
    media = installFakeMatchMedia(375);
    expect(TestBed.inject(LayoutService).mode()).toBe('phone');
  });

  it('reports tablet at 800px and desktop at 1280px', () => {
    media = installFakeMatchMedia(800);
    expect(TestBed.inject(LayoutService).mode()).toBe('tablet');
    TestBed.resetTestingModule();
    media.restore();
    media = installFakeMatchMedia(1280);
    expect(TestBed.inject(LayoutService).mode()).toBe('desktop');
  });

  it('updates when the media query changes', () => {
    media = installFakeMatchMedia(1280);
    const layout = TestBed.inject(LayoutService);
    media.setWidth(500);
    expect(layout.mode()).toBe('phone');
    media.setWidth(900);
    expect(layout.mode()).toBe('tablet');
  });
});
