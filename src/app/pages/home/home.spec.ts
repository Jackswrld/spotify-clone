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
import { ChartsApi } from '../../core/api/charts-api';
import { LastFmApi } from '../../core/api/lastfm-api';
import { CatalogApi } from '../../core/api/catalog-api';
import { CountryService } from '../../shared/country-picker/country-picker';
import { ToastService } from '../../state/toast.service';
import { Album } from '../../core/models';
import { RelayStatusService } from '../../core/api/relay-status';

const CHART = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((id) =>
  makeTrack(`apple:${id}`, { source: 'catalog', appleId: id, title: `Hit ${id}` }),
);
const ALBUMS: Album[] = [
  {
    id: 'apple:a1', appleId: 'a1', name: 'E-Mortal Boy', artistName: 'Rema', artistId: 'apple:9',
    artwork: { small: null, medium: null, large: null }, releaseDate: '2026-11-20', trackCount: 7, genre: null, appleUrl: '',
  },
];

const TRENDING = ['1', '2', '3'].map((id) => makeTrack(id));
const UNDERGROUND = ['u1', 'u2'].map((id) => makeTrack(id));

function setup(opts: { recent?: Track[]; undergroundFails?: boolean; global?: { name: string; artist: string; image: string | null }[]; chart?: Track[]; relayDown?: boolean } = {}) {
  let undergroundFails = opts.undergroundFails ?? false;
  const api = {
    trendingTracks: jasmine.createSpy('trendingTracks').and.returnValue(of(TRENDING)),
    undergroundTrending: jasmine
      .createSpy('undergroundTrending')
      .and.callFake(() => (undergroundFails ? throwError(() => new Error('x')) : of(UNDERGROUND))),
    trendingPlaylists: jasmine.createSpy('trendingPlaylists').and.returnValue(of([])),
    playlistTracks: jasmine.createSpy('playlistTracks').and.returnValue(of([])),
  };
  const charts = {
    topSongs: jasmine.createSpy('topSongs').and.returnValue(of(opts.chart ?? CHART)),
    topAlbums: jasmine.createSpy('topAlbums').and.returnValue(of(ALBUMS)),
  };
  const lastfm = { topTracks: jasmine.createSpy('topTracks').and.returnValue(of(opts.global ?? [])) };
  const relay = { status: signal<'unknown' | 'ok' | 'down'>(opts.relayDown ? 'down' : 'ok'), recheck: jasmine.createSpy('recheck') };
  const catalog = { findSong: jasmine.createSpy('findSong').and.returnValue(of(CHART[0])) };
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
      { provide: ChartsApi, useValue: charts },
      { provide: LastFmApi, useValue: lastfm },
      { provide: CatalogApi, useValue: catalog },
      { provide: RelayStatusService, useValue: relay },
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
    charts,
    catalog,
    relay,
    setUndergroundFails: (v: boolean) => (undergroundFails = v),
    shelf: (title: string) =>
      [...el.querySelectorAll('app-shelf')].find((s) => s.querySelector('h2')?.textContent?.trim() === title) as
        | HTMLElement
        | undefined,
  };
}

describe('HomePage', () => {
  let media: FakeMedia;
  // Saved country/recents must not leak between tests (Karma runs them in random order).
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

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

  it('quick-play grid shows the top 6 chart songs, falling back to Audius trending', () => {
    localStorage.clear();
    let s = setup();
    expect(s.el.querySelectorAll('.quick button').length).toBe(6);
    expect(s.el.querySelector('.quick button')?.textContent).toContain('Hit c1');
    TestBed.resetTestingModule();
    s = setup({ chart: [] });
    expect(s.el.querySelectorAll('.quick button').length).toBe(3);
  });

  it('requests charts for the selected country and re-requests on change', () => {
    localStorage.clear();
    const { fixture, charts } = setup();
    const country = TestBed.inject(CountryService).country();
    expect(charts.topSongs).toHaveBeenCalledWith(country, 25);
    expect(charts.topAlbums).toHaveBeenCalledWith(country, 25);
    TestBed.inject(CountryService).set('gh');
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(charts.topSongs).toHaveBeenCalledWith('gh', 25);
  });

  it('shows chart shelves with the Apple Music credit', () => {
    const { el } = setup();
    const songs = [...el.querySelectorAll('app-shelf')].find((x) => x.querySelector('h2')?.textContent?.startsWith('Top songs in'));
    expect(songs?.querySelectorAll('app-media-card').length).toBe(7);
    expect(songs?.textContent).toContain('Charts from Apple Music');
  });

  it('playing a chart song plays the chart from that index', () => {
    const { el, player } = setup();
    const shelfEl = [...el.querySelectorAll('app-shelf')].find((s) => s.querySelector('h2')?.textContent?.startsWith('Top songs in'))!;
    (shelfEl.querySelectorAll('button.play')[2] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(CHART, 2);
  });

  it('global shelf is hidden without Last.fm entries', () => {
    const { shelf } = setup();
    expect(shelf('Global top songs')).toBeFalsy();
  });

  it('global shelf click resolves via findSong and plays', () => {
    const { shelf, catalog, player } = setup({ global: [{ name: 'Hit c1', artist: 'Artist', image: null }] });
    (shelf('Global top songs')!.querySelector('button.play') as HTMLButtonElement).click();
    expect(catalog.findSong).toHaveBeenCalledWith('Artist', 'Hit c1');
    expect(player.playTracks).toHaveBeenCalledWith([CHART[0]], 0);
  });

  it('global shelf click with no Apple match shows a toast and does nothing', () => {
    const { shelf, catalog, player } = setup({ global: [{ name: 'Nope', artist: 'Nobody', image: null }] });
    catalog.findSong.and.returnValue(of(null));
    (shelf('Global top songs')!.querySelector('button.play') as HTMLButtonElement).click();
    expect(TestBed.inject(ToastService).message()).toBe("Couldn't find this on Apple Music");
    expect(player.playTracks).not.toHaveBeenCalled();
  });

  it('labels the Audius section "Independent artists", without naming Audius', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Independent artists');
    expect(el.textContent).not.toContain('Independent on Audius');
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

  it('when the music server is down, chart shelves say so and Retry rechecks it', () => {
    const { el, charts, relay, fixture } = setup({ relayDown: true });
    charts.topSongs.and.returnValue(throwError(() => new Error('down')));
    TestBed.inject(CountryService).set('gh');
    fixture.detectChanges();
    const shelfEl = [...el.querySelectorAll('app-shelf')].find((s) => s.textContent?.includes("Can't reach the music server."));
    expect(shelfEl).toBeTruthy();
    (shelfEl!.querySelector('button.retry') as HTMLButtonElement).click();
    expect(relay.recheck).toHaveBeenCalled();
  });
});
