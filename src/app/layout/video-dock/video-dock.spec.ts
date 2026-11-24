import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { VideoDock } from './video-dock';
import { VideoDockService } from '../../state/video-dock.service';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const CATALOG = makeTrack('apple:1', { source: 'catalog', appleId: '1' });
const AUDIUS = makeTrack('1');

describe('VideoDock', () => {
  let media: FakeMedia;
  const extra: HTMLElement[] = [];
  afterEach(() => {
    media.restore();
    extra.splice(0).forEach((el) => el.remove());
    TestBed.inject(VideoDockService).host.remove();
  });

  function setup(width = 1280, current: Track | null = CATALOG) {
    media = installFakeMatchMedia(width);
    const player = { current: signal<Track | null>(current) };
    const panel = { open: jasmine.createSpy('open'), view: signal(null) };
    TestBed.configureTestingModule({
      imports: [VideoDock],
      providers: [
        { provide: PlayerService, useValue: player },
        { provide: PanelStateService, useValue: panel },
      ],
    });
    const fixture = TestBed.createComponent(VideoDock);
    fixture.detectChanges();
    const dock = TestBed.inject(VideoDockService);
    const refresh = () => {
      dock.relayout();
      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();
    };
    refresh();
    return { fixture, dock, player, panel, refresh, el: fixture.nativeElement as HTMLElement };
  }

  function slot(left: number, top: number, size: number): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${size}px;height:${size}px`;
    document.body.appendChild(el);
    extra.push(el);
    return el;
  }

  const rect = (el: HTMLElement) => el.getBoundingClientRect();

  it('positions the host over the active slot rect', () => {
    const { dock, refresh, el } = setup();
    dock.registerSlot(slot(100, 50, 288), 2);
    refresh();
    const r = rect(dock.host);
    expect([r.left, r.top, r.width, r.height]).toEqual([100, 50, 288, 288]);
    expect(el.querySelector('.card')).toBeNull();
  });

  it('shows the floating card when no slot is active and never sizes it below 200x200', () => {
    const { dock, el } = setup();
    const r = rect(dock.host);
    expect(el.querySelector('.card')).toBeTruthy();
    expect(r.width).toBeGreaterThanOrEqual(240);
    expect(r.height).toBeGreaterThanOrEqual(240);
  });

  it('phone floating card is 200x200 and close sets floatingClosed and hides it', () => {
    const { dock, el, refresh } = setup(375);
    const r = rect(dock.host);
    expect(r.width).toBe(200);
    expect(r.height).toBe(200);
    (el.querySelector('button.close') as HTMLButtonElement).click();
    refresh();
    expect(dock.floatingClosed()).toBeTrue();
    expect(getComputedStyle(dock.host).display).toBe('none');
    expect(el.querySelector('.card')).toBeNull();
  });

  it('header buttons are outside the video area (nothing overlaps the player)', () => {
    const { dock, el } = setup();
    const video = rect(dock.host);
    for (const button of Array.from(el.querySelectorAll('button'))) {
      const b = button.getBoundingClientRect();
      const overlaps = b.left < video.right && b.right > video.left && b.top < video.bottom && b.bottom > video.top;
      expect(overlaps).withContext(button.textContent ?? '').toBeFalse();
    }
  });

  it('Open now playing opens the panel; move cycles the corner', () => {
    const { dock, el, panel, refresh } = setup();
    const before = rect(dock.host);
    (el.querySelector('button.move') as HTMLButtonElement).click();
    refresh();
    expect(rect(dock.host).left).not.toBe(before.left);
    (el.querySelector('button.open-panel') as HTMLButtonElement).click();
    expect(panel.open).toHaveBeenCalledWith('now-playing');
  });

  it('hides entirely while an audius song is current', () => {
    const { dock, el, player, refresh } = setup(1280, AUDIUS);
    expect(getComputedStyle(dock.host).display).toBe('none');
    expect(el.querySelector('.card')).toBeNull();
    player.current.set(CATALOG);
    refresh();
    expect(getComputedStyle(dock.host).display).not.toBe('none');
  });
});
