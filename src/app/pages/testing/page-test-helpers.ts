import { signal } from '@angular/core';
import { Artist, Playlist, Track } from '../../core/models';

/** Writable fake of the PlayerService surface pages use. */
export function fakePlayer() {
  return {
    current: signal<Track | null>(null),
    isPlaying: signal(false),
    shuffle: signal(false),
    time: signal(0),
    playTracks: jasmine.createSpy('playTracks'),
    toggle: jasmine.createSpy('toggle'),
    toggleShuffle: jasmine.createSpy('toggleShuffle'),
    seek: jasmine.createSpy('seek'),
  };
}

export function makeArtist(id: string, patch: Partial<Artist> = {}): Artist {
  return {
    id,
    name: `Artist ${id}`,
    handle: `artist${id}`,
    verified: false,
    followerCount: 1200,
    trackCount: 4,
    playlistCount: 0,
    bio: 'Makes music.',
    avatar: { small: null, medium: null, large: null },
    coverPhoto: null,
    permalink: `/artist${id}`,
    ...patch,
  };
}

export function makePlaylist(id: string, patch: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name: `Playlist ${id}`,
    description: null,
    isAlbum: false,
    trackCount: 3,
    artwork: { small: null, medium: null, large: null },
    ownerId: 'o1',
    ownerName: 'Owner',
    permalink: `/owner/playlist/${id}`,
    ...patch,
  };
}
