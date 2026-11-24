import { Component, computed, inject, input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogApi } from '../../core/api/catalog-api';
import { albumLink } from '../../core/links';
import { Album } from '../../core/models';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../../shared/cover/cover';
import { TrackRow } from '../../shared/track-row/track-row';
import { Shelf } from '../../shared/shelf/shelf';
import { MediaCard } from '../../shared/media-card/media-card';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { LastfmAbout } from '../../shared/lastfm-about/lastfm-about';
import { loadable } from '../../shared/utils/loadable';
import { artworkColor } from '../../shared/utils/artwork-color';
import { scrollMainToTopOn } from '../scroll-top';

/** A mainstream (Apple catalog) artist: latest releases, top songs, bio, similar artists. */
@Component({
  selector: 'app-catalog-artist-page',
  imports: [Cover, TrackRow, Shelf, MediaCard, ErrorState, Skeleton, LastfmAbout],
  templateUrl: './catalog-artist.html',
  styleUrl: './catalog-artist.scss',
})
export class CatalogArtistPage {
  private readonly catalog = inject(CatalogApi);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);
  protected readonly albumLink = albumLink;

  readonly appleId = input.required<string>();

  protected readonly artist = loadable(this.appleId, (id) => this.catalog.artist(id));
  protected readonly albums = loadable(this.appleId, (id) => this.catalog.artistAlbums(id, 20));
  protected readonly topSongs = loadable(this.appleId, (id) => this.catalog.artistTopSongs(id, 10));

  /** Apple has no artist photos in this API, so the newest release's art stands in. */
  protected readonly image = computed(() => this.albums.state().data?.[0]?.artwork.small ?? null);
  protected readonly headerColor = artworkColor(this.image);
  protected readonly following = computed(() => this.library.isArtistSaved(`apple:${this.appleId()}`));

  constructor() {
    scrollMainToTopOn(this.appleId);
  }

  protected isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status !== 404;
  }

  protected releaseLabel(a: Album): string {
    if (!a.releaseDate) return 'Album';
    return new Date(a.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  protected playTop(index = 0): void {
    const songs = this.topSongs.state().data ?? [];
    if (songs.length) this.player.playTracks(songs, index);
  }

  protected playAlbum(album: Album): void {
    this.catalog.album(album.appleId).subscribe((r) => {
      if (r.tracks.length) this.player.playTracks(r.tracks, 0);
    });
  }

  protected toggleFollow(): void {
    const artist = this.artist.state().data;
    if (artist) this.library.toggleArtistSave(artist);
  }
}
