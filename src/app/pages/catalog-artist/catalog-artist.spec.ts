import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogArtistPage } from './catalog-artist';
import { CatalogApi } from '../../core/api/catalog-api';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
import { Album } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer, makeArtist } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const album = (id: string, name: string, date: string): Album => ({
  id: `apple:${id}`, appleId: id, name, artistName: 'Rema', artistId: 'apple:9',
  artwork: { small: `https://img/${id}.jpg`, medium: null, large: null }, releaseDate: date, trackCount: 7, genre: null, appleUrl: '',
});
const ALBUMS = [album('2', 'E-Mortal Boy', '2026-11-20T08:00:00Z'), album('1', 'Rave & Roses', '2022-03-25T07:00:00Z')];
const TOP = ['1', '2'].map((id) => makeTrack(`apple:${id}`, { source: 'catalog', appleId: id }));

function setup() {
  const catalog = {
    artist: jasmine.createSpy('artist').and.returnValue(
      of(makeArtist('apple:9', { name: 'Rema', source: 'catalog', appleUrl: 'https://music.apple.com/artist/9' })),
    ),
    artistAlbums: jasmine.createSpy('artistAlbums').and.returnValue(of(ALBUMS)),
    artistTopSongs: jasmine.createSpy('artistTopSongs').and.returnValue(of(TOP)),
    album: jasmine.createSpy('album').and.returnValue(of({ album: ALBUMS[0], tracks: TOP })),
  };
  const player = fakePlayer();
  TestBed.configureTestingModule({
    imports: [CatalogArtistPage],
    providers: [
      provideRouter([]),
      { provide: CatalogApi, useValue: catalog },
      { provide: PlayerService, useValue: player },
      { provide: ArtistEnrichmentService, useValue: { infoFor: () => of(null), fansAlsoLike: () => of([]), similarNames: () => of([]) } },
    ],
  });
  const fixture = TestBed.createComponent(CatalogArtistPage);
  fixture.componentRef.setInput('appleId', '9');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, catalog, player };
}

describe('CatalogArtistPage', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('shows the name, latest releases newest first with dates, and top songs', () => {
    const { el, catalog } = setup();
    expect(catalog.artistAlbums).toHaveBeenCalledWith('9', 20);
    expect(el.querySelector('h1')?.textContent).toContain('Rema');
    const releases = [...el.querySelectorAll('app-shelf')].find((s) => s.querySelector('h2')?.textContent?.includes('Latest releases'))!;
    const titles = [...releases.querySelectorAll('app-media-card .title')].map((t) => t.textContent?.trim());
    expect(titles).toEqual(['E-Mortal Boy', 'Rave & Roses']);
    expect(releases.textContent).toContain('2026');
    expect(el.querySelectorAll('.top app-track-row').length).toBe(2);
    expect(el.querySelector('.header-art img')?.getAttribute('src')).toBe('https://img/2.jpg');
  });

  it('Play plays the top songs; Follow saves a catalog artist', () => {
    const { fixture, el, player } = setup();
    (el.querySelector('button.big-play') as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(TOP, 0);
    (el.querySelector('button.follow') as HTMLButtonElement).click();
    fixture.detectChanges();
    const saved = TestBed.inject(LibraryService).savedArtists();
    expect(saved[0].id).toBe('apple:9');
    expect(saved[0].source).toBe('catalog');
  });

  it('links to Apple Music', () => {
    const { el } = setup();
    const apple = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Listen on Apple Music'));
    expect(apple?.getAttribute('href')).toBe('https://music.apple.com/artist/9');
  });
});
