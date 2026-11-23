import { TestBed } from '@angular/core/testing';
import { PanelStateService } from './panel-state.service';
import { FakeMedia, installFakeMatchMedia } from './testing-media';

describe('PanelStateService', () => {
  let media: FakeMedia;
  afterEach(() => media.restore());

  it('toggle closes the same view and switches to another', () => {
    media = installFakeMatchMedia(1280);
    const s = TestBed.inject(PanelStateService);
    s.open('now-playing');
    s.toggle('queue');
    expect(s.view()).toBe('queue');
    s.toggle('queue');
    expect(s.view()).toBeNull();
  });

  it('starts open on desktop', () => {
    media = installFakeMatchMedia(1280);
    expect(TestBed.inject(PanelStateService).view()).toBe('now-playing');
  });

  it('starts closed on phone and tablet', () => {
    media = installFakeMatchMedia(375);
    expect(TestBed.inject(PanelStateService).view()).toBeNull();
  });

  it('close() closes', () => {
    media = installFakeMatchMedia(1280);
    const s = TestBed.inject(PanelStateService);
    s.close();
    expect(s.view()).toBeNull();
  });
});
