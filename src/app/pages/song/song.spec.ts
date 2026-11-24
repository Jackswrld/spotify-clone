import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SongPage } from './song';
import { CatalogApi } from '../../core/api/catalog-api';
import { YouTubeMatchApi } from '../../core/api/youtube-match-api';
import { LyricsApi } from '../../core/api/lyrics-api';
import { PlayerService } from '../../state/player.service';
import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer, makeArtist } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const SONG = makeTrack('apple:55', {
  source: 'catalog',
  appleId: '55',
  title: 'Calm Down',
  artistName: 'Rema',
  artistId: 'apple:9',
  albumId: 'apple:77',
  albumName: 'Rave & Roses',
  releaseDate: '2022-02-11T08:00:00Z',
  genre: 'Afrobeats',
  duration: 219.6,
  appleUrl: 'https://music.apple.com/song/55',
});
const MORE = [SONG, makeTrack('apple:56', { source: 'catalog', appleId: '56' })];

function setup(songResult = of(SONG), cachedMatch: unknown = null) {
  const catalog = {
    song: jasmine.createSpy('song').and.returnValue(songResult),
    artistTopSongs: jasmine.createSpy('artistTopSongs').and.returnValue(of(MORE)),
    artist: jasmine.createSpy('artist').and.returnValue(of(makeArtist('apple:9', { name: 'Rema', source: 'catalog' }))),
  };
  const match = { cached: jasmine.createSpy('cached').and.returnValue(cachedMatch), match: jasmine.createSpy('match') };
  const player = fakePlayer();
  TestBed.configureTestingModule({
    imports: [SongPage],
    providers: [
      provideRouter([]),
      { provide: CatalogApi, useValue: catalog },
      { provide: YouTubeMatchApi, useValue: match },
      { provide: PlayerService, useValue: player },
      { provide: LyricsApi, useValue: { get: () => of(null) } },
      { provide: ArtistEnrichmentService, useValue: { infoFor: () => of(null), fansAlsoLike: () => of([]) } },
    ],
  });
  const fixture = TestBed.createComponent(SongPage);
  fixture.componentRef.setInput('appleId', '55');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, catalog, match, player };
}

describe('SongPage', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  it('shows header fields and the Apple Music link', () => {
    const { el, catalog } = setup();
    expect(catalog.song).toHaveBeenCalledWith('55');
    expect(el.querySelector('h1')?.textContent).toContain('Calm Down');
    const line = el.querySelector('.stats-line')?.textContent ?? '';
    expect(line).toContain('Rema');
    expect(line).toContain('Rave & Roses');
    expect(line).toContain('2022');
    expect(line).toContain('Afrobeats');
    expect(line).toContain('3:39');
    const apple = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Listen on Apple Music'));
    expect(apple?.getAttribute('href')).toBe('https://music.apple.com/song/55');
  });

  it('plays [song, ...more by the artist] without duplicating the song', () => {
    const { el, player, catalog } = setup();
    expect(catalog.artistTopSongs).toHaveBeenCalledWith('9', 10);
    (el.querySelector('button.big-play') as HTMLButtonElement).click();
    const [list, index] = player.playTracks.calls.mostRecent().args;
    expect(list.map((t: { id: string }) => t.id)).toEqual(['apple:55', 'apple:56']);
    expect(index).toBe(0);
  });

  it('shows "Plays via YouTube" only when a match is already known and never asks for one', () => {
    let s = setup();
    expect(s.el.textContent).not.toContain('Plays via YouTube');
    expect(s.match.match).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    s = setup(of(SONG), { videoId: 'vid9', title: 't', channel: 'c' });
    const link = [...s.el.querySelectorAll('a')].find((a) => a.textContent?.includes('Plays via YouTube'));
    expect(link?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=vid9');
    expect(s.match.match).not.toHaveBeenCalled();
  });

  it('a network error shows Retry; a missing song shows not available', () => {
    let s = setup(throwError(() => new HttpErrorResponse({ status: 0 })));
    expect(s.el.textContent).toContain("Couldn't load this song.");
    expect(s.el.querySelector('button.retry')).toBeTruthy();
    TestBed.resetTestingModule();
    s = setup(throwError(() => new Error('Song not found')));
    expect(s.el.textContent).toContain("This song isn't available.");
  });
});
