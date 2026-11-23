import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomePage } from './home';
import { FUN_FACTS } from './fun-facts';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const TRENDING = ['1', '2', '3'].map((id) => makeTrack(id));
const UNDERGROUND = ['u1', 'u2'].map((id) => makeTrack(id));

function setup(opts: { recent?: Track[]; undergroundFails?: boolean } = {}) {
  let undergroundFails = opts.undergroundFails ?? false;
  const api = {
    trendingTracks: jasmine.createSpy('trendingTracks').and.returnValue(of(TRENDING)),
    undergroundTrending: jasmine
      .createSpy('undergroundTrending')
      .and.callFake(() => (undergroundFails ? throwError(() => new Error('x')) : of(UNDERGROUND))),
    trendingPlaylists: jasmine.createSpy('trendingPlaylists').and.returnValue(of([])),
    playlistTracks: jasmine.createSpy('playlistTracks').and.returnValue(of([])),
  };
  const player = {
    playTracks: jasmine.createSpy('playTracks'),
    recentlyPlayed: signal(opts.recent ?? []),
    current: signal(null),
    isPlaying: signal(false),
  };
  TestBed.configureTestingModule({
    imports: [HomePage],
    providers: [
      provideRouter([]),
      { provide: AudiusApi, useValue: api },
      { provide: PlayerService, useValue: player },
    ],
  });
  const fixture = TestBed.createComponent(HomePage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    api,
    player,
    setUndergroundFails: (v: boolean) => (undergroundFails = v),
    shelf: (title: string) =>
      [...el.querySelectorAll('app-shelf')].find((s) => s.querySelector('h2')?.textContent?.trim() === title) as
        | HTMLElement
        | undefined,
  };
}

describe('HomePage', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  it('requests trending with no genre for All and the chip genre when selected', () => {
    const { fixture, el, api } = setup();
    expect(api.trendingTracks).toHaveBeenCalledWith({ genre: undefined, time: 'week', limit: 20 });
    const chip = [...el.querySelectorAll('.chips button')].find((b) => b.textContent?.trim() === 'Electronic') as HTMLButtonElement;
    chip.click();
    fixture.detectChanges();
    expect(api.trendingTracks).toHaveBeenCalledWith({ genre: 'Electronic', time: 'week', limit: 20 });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('play on a trending card calls playTracks with the shelf list and index', () => {
    const { shelf, player } = setup();
    const buttons = shelf('Trending this week')!.querySelectorAll('button.play');
    (buttons[1] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(TRENDING, 1);
  });

  it('a failing shelf shows Retry and retry re-requests only that shelf', () => {
    const { fixture, shelf, api, setUndergroundFails } = setup({ undergroundFails: true });
    const underground = shelf('Underground trending')!;
    expect(underground.textContent).toContain("Couldn't load");
    const trendingCalls = api.trendingTracks.calls.count();
    setUndergroundFails(false);
    (underground.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.undergroundTrending).toHaveBeenCalledTimes(2);
    expect(api.trendingTracks.calls.count()).toBe(trendingCalls);
    expect(shelf('Underground trending')!.querySelectorAll('app-media-card').length).toBe(2);
  });

  it('hides Recently played when empty and shows it otherwise', () => {
    expect(setup().shelf('Recently played')).toBeFalsy();
    TestBed.resetTestingModule();
    const { shelf } = setup({ recent: [makeTrack('r1')] });
    expect(shelf('Recently played')!.querySelectorAll('app-media-card').length).toBe(1);
  });

  it('quick-play grid shows the first trending tracks', () => {
    localStorage.clear();
    const { el } = setup();
    expect(el.querySelectorAll('.quick button').length).toBe(3);
  });

  it('shows a Liked songs tile only when there are liked songs', () => {
    localStorage.clear();
    let s = setup();
    expect(s.el.querySelector('.quick a.liked-tile')).toBeNull();
    TestBed.resetTestingModule();
    localStorage.setItem('library.liked', JSON.stringify([makeTrack('l1')]));
    s = setup();
    const tile = s.el.querySelector('.quick a.liked-tile') as HTMLAnchorElement;
    expect(tile.getAttribute('href')).toBe('/library?view=liked');
    localStorage.clear();
  });

  it('FUN_FACTS has no duplicates', () => {
    expect(new Set(FUN_FACTS).size).toBe(FUN_FACTS.length);
    expect(FUN_FACTS.some((f) => f.includes('  '))).toBeFalse();
  });
});
