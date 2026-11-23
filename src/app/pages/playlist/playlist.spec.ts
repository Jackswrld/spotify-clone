import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PlaylistPage } from './playlist';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer, makePlaylist } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const TRACKS = ['1', '2', '3'].map((id) => makeTrack(id));

function setup() {
  const api = {
    playlist: jasmine.createSpy('playlist').and.returnValue(of(makePlaylist('p1', { name: 'Hot & New', isAlbum: true }))),
    playlistTracks: jasmine.createSpy('playlistTracks').and.returnValue(of(TRACKS)),
  };
  const player = fakePlayer();
  player.toggleShuffle.and.callFake(() => player.shuffle.set(!player.shuffle()));
  TestBed.configureTestingModule({
    imports: [PlaylistPage],
    providers: [provideRouter([]), { provide: AudiusApi, useValue: api }, { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(PlaylistPage);
  fixture.componentRef.setInput('id', 'p1');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, player };
}

describe('PlaylistPage', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('shows the header and track list', () => {
    const { el } = setup();
    expect(el.querySelector('h1')?.textContent).toContain('Hot & New');
    expect(el.textContent).toContain('Album');
    expect(el.textContent).toContain('3 songs');
    expect(el.querySelectorAll('app-track-row').length).toBe(3);
  });

  it('shuffle-play enables shuffle then plays', () => {
    const { el, player } = setup();
    (el.querySelector('button.shuffle-play') as HTMLButtonElement).click();
    expect(player.toggleShuffle).toHaveBeenCalledTimes(1);
    expect(player.shuffle()).toBeTrue();
    expect(player.playTracks).toHaveBeenCalled();
    expect(player.playTracks.calls.mostRecent().args[0]).toEqual(TRACKS);
  });

  it('shuffle-play keeps shuffle on if it already is', () => {
    const { el, player } = setup();
    player.shuffle.set(true);
    (el.querySelector('button.shuffle-play') as HTMLButtonElement).click();
    expect(player.toggleShuffle).not.toHaveBeenCalled();
  });

  it('save toggles the saved playlist', () => {
    const { fixture, el } = setup();
    (el.querySelector('button.save') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(TestBed.inject(LibraryService).isPlaylistSaved('p1')).toBeTrue();
  });

  it('clicking a row plays the list from that row', () => {
    const { el, player } = setup();
    (el.querySelectorAll('app-track-row button.main')[1] as HTMLButtonElement).click();
    expect(player.playTracks).toHaveBeenCalledWith(TRACKS, 1);
  });
});
