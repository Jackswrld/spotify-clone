import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { MyPlaylistPage } from './my-playlist';
import { LibraryService } from '../../state/library.service';
import { PlayerService } from '../../state/player.service';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

function setup(withTracks = true) {
  const player = fakePlayer();
  TestBed.configureTestingModule({
    imports: [MyPlaylistPage],
    providers: [provideRouter([]), { provide: PlayerService, useValue: player }],
  });
  const library = TestBed.inject(LibraryService);
  const p = library.createPlaylist('Gym');
  if (withTracks) ['1', '2', '3'].forEach((id) => library.addToPlaylist(p.id, makeTrack(id)));
  const fixture = TestBed.createComponent(MyPlaylistPage);
  fixture.componentRef.setInput('id', p.id);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const name = () => library.playlistById(p.id)()?.name;
  const startEditing = () => {
    (el.querySelector('button.name') as HTMLButtonElement).click();
    fixture.detectChanges();
    return el.querySelector('input.name-input') as HTMLInputElement;
  };
  return { fixture, el, library, player, id: p.id, name, startEditing };
}

describe('MyPlaylistPage', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('rename: Enter saves', () => {
    const { fixture, startEditing, name } = setup();
    const input = startEditing();
    input.value = 'Leg day';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(name()).toBe('Leg day');
  });

  it('rename: Escape cancels', () => {
    const { fixture, el, startEditing, name } = setup();
    const input = startEditing();
    input.value = 'Nope';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(name()).toBe('Gym');
    expect(el.querySelector('input.name-input')).toBeNull();
  });

  it('rename: blank is ignored', () => {
    const { fixture, startEditing, name } = setup();
    const input = startEditing();
    input.value = '   ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(name()).toBe('Gym');
  });

  it('drop calls moveInPlaylist(from, to)', () => {
    const { fixture, library, id } = setup();
    const move = spyOn(library, 'moveInPlaylist').and.callThrough();
    fixture.debugElement
      .query(By.directive(CdkDropList))
      .triggerEventHandler('cdkDropListDropped', { previousIndex: 0, currentIndex: 2 });
    expect(move).toHaveBeenCalledWith(id, 0, 2);
    expect(library.playlistById(id)()?.tracks.map((t) => t.id)).toEqual(['2', '3', '1']);
  });

  it('play plays the playlist tracks', () => {
    const { el, player } = setup();
    (el.querySelector('button.big-play') as HTMLButtonElement).click();
    expect(player.playTracks.calls.mostRecent().args[0].map((t: { id: string }) => t.id)).toEqual(['1', '2', '3']);
  });

  it('shows the empty message for an empty playlist', () => {
    const { el } = setup(false);
    expect(el.textContent).toContain('Search for songs to add');
  });

  it('shows not found for an unknown id', () => {
    const { fixture, el } = setup();
    fixture.componentRef.setInput('id', 'missing');
    fixture.detectChanges();
    expect(el.textContent).toContain('Playlist not found');
  });

  it('delete asks first and removes the playlist', () => {
    const { el, library, id } = setup();
    spyOn(window, 'confirm').and.returnValue(true);
    (el.querySelector('button.delete') as HTMLButtonElement).click();
    expect(window.confirm).toHaveBeenCalledWith('Delete "Gym"?');
    expect(library.playlistById(id)()).toBeUndefined();
  });
});
