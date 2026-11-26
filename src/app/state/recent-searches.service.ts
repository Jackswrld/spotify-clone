import { Injectable, signal } from '@angular/core';
import { Album, Artist, Playlist, Track } from '../core/models';
import { albumLink, artistLink } from '../core/links';
import { safeStorage } from './safe-storage';

export type RecentKind = 'search' | 'song' | 'artist' | 'album' | 'playlist';

/** Something found through search, saved so it can be opened (or played) again. */
export interface RecentItem {
  /** Same thing = same id, so searching it again moves it to the top instead of repeating it. */
  id: string;
  kind: RecentKind;
  title: string;
  subtitle: string;
  image: string | null;
  /** Where it opens (artists, albums, playlists). */
  link: unknown[] | null;
  /** A song is saved whole, so it can be played straight from the list. */
  track?: Track;
  /** A saved search runs again with these words. */
  q?: string;
}

const KEY = 'recent-searches';
const MAX = 20;

/** Your recent searches and what you opened from them, newest first, kept on this device. */
@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  private readonly _items = signal<RecentItem[]>(load());
  readonly items = this._items.asReadonly();

  addQuery(q: string): void {
    const words = q.trim();
    if (words) this.add({ id: `search:${words.toLowerCase()}`, kind: 'search', title: words, subtitle: 'Search', image: null, link: null, q: words });
  }

  addSong(track: Track): void {
    this.add({
      id: `song:${track.id}`,
      kind: 'song',
      title: track.title,
      subtitle: `Song • ${track.artistName}`,
      image: track.artwork.small ?? track.artwork.medium,
      link: null,
      track,
    });
  }

  addArtist(artist: Artist): void {
    this.add({
      id: `artist:${artist.id}`,
      kind: 'artist',
      title: artist.name,
      subtitle: 'Artist',
      image: artist.avatar.small ?? artist.avatar.medium,
      link: artistLink(artist),
    });
  }

  addAlbum(album: Album): void {
    this.add({
      id: `album:${album.id}`,
      kind: 'album',
      title: album.name,
      subtitle: `Album • ${album.artistName}`,
      image: album.artwork.small ?? album.artwork.medium,
      link: albumLink(album),
    });
  }

  addPlaylist(playlist: Playlist): void {
    this.add({
      id: `playlist:${playlist.id}`,
      kind: 'playlist',
      title: playlist.name,
      subtitle: `Playlist • ${playlist.ownerName}`,
      image: playlist.artwork.small ?? playlist.artwork.medium,
      link: ['/playlist', playlist.id],
    });
  }

  remove(id: string): void {
    this.save(this._items().filter((i) => i.id !== id));
  }

  clear(): void {
    this.save([]);
  }

  private add(item: RecentItem): void {
    this.save([item, ...this._items().filter((i) => i.id !== item.id)].slice(0, MAX));
  }

  private save(items: RecentItem[]): void {
    this._items.set(items);
    safeStorage.set(KEY, items);
  }
}

const KINDS: readonly RecentKind[] = ['search', 'song', 'artist', 'album', 'playlist'];

/** Saved entries, minus anything malformed (an older format, a hand-edited value). */
function load(): RecentItem[] {
  return safeStorage
    .getArray<RecentItem>(KEY)
    .filter((i) => KINDS.includes(i.kind) && typeof i.title === 'string' && (i.kind !== 'song' || !!i.track?.id))
    .slice(0, MAX);
}
