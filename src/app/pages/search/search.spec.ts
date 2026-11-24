import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';
import { SearchPage } from './search';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { Artist, Playlist, Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

function artist(id: string, name: string): Artist {
  return {
    id,
    name,
    handle: name.toLowerCase(),
    verified: false,
    followerCount: 0,
    trackCount: 0,
    playlistCount: 0,
    bio: null,
    avatar: { small: null, medium: null, large: null },
    coverPhoto: null,
    permalink: '/' + name.toLowerCase(),
    source: 'audius',
  };
}

type Pending = { tracks: Subject<Track[]>; artists: Subject<Artist[]>; playlists: Subject<Playlist[]> };

function setup() {
  const params = new BehaviorSubject(convertToParamMap({}));
  const pending = new Map<string, Pending>();
  const get = (q: string) => {
    if (!pending.has(q)) pending.set(q, { tracks: new Subject(), artists: new Subject(), playlists: new Subject() });
    return pending.get(q)!;
  };
  const api = {
    searchTracks: jasmine.createSpy('searchTracks').and.callFake((q: string) => get(q).tracks as Observable<Track[]>),
    searchArtists: jasmine.createSpy('searchArtists').and.callFake((q: string) => get(q).artists),
    searchPlaylists: jasmine.createSpy('searchPlaylists').and.callFake((q: string) => get(q).playlists),
  };
  const player = { playTracks: jasmine.createSpy('playTracks'), current: signal(null), isPlaying: signal(false) };
  TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      { provide: AudiusApi, useValue: api },
      { provide: PlayerService, useValue: player },
    ],
  });
  const fixture = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const respond = (q: string, data: { tracks?: Track[]; artists?: Artist[]; playlists?: Playlist[] }) => {
    const p = get(q);
    p.tracks.next(data.tracks ?? []);
    p.tracks.complete();
    p.artists.next(data.artists ?? []);
    p.artists.complete();
    p.playlists.next(data.playlists ?? []);
    p.playlists.complete();
    fixture.detectChanges();
  };
  return {
    fixture,
    el,
    api,
    player,
    respond,
    setQ: (q: string) => {
      params.next(convertToParamMap(q ? { q } : {}));
      fixture.detectChanges();
    },
  };
}

describe('SearchPage', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  it('shows browse tiles when q is empty', () => {
    const { el } = setup();
    const tiles = el.querySelectorAll('.tiles a, .tiles button');
    expect(tiles.length).toBeGreaterThan(5);
    expect(el.textContent).toContain('Lo-Fi');
  });

  it('ignores queries shorter than 2 characters', fakeAsync(() => {
    const { setQ, api, el } = setup();
    setQ('a');
    tick(300);
    expect(api.searchTracks).not.toHaveBeenCalled();
    expect(el.querySelector('.tiles')).toBeTruthy();
  }));

  it('only renders results for the latest query', fakeAsync(() => {
    const { setQ, respond, el, fixture } = setup();
    setQ('ab');
    tick(300);
    setQ('abc');
    tick(300);
    respond('abc', { tracks: [makeTrack('new', { title: 'Newest' })] });
    respond('ab', { tracks: [makeTrack('old', { title: 'Stale' })] });
    fixture.detectChanges();
    expect(el.textContent).toContain('Newest');
    expect(el.textContent).not.toContain('Stale');
  }));

  it('Top result prefers an exact-name artist', fakeAsync(() => {
    const { setQ, respond, el } = setup();
    setQ('drake');
    tick(300);
    respond('drake', {
      tracks: [makeTrack('t1', { title: 'Drake Song' })],
      artists: [artist('a0', 'Drake Campana'), artist('a1', 'Drake')],
    });
    const top = el.querySelector('.top-result') as HTMLElement;
    expect(top.textContent).toContain('Drake');
    expect(top.textContent).toContain('Artist');
    expect(top.querySelector('a')?.getAttribute('href')).toBe('/artist/a1');
  }));

  it('Top result falls back to the first song', fakeAsync(() => {
    const { setQ, respond, el } = setup();
    setQ('rain');
    tick(300);
    respond('rain', { tracks: [makeTrack('t1', { title: 'Midnight Rain' })], artists: [artist('a0', 'Rainy')] });
    expect((el.querySelector('.top-result') as HTMLElement).textContent).toContain('Midnight Rain');
  }));

  it('playing a song row plays the song list from that index', fakeAsync(() => {
    const { setQ, respond, el, player } = setup();
    setQ('lofi');
    tick(300);
    const tracks = ['1', '2', '3'].map((id) => makeTrack(id));
    respond('lofi', { tracks });
    (el.querySelectorAll('app-track-row button.main')[2] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(tracks, 2);
  }));

  it('shows the no-results message when everything is empty', fakeAsync(() => {
    const { setQ, respond, el } = setup();
    setQ('zzqx');
    tick(300);
    respond('zzqx', {});
    expect(el.textContent).toContain('No results for "zzqx"');
  }));

  it('clicking a browse tile searches for it', () => {
    const { el } = setup();
    const router = TestBed.inject(Router);
    const nav = spyOn(router, 'navigate').and.resolveTo(true);
    const tile = [...el.querySelectorAll('.tiles button')].find((t) => t.textContent?.includes('Chill')) as HTMLButtonElement;
    tile.click();
    expect(nav).toHaveBeenCalledWith(['/search'], jasmine.objectContaining({ queryParams: { q: 'Chill' } }));
  });

  it('shows an error with Retry when every search fails, and retry searches again', fakeAsync(() => {
    const { setQ, el, fixture, api } = setup();
    const fail = () => new Observable<never>((s) => s.error(new Error('offline')));
    api.searchTracks.and.callFake(fail);
    api.searchArtists.and.callFake(fail);
    api.searchPlaylists.and.callFake(fail);
    setQ('beat');
    tick(300);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No results');
    expect(el.textContent).toContain("Couldn't search right now");
    api.searchTracks.and.returnValue(of([makeTrack('1', { title: 'Back Online' })]));
    api.searchArtists.and.returnValue(of([]));
    api.searchPlaylists.and.returnValue(of([]));
    (el.querySelector('button.retry') as HTMLButtonElement).click();
    tick(300);
    fixture.detectChanges();
    expect(el.textContent).toContain('Back Online');
  }));

  it('a failing search group still shows the others', fakeAsync(() => {
    const { setQ, el, fixture, api } = setup();
    api.searchPlaylists.and.returnValue(new Observable((s) => s.error(new Error('x'))));
    api.searchArtists.and.returnValue(of([]));
    setQ('beat');
    tick(300);
    const tracks = [makeTrack('1', { title: 'Beat One' })];
    api.searchTracks.calls.mostRecent().returnValue.next(tracks);
    api.searchTracks.calls.mostRecent().returnValue.complete();
    fixture.detectChanges();
    expect(el.textContent).toContain('Beat One');
  }));
});
