import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlbumPage } from './album';
import { CatalogApi } from '../../core/api/catalog-api';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Album } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const ALBUM: Album = {
  id: 'apple:77',
  appleId: '77',
  name: 'E-Mortal Boy',
  artistName: 'Rema',
  artistId: 'apple:9',
  artwork: { small: null, medium: null, large: null },
  releaseDate: '2026-11-20T08:00:00Z',
  trackCount: 2,
  genre: 'Afrobeats',
  appleUrl: 'https://music.apple.com/album/77',
};
const TRACKS = ['1', '2'].map((id) => makeTrack(`apple:${id}`, { source: 'catalog', appleId: id }));

function setup() {
  const catalog = { album: jasmine.createSpy('album').and.returnValue(of({ album: ALBUM, tracks: TRACKS })) };
  const player = fakePlayer();
  player.toggleShuffle.and.callFake(() => player.shuffle.set(!player.shuffle()));
  TestBed.configureTestingModule({
    imports: [AlbumPage],
    providers: [provideRouter([]), { provide: CatalogApi, useValue: catalog }, { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(AlbumPage);
  fixture.componentRef.setInput('appleId', '77');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, player };
}

describe('AlbumPage', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('shows the header and lists the tracks', () => {
    const { el } = setup();
    expect(el.querySelector('h1')?.textContent).toContain('E-Mortal Boy');
    expect(el.textContent).toContain('2026');
    expect(el.textContent).toContain('2 songs');
    expect(el.querySelectorAll('app-track-row').length).toBe(2);
    const apple = [...el.querySelectorAll('a')].find((a) => a.textContent?.includes('Listen on Apple Music'));
    expect(apple?.getAttribute('href')).toBe('https://music.apple.com/album/77');
  });

  it('Save toggles the saved album', () => {
    const { fixture, el } = setup();
    (el.querySelector('button.save') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(LibraryService).isAlbumSaved('apple:77')).toBeTrue();
  });

  it('shuffle-play enables shuffle then plays', () => {
    const { el, player } = setup();
    (el.querySelector('button.shuffle-play') as HTMLButtonElement).click();
    expect(player.shuffle()).toBeTrue();
    expect(player.playTracks.calls.mostRecent().args[0]).toEqual(TRACKS);
  });

  it('clicking a row plays the album from that row', () => {
    const { el, player } = setup();
    (el.querySelectorAll('app-track-row button.main')[1] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(TRACKS, 1);
  });
});
