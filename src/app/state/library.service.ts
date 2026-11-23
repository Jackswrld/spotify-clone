import { Injectable, Signal, computed, signal } from '@angular/core';
import { Artist, Playlist, Track, UserPlaylist } from '../core/models';
import { safeStorage } from './safe-storage';

const KEYS = {
  liked: 'library.liked',
  savedPlaylists: 'library.savedPlaylists',
  savedArtists: 'library.savedArtists',
  myPlaylists: 'library.myPlaylists',
} as const;

const MAX_NAME = 100;

/** Reads an array from storage; anything else (corrupt, wrong type, bad entries) is dropped. */
function loadArray<T extends { id: string }>(key: string): T[] {
  return safeStorage.getArray<T>(key);
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** The user's library, kept in this browser: likes, saves and their own playlists. */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly _liked = signal<Track[]>(loadArray(KEYS.liked));
  private readonly _savedPlaylists = signal<Playlist[]>(loadArray(KEYS.savedPlaylists));
  private readonly _savedArtists = signal<Artist[]>(loadArray(KEYS.savedArtists));
  private readonly _myPlaylists = signal<UserPlaylist[]>(
    loadArray<UserPlaylist>(KEYS.myPlaylists).filter((p) => p && typeof p.id === 'string' && Array.isArray(p.tracks)),
  );

  readonly likedTracks: Signal<Track[]> = this._liked.asReadonly();
  readonly savedPlaylists: Signal<Playlist[]> = this._savedPlaylists.asReadonly();
  readonly savedArtists: Signal<Artist[]> = this._savedArtists.asReadonly();
  readonly myPlaylists: Signal<UserPlaylist[]> = this._myPlaylists.asReadonly();

  private readonly likedIds = computed(() => new Set(this._liked().map((t) => t.id)));

  // ---- Likes and saves ---------------------------------------------------

  isLiked(id: string): boolean {
    return this.likedIds().has(id);
  }

  toggleLike(track: Track): void {
    this._liked.update((list) =>
      this.isLiked(track.id) ? list.filter((t) => t.id !== track.id) : [track, ...list],
    );
    safeStorage.set(KEYS.liked, this._liked());
  }

  isPlaylistSaved(id: string): boolean {
    return this._savedPlaylists().some((p) => p.id === id);
  }

  togglePlaylistSave(playlist: Playlist): void {
    this._savedPlaylists.update((list) =>
      this.isPlaylistSaved(playlist.id) ? list.filter((p) => p.id !== playlist.id) : [playlist, ...list],
    );
    safeStorage.set(KEYS.savedPlaylists, this._savedPlaylists());
  }

  isArtistSaved(id: string): boolean {
    return this._savedArtists().some((a) => a.id === id);
  }

  toggleArtistSave(artist: Artist): void {
    this._savedArtists.update((list) =>
      this.isArtistSaved(artist.id) ? list.filter((a) => a.id !== artist.id) : [artist, ...list],
    );
    safeStorage.set(KEYS.savedArtists, this._savedArtists());
  }

  // ---- Your playlists ----------------------------------------------------

  createPlaylist(name?: string): UserPlaylist {
    const clean = name?.trim().slice(0, MAX_NAME);
    const playlist: UserPlaylist = {
      id: newId(),
      name: clean || `My Playlist #${this._myPlaylists().length + 1}`,
      tracks: [],
      createdAt: Date.now(),
    };
    this.setPlaylists([playlist, ...this._myPlaylists()]);
    return playlist;
  }

  renamePlaylist(id: string, name: string): void {
    const clean = name.trim().slice(0, MAX_NAME);
    if (!clean) return;
    this.updatePlaylist(id, (p) => ({ ...p, name: clean }));
  }

  deletePlaylist(id: string): void {
    this.setPlaylists(this._myPlaylists().filter((p) => p.id !== id));
  }

  addToPlaylist(id: string, track: Track): 'added' | 'duplicate' {
    const playlist = this._myPlaylists().find((p) => p.id === id);
    if (!playlist || playlist.tracks.some((t) => t.id === track.id)) return 'duplicate';
    this.updatePlaylist(id, (p) => ({ ...p, tracks: [...p.tracks, track] }));
    return 'added';
  }

  removeFromPlaylist(id: string, trackIndex: number): void {
    this.updatePlaylist(id, (p) => ({ ...p, tracks: p.tracks.filter((_, i) => i !== trackIndex) }));
  }

  moveInPlaylist(id: string, from: number, to: number): void {
    this.updatePlaylist(id, (p) => {
      if (from === to || from < 0 || to < 0 || from >= p.tracks.length || to >= p.tracks.length) return p;
      const tracks = [...p.tracks];
      const [item] = tracks.splice(from, 1);
      tracks.splice(to, 0, item);
      return { ...p, tracks };
    });
  }

  playlistById(id: string): Signal<UserPlaylist | undefined> {
    return computed(() => this._myPlaylists().find((p) => p.id === id));
  }

  private updatePlaylist(id: string, change: (p: UserPlaylist) => UserPlaylist): void {
    this.setPlaylists(this._myPlaylists().map((p) => (p.id === id ? change(p) : p)));
  }

  private setPlaylists(list: UserPlaylist[]): void {
    this._myPlaylists.set(list);
    safeStorage.set(KEYS.myPlaylists, list);
  }
}
