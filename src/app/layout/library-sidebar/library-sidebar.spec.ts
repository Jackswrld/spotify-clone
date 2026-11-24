import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LibrarySidebar } from './library-sidebar';
import { LibraryService } from '../../state/library.service';
import { makeTrack } from '../../core/testing/make-track';
import { makeArtist } from '../../pages/testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

function setup() {
  TestBed.configureTestingModule({ imports: [LibrarySidebar], providers: [provideRouter([])] });
  const library = TestBed.inject(LibraryService);
  const fixture = TestBed.createComponent(LibrarySidebar);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const chip = (label: string) =>
    [...el.querySelectorAll('.chips button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  const titles = () => [...el.querySelectorAll('.item-title')].map((t) => t.textContent?.trim());
  return { fixture, el, library, chip, titles };
}

describe('LibrarySidebar', () => {
  let media: FakeMedia;
  beforeEach(() => {
    localStorage.clear();
    media = installFakeMatchMedia(1280);
  });
  afterEach(() => {
    media.restore();
    localStorage.clear();
  });

  it('lists liked songs, my playlists and saved artists', () => {
    const { fixture, library, titles } = setup();
    library.toggleLike(makeTrack('1'));
    library.createPlaylist('Gym');
    library.toggleArtistSave(makeArtist('a1', { name: 'Xsetra' }));
    fixture.detectChanges();
    expect(titles()).toEqual(['Liked songs', 'Gym', 'Xsetra']);
  });

  it('chips filter, and clicking the active chip returns to All', () => {
    const { fixture, library, chip, titles } = setup();
    library.createPlaylist('Gym');
    library.toggleArtistSave(makeArtist('a1', { name: 'Xsetra' }));
    fixture.detectChanges();
    chip('Artists').click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Xsetra']);
    expect(chip('Artists').getAttribute('aria-pressed')).toBe('true');
    chip('Artists').click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Gym', 'Xsetra']);
    expect(chip('All').getAttribute('aria-pressed')).toBe('true');
  });

  it('Create makes a playlist and navigates to it', () => {
    const { el, library } = setup();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    (el.querySelector('button.create') as HTMLButtonElement).click();
    const created = library.myPlaylists()[0];
    expect(created.name).toBe('My Playlist #1');
    expect(nav).toHaveBeenCalledWith(['/my-playlist', created.id]);
  });

  it('shows the empty state when the library is empty', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Create your first playlist');
    expect(el.querySelector('a[href="/search"]')).toBeTruthy();
  });

  it('collapse hides the text and persists', () => {
    const { fixture, el, library } = setup();
    library.createPlaylist('Gym');
    fixture.detectChanges();
    (el.querySelector('button.collapse') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.item-title')).toBeNull();
    expect(JSON.parse(localStorage.getItem('library.sidebar')!)).toBe('collapsed');
  });

  it('starts collapsed on tablet when nothing is saved', () => {
    media.setWidth(900);
    const { el } = setup();
    expect(el.querySelector('.sidebar')?.classList).toContain('collapsed');
  });

  it('lists saved albums under Playlists as "Album • artist", linking to the album page', () => {
    const { fixture, library, chip, titles, el } = setup();
    library.toggleAlbumSave({
      id: 'apple:77', appleId: '77', name: 'E-Mortal Boy', artistName: 'Rema', artistId: 'apple:9',
      artwork: { small: null, medium: null, large: null }, releaseDate: null, trackCount: 7, genre: null, appleUrl: '',
    });
    library.toggleArtistSave(makeArtist('apple:9', { name: 'Rema', source: 'catalog' }));
    fixture.detectChanges();
    chip('Playlists').click();
    fixture.detectChanges();
    expect(titles()).toEqual(['E-Mortal Boy']);
    expect(el.textContent).toContain('Album • Rema');
    expect(el.querySelector('a.item')?.getAttribute('href')).toBe('/album/77');
    chip('Artists').click();
    fixture.detectChanges();
    expect(el.querySelector('a.item')?.getAttribute('href')).toBe('/catalog-artist/9');
  });
});
