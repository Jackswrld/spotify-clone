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
import { CatalogApi } from '../../core/api/catalog-api';
import { Album } from '../../core/models';
import { ArtistPhoto, ArtistPhotoApi } from '../../core/api/artist-photo-api';

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

const appleArtist = (id: string, name: string): Artist => ({ ...artist(`apple:${id}`, name), source: 'catalog' });

const apple = (id: string, title: string, artistName = 'Artist') =>
  makeTrack(`apple:${id}`, { source: 'catalog', appleId: id, title, artistName });

type Pending = { songs: Subject<Track[]>; tracks: Subject<Track[]>; playlists: Subject<Playlist[]> };

function setup() {
  const params = new BehaviorSubject(convertToParamMap({}));
  const pending = new Map<string, Pending>();
  const get = (q: string) => {
    if (!pending.has(q)) pending.set(q, { songs: new Subject(), tracks: new Subject(), playlists: new Subject() });
    return pending.get(q)!;
  };
  const api = {
    searchTracks: jasmine.createSpy('searchTracks').and.callFake((q: string) => get(q).tracks as Observable<Track[]>),
    searchArtists: jasmine.createSpy('searchArtists').and.returnValue(of([])),
    searchPlaylists: jasmine.createSpy('searchPlaylists').and.callFake((q: string) => get(q).playlists),
  };
  const catalog = {
    searchSongs: jasmine.createSpy('searchSongs').and.callFake((q: string) => get(q).songs as Observable<Track[]>),
    searchArtists: jasmine.createSpy('searchArtists').and.returnValue(of([])),
    searchAlbums: jasmine.createSpy('searchAlbums').and.returnValue(of([])),
  };
  /** Deezer answers, by artist name. */
  const photos: Record<string, ArtistPhoto> = {};
  const player = { playTracks: jasmine.createSpy('playTracks'), current: signal(null), isPlaying: signal(false) };
  TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      { provide: AudiusApi, useValue: api },
      { provide: PlayerService, useValue: player },
      { provide: CatalogApi, useValue: catalog },
      { provide: ArtistPhotoApi, useValue: { photoFor: (name: string) => of<ArtistPhoto>(photos[name] ?? { image: null, fans: 0 }) } },
    ],
  });
  const fixture = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  /** songs = Apple songs, tracks = Audius songs. */
  const respond = (q: string, data: { songs?: Track[]; tracks?: Track[]; playlists?: Playlist[] }) => {
    const p = get(q);
    p.songs.next(data.songs ?? []);
    p.songs.complete();
    p.tracks.next(data.tracks ?? []);
    p.tracks.complete();
    p.playlists.next(data.playlists ?? []);
    p.playlists.complete();
    fixture.detectChanges();
  };
  return {
    fixture,
    el,
    api,
    player,
    catalog,
    photos,
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
    respond('abc', { songs: [apple('new', 'Newest')] });
    respond('ab', { songs: [apple('old', 'Stale')] });
    fixture.detectChanges();
    expect(el.textContent).toContain('Newest');
    expect(el.textContent).not.toContain('Stale');
  }));

  it('Top result prefers the exact-name artist, linking to the Apple artist with their photo', fakeAsync(() => {
    const { setQ, respond, el, catalog, photos } = setup();
    catalog.searchArtists.and.returnValue(of([appleArtist('8', 'Drake Campana'), appleArtist('9', 'Drake')]));
    photos['Drake'] = { image: 'drake.jpg', fans: 30_000_000 };
    photos['Drake Campana'] = { image: 'dc.jpg', fans: 5_000 };
    setQ('drake');
    tick(300);
    respond('drake', { songs: [apple('1', 'Drake Song')] });
    const top = el.querySelector('.top-result') as HTMLElement;
    expect(top.textContent).toContain('Artist');
    expect(top.querySelector('a')?.getAttribute('href')).toBe('/catalog-artist/9');
    expect(top.querySelector('img')?.getAttribute('src')).toBe('drake.jpg');
  }));

  it('a song title finds the song first', fakeAsync(() => {
    const { setQ, respond, el } = setup();
    setQ('calm down');
    tick(300);
    respond('calm down', {
      songs: [apple('2', 'You Need To Calm Down', 'Taylor Swift'), apple('1', 'Calm Down', 'Rema')],
      tracks: [makeTrack('a1', { title: 'Calm Down Beat' })],
    });
    const top = el.querySelector('.top-result') as HTMLElement;
    expect(top.textContent).toContain('Song');
    expect(top.textContent).toContain('Rema');
  }));

  it('Top result falls back to the first song', fakeAsync(() => {
    const { setQ, respond, el, catalog } = setup();
    catalog.searchArtists.and.returnValue(of([appleArtist('7', 'Rainy')]));
    setQ('rain');
    tick(300);
    respond('rain', { songs: [apple('1', 'Midnight Rain')] });
    expect((el.querySelector('.top-result') as HTMLElement).textContent).toContain('Midnight Rain');
  }));

  it('never shows Audius artists, and Audius is not asked for artists', fakeAsync(() => {
    const { setQ, respond, el, api } = setup();
    setQ('wizkid');
    tick(300);
    respond('wizkid', { tracks: [makeTrack('a1', { title: 'Fake Wizkid Song', artistName: 'Wizkid' })] });
    expect(api.searchArtists).not.toHaveBeenCalled();
    expect(el.querySelector('.top-result')).toBeNull();
    expect(el.querySelector('section[aria-label="Artists"]')).toBeNull();
  }));

  it('artists are real ones only: namesakes with few fans dropped, the rest sorted by fans, at most 6', fakeAsync(() => {
    const { setQ, respond, el, catalog, photos } = setup();
    const names = ['Wiz Kid', 'Wizkid T', 'Wizkid', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
    catalog.searchArtists.and.returnValue(of(names.map((n, i) => appleArtist(String(i), n))));
    photos['Wizkid'] = { image: 'wizkid.jpg', fans: 1_005_214 };
    photos['Wiz Kid'] = { image: 'wk.jpg', fans: 120 };
    ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].forEach((n, i) => (photos[n] = { image: null, fans: 2_000 + i }));
    setQ('wizkid');
    tick(300);
    respond('wizkid', {});
    const cards = [...el.querySelectorAll('section[aria-label="Artists"] app-media-card')];
    const titles = cards.map((c) => c.querySelector('.title')?.textContent?.trim());
    expect(titles).toEqual(['Wizkid', 'A6', 'A5', 'A4', 'A3', 'A2']);
    expect(cards[0].querySelector('img')?.getAttribute('src')).toBe('wizkid.jpg');
  }));

  it("when every artist would be dropped, Apple's artists show unfiltered", fakeAsync(() => {
    const { setQ, respond, el, catalog } = setup();
    catalog.searchArtists.and.returnValue(of([appleArtist('1', 'Tiny Band'), appleArtist('2', 'Tiny Band Two')]));
    setQ('tiny band');
    tick(300);
    respond('tiny band', {});
    const titles = [...el.querySelectorAll('section[aria-label="Artists"] app-media-card .title')].map((t) =>
      t.textContent?.trim(),
    );
    expect(titles).toEqual(['Tiny Band', 'Tiny Band Two']);
  }));

  it('playing a song row plays the song list from that index', fakeAsync(() => {
    const { setQ, respond, el, player } = setup();
    setQ('lofi');
    tick(300);
    const songs = ['1', '2', '3'].map((id) => apple(id, `Lofi ${id}`));
    respond('lofi', { songs });
    (el.querySelectorAll('app-track-row button.main')[2] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(songs, 2);
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
    const { setQ, el, fixture, api, catalog } = setup();
    const fail = () => new Observable<never>((s) => s.error(new Error('offline')));
    api.searchTracks.and.callFake(fail);
    api.searchPlaylists.and.callFake(fail);
    catalog.searchSongs.and.callFake(fail);
    catalog.searchArtists.and.callFake(fail);
    catalog.searchAlbums.and.callFake(fail);
    setQ('beat');
    tick(300);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No results');
    expect(el.textContent).toContain("Couldn't search right now");
    catalog.searchSongs.and.returnValue(of([apple('1', 'Back Online')]));
    (el.querySelector('button.retry') as HTMLButtonElement).click();
    tick(300);
    fixture.detectChanges();
    expect(el.textContent).toContain('Back Online');
  }));

  it('All shows Apple songs only; the Independent tab shows Audius songs and playlists', fakeAsync(() => {
    const { setQ, respond, el, fixture } = setup();
    setQ('beat');
    tick(300);
    const playlist = { id: 'p1', name: 'Indie Mix', artwork: { small: null, medium: null, large: null }, ownerName: 'X' } as unknown as Playlist;
    respond('beat', { songs: [apple('1', 'Mainstream')], tracks: [makeTrack('a2', { title: 'Indie' })], playlists: [playlist] });
    const titles = () => [...el.querySelectorAll('.songs app-track-row .title')].map((t) => t.textContent?.trim());
    const tabs = () => [...el.querySelectorAll('.song-tabs button')].map((b) => b.textContent?.trim());
    expect(titles()).toEqual(['Mainstream']);
    expect(tabs()).toContain('Independent');
    expect(tabs()).not.toContain('Audius');
    expect(el.querySelector('section[aria-label="Playlists"]')).toBeNull();
    const tab = [...el.querySelectorAll('.song-tabs button')].find((b) => b.textContent?.trim() === 'Independent') as HTMLButtonElement;
    tab.click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Indie']);
    expect(el.querySelector('section[aria-label="Playlists"]')?.textContent).toContain('Indie Mix');
  }));

  it('shows albums from the Apple catalog', fakeAsync(() => {
    const { setQ, respond, el, catalog } = setup();
    const album: Album = {
      id: 'apple:5', appleId: '5', name: 'E-Mortal Boy', artistName: 'Rema', artistId: 'apple:9',
      artwork: { small: null, medium: null, large: null }, releaseDate: null, trackCount: 7, genre: null, appleUrl: '',
    };
    catalog.searchAlbums.and.returnValue(of([album]));
    setQ('rema');
    tick(300);
    respond('rema', {});
    const albums = el.querySelector('section[aria-label="Albums"]') as HTMLElement;
    expect(albums.textContent).toContain('E-Mortal Boy');
  }));

  it('a failing search group still shows the others', fakeAsync(() => {
    const { setQ, el, respond, api } = setup();
    api.searchPlaylists.and.returnValue(new Observable((s) => s.error(new Error('x'))));
    setQ('beat');
    tick(300);
    respond('beat', { songs: [apple('1', 'Beat One')] });
    expect(el.textContent).toContain('Beat One');
  }));
});
