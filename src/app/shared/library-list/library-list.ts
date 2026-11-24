import { Component, computed, inject, input, signal } from '@angular/core';
import { artistLink } from '../../core/links';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../cover/cover';

export type LibraryFilter = 'All' | 'Playlists' | 'Artists' | 'Liked songs';

interface LibraryItem {
  key: string;
  kind: 'liked' | 'mine' | 'playlist' | 'artist';
  title: string;
  subtitle: string;
  image: string | null;
  seed: string;
  round: boolean;
  link: unknown[];
  queryParams: Record<string, string> | null;
}

const LIKED_GRADIENT = 'linear-gradient(135deg, var(--liked-a), var(--liked-b))';

/** Liked songs, your playlists, saved playlists and saved artists, with filter chips. */
@Component({
  selector: 'app-library-list',
  imports: [RouterLink, RouterLinkActive, Cover],
  templateUrl: './library-list.html',
  styleUrl: './library-list.scss',
})
export class LibraryList {
  private readonly library = inject(LibraryService);

  /** Collapsed sidebar: covers only, no chips or text. */
  readonly compact = input(false);

  protected readonly filters: LibraryFilter[] = ['All', 'Playlists', 'Artists', 'Liked songs'];
  protected readonly filter = signal<LibraryFilter>('All');
  protected readonly likedGradient = LIKED_GRADIENT;

  private readonly allItems = computed<LibraryItem[]>(() => {
    const items: LibraryItem[] = [];
    const liked = this.library.likedTracks();
    if (liked.length) {
      items.push({
        key: 'liked',
        kind: 'liked',
        title: 'Liked songs',
        subtitle: `Playlist • ${liked.length} ${liked.length === 1 ? 'song' : 'songs'}`,
        image: null,
        seed: 'liked',
        round: false,
        link: ['/library'],
        queryParams: { view: 'liked' },
      });
    }
    for (const p of this.library.myPlaylists()) {
      items.push({
        key: 'mine:' + p.id,
        kind: 'mine',
        title: p.name,
        subtitle: `Playlist • ${p.tracks.length} ${p.tracks.length === 1 ? 'song' : 'songs'}`,
        image: p.tracks[0]?.artwork.small ?? null,
        seed: p.id,
        round: false,
        link: ['/my-playlist', p.id],
        queryParams: null,
      });
    }
    for (const p of this.library.savedPlaylists()) {
      items.push({
        key: 'playlist:' + p.id,
        kind: 'playlist',
        title: p.name,
        subtitle: `${p.isAlbum ? 'Album' : 'Playlist'} • ${p.ownerName}`,
        image: p.artwork.small,
        seed: p.id,
        round: false,
        link: ['/playlist', p.id],
        queryParams: null,
      });
    }
    for (const a of this.library.savedArtists()) {
      items.push({
        key: 'artist:' + a.id,
        kind: 'artist',
        title: a.name,
        subtitle: 'Artist',
        image: a.avatar.small,
        seed: a.id,
        round: true,
        link: artistLink(a),
        queryParams: null,
      });
    }
    return items;
  });

  protected readonly items = computed(() => {
    const all = this.allItems();
    switch (this.filter()) {
      case 'Playlists':
        return all.filter((i) => i.kind !== 'artist');
      case 'Artists':
        return all.filter((i) => i.kind === 'artist');
      case 'Liked songs':
        return all.filter((i) => i.kind === 'liked');
      default:
        return all;
    }
  });

  protected readonly isEmpty = computed(() => this.allItems().length === 0);

  protected selectFilter(f: LibraryFilter): void {
    this.filter.set(this.filter() === f && f !== 'All' ? 'All' : f);
  }
}
