import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrackMenu } from './add-to-playlist';
import { TrackMenuService } from './track-menu.service';
import { LibraryService } from '../../state/library.service';
import { ToastService } from '../../state/toast.service';
import { PlayerService } from '../../state/player.service';
import { makeTrack } from '../../core/testing/make-track';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

function setup() {
  const player = { playNext: jasmine.createSpy('playNext'), addToQueue: jasmine.createSpy('addToQueue') };
  TestBed.configureTestingModule({
    imports: [TrackMenu],
    providers: [provideRouter([]), { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(TrackMenu);
  fixture.detectChanges();
  const menu = TestBed.inject(TrackMenuService);
  const library = TestBed.inject(LibraryService);
  const toast = TestBed.inject(ToastService);
  const el = fixture.nativeElement as HTMLElement;
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const item = (text: string) =>
    [...el.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent?.trim().startsWith(text)) as HTMLElement;
  const open = (track = makeTrack('1', { title: 'Fragments' })) => {
    menu.open(track, anchor);
    fixture.detectChanges();
    return track;
  };
  return { fixture, el, menu, library, toast, player, anchor, item, open };
}

describe('TrackMenu', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('lists my playlists and adds the track to the chosen one with a toast', () => {
    const { fixture, library, toast, item, open } = setup();
    const p = library.createPlaylist('Gym');
    const track = open();
    item('Add to playlist').click();
    fixture.detectChanges();
    item('Gym').click();
    fixture.detectChanges();
    expect(library.playlistById(p.id)()?.tracks.map((t) => t.id)).toEqual([track.id]);
    expect(toast.message()).toBe('Added to Gym');
  });

  it('New playlist creates one and adds the track', () => {
    const { fixture, library, toast, item, open } = setup();
    open();
    item('Add to playlist').click();
    fixture.detectChanges();
    item('New playlist').click();
    fixture.detectChanges();
    expect(library.myPlaylists().length).toBe(1);
    expect(library.myPlaylists()[0].tracks.length).toBe(1);
    expect(toast.message()).toBe('Added to My Playlist #1');
  });

  it('duplicate add shows "Already in <name>"', () => {
    const { fixture, library, toast, item, open } = setup();
    const p = library.createPlaylist('Gym');
    library.addToPlaylist(p.id, makeTrack('1'));
    open();
    item('Add to playlist').click();
    fixture.detectChanges();
    item('Gym').click();
    expect(toast.message()).toBe('Already in Gym');
  });

  it('Play next and Add to queue call the player', () => {
    const { fixture, player, item, open } = setup();
    const track = open();
    item('Play next').click();
    expect(player.playNext).toHaveBeenCalledWith(track);
    open();
    fixture.detectChanges();
    item('Add to queue').click();
    expect(player.addToQueue).toHaveBeenCalledWith(track);
  });

  it('Like toggles the library and the label', () => {
    const { fixture, library, item, open } = setup();
    open();
    item('Like').click();
    expect(library.isLiked('1')).toBeTrue();
    open();
    fixture.detectChanges();
    expect(item('Remove from Liked songs')).toBeTruthy();
  });

  it('Escape closes and returns focus to the anchor', () => {
    const { fixture, el, menu, anchor, open } = setup();
    open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(menu.state()).toBeNull();
    expect(el.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(anchor);
  });

  it('renders as a popover on desktop and a bottom sheet on phone', () => {
    let s = setup();
    s.open();
    expect(s.el.querySelector('.popover')).toBeTruthy();
    TestBed.resetTestingModule();
    media.setWidth(375);
    s = setup();
    s.open();
    expect(s.el.querySelector('.sheet')).toBeTruthy();
    expect(s.el.querySelector('.backdrop')).toBeTruthy();
  });
});
