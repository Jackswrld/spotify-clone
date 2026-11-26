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
import { LyricHit, LyricsSearchApi, LyricsSearchResult } from '../../core/api/lyrics-search-api';
import { ToastService } from '../../state/toast.service';
import { SpellingApi } from '../../core/api/spelling-api';
import { RecentSearchesService } from '../../state/recent-searches.service';

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
    findSong: jasmine.createSpy('findSong').and.returnValue(of(null)),
  };
  const lyrics = { search: jasmine.createSpy('search').and.returnValue(of([] as LyricHit[])) as jasmine.Spy<(q: string) => Observable<LyricsSearchResult>> };
  /** Deezer answers, by artist name. */
  const photos: Record<string, ArtistPhoto> = {};
  const player = { playTracks: jasmine.createSpy('playTracks'), current: signal(null), isPlaying: signal(false) };
  const spelling = { suggest: jasmine.createSpy('suggest').and.returnValue(of(null)) as jasmine.Spy<(q: string) => Observable<string | null>> };
  TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: params.asObservable() } },
      { provide: AudiusApi, useValue: api },
      { provide: PlayerService, useValue: player },
      { provide: CatalogApi, useValue: catalog },
      { provide: LyricsSearchApi, useValue: lyrics },
      { provide: SpellingApi, useValue: spelling },
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
    lyrics,
    photos,
    spelling,
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

  it('a song title beats a small artist with the same name (found live: an artist called "Calm Down")', fakeAsync(() => {
    const { setQ, respond, el, catalog, photos } = setup();
    catalog.searchArtists.and.returnValue(of([appleArtist('3', 'Calm Down')]));
    photos['Calm Down'] = { image: 'cd.jpg', fans: 1_291 };
    setQ('calm down');
    tick(300);
    respond('calm down', { songs: [apple('1', 'Calm Down', 'Rema')] });
    const top = el.querySelector('.top-result') as HTMLElement;
    expect(top.textContent).toContain('Song');
    expect(top.textContent).toContain('Rema');
  }));

  it('a big artist still wins over a song with the same title', fakeAsync(() => {
    const { setQ, respond, el, catalog, photos } = setup();
    catalog.searchArtists.and.returnValue(of([appleArtist('9', 'Wizkid')]));
    photos['Wizkid'] = { image: 'w.jpg', fans: 1_005_217 };
    setQ('wizkid');
    tick(300);
    respond('wizkid', { songs: [apple('1', 'Wizkid', 'Somebody')] });
    expect(el.querySelector('.top-result a')?.getAttribute('href')).toBe('/catalog-artist/9');
  }));

  it('artists with the same name appear once', fakeAsync(() => {
    const { setQ, respond, el, catalog, photos } = setup();
    catalog.searchArtists.and.returnValue(
      of([appleArtist('1', 'Rema'), appleArtist('2', 'Calm Down'), appleArtist('3', 'Calm Down'), appleArtist('4', 'calm down')]),
    );
    photos['Rema'] = { image: 'r.jpg', fans: 580_691 };
    photos['Calm Down'] = { image: 'cd.jpg', fans: 1_291 };
    photos['calm down'] = { image: 'cd.jpg', fans: 1_291 };
    setQ('calm down');
    tick(300);
    respond('calm down', {});
    const titles = [...el.querySelectorAll('section[aria-label="Artists"] app-media-card .title')].map((t) => t.textContent?.trim());
    expect(titles).toEqual(['Rema', 'Calm Down']);
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

describe('SearchPage lyric search', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  const HIT: LyricHit = { title: 'WORTHLESS', artist: 'd4vd', image: 'worthless.jpg', durationS: 180 };
  const LONG = 'left the party with a girl';
  const section = (el: HTMLElement) => el.querySelector('section[aria-label="Songs with these lyrics"]') as HTMLElement | null;

  it('a 3-word query makes no lyric request', fakeAsync(() => {
    const { setQ, respond, lyrics } = setup();
    setQ('dont want me');
    tick(300);
    respond('dont want me', {});
    expect(lyrics.search).not.toHaveBeenCalled();
  }));

  it('4 or more words show "Songs with these lyrics" with title, artist and cover', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    lyrics.search.and.returnValue(of([HIT]));
    setQ(LONG);
    tick(300);
    respond(LONG, { songs: [apple('1', 'Party Song')] });
    fixture.detectChanges();
    expect(lyrics.search).toHaveBeenCalledWith(LONG);
    const s = section(el)!;
    expect(s.querySelector('h2')?.textContent).toContain('Songs with these lyrics');
    expect(s.textContent).toContain('WORTHLESS');
    expect(s.textContent).toContain('d4vd');
    expect(s.querySelector('img')?.getAttribute('src')).toBe('worthless.jpg');
    expect(el.textContent).toContain('Party Song');
  }));

  it('lyric hits show even when Apple finds nothing for the words', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    lyrics.search.and.returnValue(of([HIT]));
    setQ(LONG);
    tick(300);
    respond(LONG, {});
    fixture.detectChanges();
    expect(section(el)?.textContent).toContain('WORTHLESS');
    expect(el.textContent).not.toContain('No results');
  }));

  it('the Lyrics tab searches lyrics for a short query too', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    lyrics.search.and.returnValue(of([HIT]));
    setQ('worthless');
    tick(300);
    respond('worthless', { songs: [apple('1', 'Worthless Song')] });
    expect(lyrics.search).not.toHaveBeenCalled();
    const tab = [...el.querySelectorAll('.song-tabs button')].find((b) => b.textContent?.trim() === 'Lyrics') as HTMLButtonElement;
    tab.click();
    fixture.detectChanges();
    tick(1);
    fixture.detectChanges();
    expect(lyrics.search).toHaveBeenCalledWith('worthless');
    expect(el.querySelector('.songs')?.textContent).toContain('d4vd');
  }));

  it('tapping a hit finds the song on Apple and plays it; if Apple lacks it, a toast says so', fakeAsync(() => {
    const { setQ, respond, el, lyrics, catalog, player, fixture } = setup();
    lyrics.search.and.returnValue(of([HIT, { ...HIT, title: 'Unknown', artist: 'Nobody' }]));
    const found = apple('77', 'WORTHLESS', 'd4vd');
    catalog.findSong.and.callFake((artist: string) => of(artist === 'd4vd' ? found : null));
    setQ(LONG);
    tick(300);
    respond(LONG, {});
    fixture.detectChanges();
    const buttons = [...section(el)!.querySelectorAll('button.lyric-hit')] as HTMLButtonElement[];
    buttons[0].click();
    expect(catalog.findSong).toHaveBeenCalledWith('d4vd', 'WORTHLESS');
    expect(player.playTracks).toHaveBeenCalledWith([found], 0);
    buttons[1].click();
    expect(TestBed.inject(ToastService).message()).toBe("Couldn't find this song to play");
    tick(5000);
  }));

  it('not set up, or an error with Retry, while the other results still show', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    lyrics.search.and.returnValue(of('not-set-up' as const));
    setQ(LONG);
    tick(300);
    respond(LONG, { songs: [apple('1', 'Party Song')] });
    fixture.detectChanges();
    expect(section(el)?.textContent).toContain("Lyric search isn't set up");
    expect(el.textContent).toContain('Party Song');

    lyrics.search.and.returnValue(of('error' as const));
    setQ(LONG + ' again');
    tick(300);
    respond(LONG + ' again', { songs: [apple('2', 'Other Song')] });
    fixture.detectChanges();
    expect(section(el)?.querySelector('app-error-state')).toBeTruthy();
    expect(el.textContent).toContain('Other Song');
    lyrics.search.and.returnValue(of([HIT]));
    (section(el)!.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(section(el)?.textContent).toContain('WORTHLESS');
  }));

  it('after using the Lyrics tab, a new search with no songs still shows its lyric hits (never a blank page)', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    lyrics.search.and.returnValue(of([HIT]));
    setQ('worthless');
    tick(300);
    respond('worthless', { songs: [apple('1', 'Worthless Song')] });
    const tab = [...el.querySelectorAll('.song-tabs button')].find((b) => b.textContent?.trim() === 'Lyrics') as HTMLButtonElement;
    tab.click();
    fixture.detectChanges();
    setQ(LONG);
    tick(300);
    respond(LONG, {});
    fixture.detectChanges();
    expect(el.textContent).toContain('WORTHLESS');
    expect(el.textContent).not.toContain('No results');
  }));

  it('a newer query replaces older lyric results', fakeAsync(() => {
    const { setQ, respond, el, lyrics, fixture } = setup();
    const first = new Subject<LyricsSearchResult>();
    const second = new Subject<LyricsSearchResult>();
    lyrics.search.and.returnValues(first, second);
    setQ(LONG);
    tick(300);
    setQ('a different line of words');
    tick(300);
    respond('a different line of words', {});
    second.next([{ ...HIT, title: 'Newest Lyric' }]);
    first.next([{ ...HIT, title: 'Stale Lyric' }]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Newest Lyric');
    expect(el.textContent).not.toContain('Stale Lyric');
  }));
});

