import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ArtistPage } from './artist';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer, makeArtist } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const POPULAR = [makeTrack('1'), makeTrack('2')];

function setup() {
  const api = {
    artist: jasmine.createSpy('artist').and.returnValue(of(makeArtist('a1', { name: 'Xsetra', followerCount: 2300 }))),
    artistTracks: jasmine.createSpy('artistTracks').and.returnValue(of(POPULAR)),
    artistPlaylists: jasmine.createSpy('artistPlaylists').and.returnValue(of([])),
    playlistTracks: jasmine.createSpy('playlistTracks').and.returnValue(of([])),
  };
  const player = fakePlayer();
  TestBed.configureTestingModule({
    imports: [ArtistPage],
    providers: [provideRouter([]), { provide: AudiusApi, useValue: api }, { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(ArtistPage);
  fixture.componentRef.setInput('id', 'a1');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, player };
}

describe('ArtistPage', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('shows the artist name, followers and popular tracks', () => {
    const { el, api } = setup();
    expect(el.querySelector('h1')?.textContent).toContain('Xsetra');
    expect(el.textContent).toContain('2.3K followers');
    expect(api.artistTracks).toHaveBeenCalledWith('a1', { sort: 'plays', limit: 10 });
    expect(el.querySelectorAll('.popular app-track-row').length).toBe(2);
  });

  it('Follow toggles savedArtists', () => {
    const { fixture, el } = setup();
    const follow = el.querySelector('button.follow') as HTMLButtonElement;
    expect(follow.textContent?.trim()).toBe('Follow');
    follow.click();
    fixture.detectChanges();
    expect(TestBed.inject(LibraryService).isArtistSaved('a1')).toBeTrue();
    expect(follow.textContent?.trim()).toBe('Following');
    expect(follow.getAttribute('aria-pressed')).toBe('true');
  });

  it('Play plays the popular tracks from the start', () => {
    const { el, player } = setup();
    (el.querySelector('button.big-play') as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(POPULAR, 0);
  });

  it('hides the playlists shelf when there are none', () => {
    const { el } = setup();
    expect([...el.querySelectorAll('app-shelf h2')].some((h) => h.textContent?.includes('Playlists'))).toBeFalse();
  });
});
