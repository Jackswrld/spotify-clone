import { TestBed } from '@angular/core/testing';
import { LibraryService } from './library.service';
import { Artist, Playlist } from '../core/models';
import { makeTrack } from '../core/testing/make-track';

const playlist: Playlist = {
  id: 'p1',
  name: 'Hot & New',
  description: null,
  isAlbum: false,
  trackCount: 3,
  artwork: { small: null, medium: null, large: null },
  ownerId: 'o1',
  ownerName: 'Owner',
  permalink: '/owner/playlist/hot',
};

const artist: Artist = {
  id: 'a1',
  name: 'Xsetra',
  handle: 'xsetra',
  verified: false,
  followerCount: 1,
  trackCount: 1,
  playlistCount: 0,
  bio: null,
  avatar: { small: null, medium: null, large: null },
  coverPhoto: null,
  permalink: '/xsetra',
};

function fresh(): LibraryService {
  TestBed.resetTestingModule();
  return TestBed.inject(LibraryService);
}

describe('LibraryService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('toggleLike adds newest-first and removes', () => {
    const lib = fresh();
    lib.toggleLike(makeTrack('1'));
    lib.toggleLike(makeTrack('2'));
    expect(lib.likedTracks().map((t) => t.id)).toEqual(['2', '1']);
    expect(lib.isLiked('1')).toBeTrue();
    lib.toggleLike(makeTrack('1'));
    expect(lib.isLiked('1')).toBeFalse();
    expect(lib.likedTracks().map((t) => t.id)).toEqual(['2']);
  });

  it('saves and unsaves playlists and artists', () => {
    const lib = fresh();
    lib.togglePlaylistSave(playlist);
    lib.toggleArtistSave(artist);
    expect(lib.isPlaylistSaved('p1')).toBeTrue();
    expect(lib.isArtistSaved('a1')).toBeTrue();
    lib.togglePlaylistSave(playlist);
    expect(lib.savedPlaylists()).toEqual([]);
  });

  it('createPlaylist names sequentially', () => {
    const lib = fresh();
    expect(lib.createPlaylist().name).toBe('My Playlist #1');
    expect(lib.createPlaylist().name).toBe('My Playlist #2');
    expect(lib.createPlaylist('Road trip').name).toBe('Road trip');
    expect(lib.myPlaylists().length).toBe(3);
  });

  it('addToPlaylist returns duplicate for the same track id', () => {
    const lib = fresh();
    const p = lib.createPlaylist();
    expect(lib.addToPlaylist(p.id, makeTrack('1'))).toBe('added');
    expect(lib.addToPlaylist(p.id, makeTrack('1'))).toBe('duplicate');
    expect(lib.playlistById(p.id)()?.tracks.length).toBe(1);
  });

  it('renamePlaylist ignores blank names and trims to 100 chars', () => {
    const lib = fresh();
    const p = lib.createPlaylist();
    lib.renamePlaylist(p.id, '   ');
    expect(lib.playlistById(p.id)()?.name).toBe('My Playlist #1');
    lib.renamePlaylist(p.id, '  Summer  ');
    expect(lib.playlistById(p.id)()?.name).toBe('Summer');
    lib.renamePlaylist(p.id, 'x'.repeat(150));
    expect(lib.playlistById(p.id)()?.name.length).toBe(100);
  });

  it('moveInPlaylist and removeFromPlaylist reorder correctly', () => {
    const lib = fresh();
    const p = lib.createPlaylist();
    ['1', '2', '3'].forEach((id) => lib.addToPlaylist(p.id, makeTrack(id)));
    lib.moveInPlaylist(p.id, 0, 2);
    expect(lib.playlistById(p.id)()?.tracks.map((t) => t.id)).toEqual(['2', '3', '1']);
    lib.removeFromPlaylist(p.id, 1);
    expect(lib.playlistById(p.id)()?.tracks.map((t) => t.id)).toEqual(['2', '1']);
  });

  it('deletePlaylist removes it', () => {
    const lib = fresh();
    const p = lib.createPlaylist();
    lib.deletePlaylist(p.id);
    expect(lib.playlistById(p.id)()).toBeUndefined();
  });

  it('persists and restores across instances', () => {
    let lib = fresh();
    lib.toggleLike(makeTrack('1'));
    lib.togglePlaylistSave(playlist);
    lib.toggleArtistSave(artist);
    const p = lib.createPlaylist('Kept');
    lib.addToPlaylist(p.id, makeTrack('9'));
    lib = fresh();
    expect(lib.isLiked('1')).toBeTrue();
    expect(lib.isPlaylistSaved('p1')).toBeTrue();
    expect(lib.isArtistSaved('a1')).toBeTrue();
    expect(lib.myPlaylists()[0].name).toBe('Kept');
    expect(lib.myPlaylists()[0].tracks[0].id).toBe('9');
  });

  it('starts empty when stored JSON is corrupt', () => {
    localStorage.setItem('library.liked', '{oops');
    localStorage.setItem('library.myPlaylists', '"not an array"');
    const lib = fresh();
    expect(lib.likedTracks()).toEqual([]);
    expect(lib.myPlaylists()).toEqual([]);
  });

  it('drops malformed entries inside stored arrays', () => {
    localStorage.setItem('library.liked', JSON.stringify([null, 42, makeTrack('1')]));
    localStorage.setItem('library.savedArtists', JSON.stringify([{ name: 'no id' }]));
    const lib = fresh();
    expect(lib.likedTracks().map((t) => t.id)).toEqual(['1']);
    expect(lib.isLiked('1')).toBeTrue();
    expect(lib.savedArtists()).toEqual([]);
  });

  it('keeps working in memory when setItem throws (quota)', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('QuotaExceededError');
    const lib = fresh();
    expect(() => lib.toggleLike(makeTrack('1'))).not.toThrow();
    expect(lib.isLiked('1')).toBeTrue();
  });
});