describe('SearchPage phone search box', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(375)));
  afterEach(() => media.restore());

  const box = (el: HTMLElement) => el.querySelector<HTMLInputElement>('.phone-search input')!;
  const type = (t: ReturnType<typeof setup>, value: string) => {
    box(t.el).value = value;
    box(t.el).dispatchEvent(new Event('input'));
    t.fixture.detectChanges();
  };

  it('keeps the space just typed when the address bar catches up', () => {
    const t = setup();
    type(t, 'Michael ');
    t.setQ('Michael'); // the URL holds the trimmed search
    expect(box(t.el).value).toBe('Michael ');
    type(t, 'Michael Jackson');
    t.setQ('Michael Jackson');
    expect(box(t.el).value).toBe('Michael Jackson');
  });

  it('shows a search that comes from elsewhere (back button, a link)', () => {
    const t = setup();
    type(t, 'Michael ');
    t.setQ('Adele');
    expect(box(t.el).value).toBe('Adele');
  });
});

describe('SearchPage recent searches and spelling', () => {
  let media: FakeMedia;
  beforeEach(() => {
    media = installFakeMatchMedia(1280);
    localStorage.clear();
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('shows saved searches on the empty search page; a saved song plays again', () => {
    const t = setup();
    const recent = TestBed.inject(RecentSearchesService);
    recent.addQuery('burna boy');
    recent.addSong(apple('9', 'Calm Down', 'Rema'));
    t.fixture.detectChanges();
    expect(t.el.textContent).toContain('Recent searches');
    const rows = t.el.querySelectorAll<HTMLElement>('.recent-item');
    expect(rows[0].textContent).toContain('Calm Down');
    expect(rows[1].textContent).toContain('burna boy');
    rows[0].querySelector<HTMLButtonElement>('.recent-open')!.click();
    expect(t.player.playTracks).toHaveBeenCalledWith([jasmine.objectContaining({ id: 'apple:9' })], 0);
  });

  it('a saved search runs again; × removes one; Clear all empties the list', () => {
    const t = setup();
    const recent = TestBed.inject(RecentSearchesService);
    recent.addQuery('burna boy');
    recent.addQuery('wizkid');
    t.fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    t.el.querySelectorAll<HTMLButtonElement>('.recent-item .recent-open')[1].click();
    expect(router.navigate).toHaveBeenCalledWith(['/search'], jasmine.objectContaining({ queryParams: { q: 'burna boy' } }));
    t.el.querySelector<HTMLButtonElement>('.recent-item .recent-remove')!.click();
    t.fixture.detectChanges();
    expect(recent.items().map((i) => i.title)).toEqual(['burna boy']);
    t.el.querySelector<HTMLButtonElement>('.recent-clear')!.click();
    t.fixture.detectChanges();
    expect(t.el.textContent).not.toContain('Recent searches');
  });

  it('playing a song from the results saves it and the search that found it', fakeAsync(() => {
    const t = setup();
    t.setQ('rema');
    tick(300);
    t.respond('rema', { songs: [apple('1', 'Calm Down', 'Rema')] });
    (t.fixture.debugElement.query((d) => d.name === 'app-track-row').componentInstance as { play: { emit(): void } }).play.emit();
    const items = TestBed.inject(RecentSearchesService).items();
    expect(items.map((i) => i.kind)).toEqual(['song', 'search']);
    expect(items[1].title).toBe('rema');
  }));

  it('a misspelled search shows results for the corrected spelling, with a way back', fakeAsync(() => {
    const t = setup();
    t.spelling.suggest.and.callFake((q: string) => of(q === 'micheal jackson' ? 'Michael Jackson' : null));
    t.setQ('micheal jackson');
    tick(300);
    expect(t.catalog.searchSongs).toHaveBeenCalledWith('Michael Jackson', jasmine.any(Number));
    t.respond('Michael Jackson', { songs: [apple('1', 'Billie Jean', 'Michael Jackson')] });
    expect(t.el.querySelector('.did-you-mean')?.textContent).toContain('Showing results for Michael Jackson');
    t.el.querySelector<HTMLButtonElement>('.did-you-mean button')!.click();
    t.fixture.detectChanges();
    expect(t.catalog.searchSongs).toHaveBeenCalledWith('micheal jackson', jasmine.any(Number));
  }));
});
