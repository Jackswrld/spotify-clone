import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CatalogApi } from '../../core/api/catalog-api';
import { appleIdOf } from '../../core/links';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../../shared/cover/cover';
import { TrackRow } from '../../shared/track-row/track-row';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { loadable } from '../../shared/utils/loadable';
import { artworkColor } from '../../shared/utils/artwork-color';
import { scrollMainToTopOn } from '../scroll-top';

/** A mainstream (Apple catalog) album or single. */
@Component({
  selector: 'app-album-page',
  imports: [RouterLink, Cover, TrackRow, ErrorState, Skeleton],
  templateUrl: './album.html',
  styleUrl: './album.scss',
})
export class AlbumPage {
  private readonly catalog = inject(CatalogApi);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);
  protected readonly appleIdOf = appleIdOf;

  readonly appleId = input.required<string>();

  protected readonly result = loadable(this.appleId, (id) => this.catalog.album(id));
  protected readonly headerColor = artworkColor(computed(() => this.result.state().data?.album.artwork.small));
  protected readonly saved = computed(() => this.library.isAlbumSaved(`apple:${this.appleId()}`));

  constructor() {
    scrollMainToTopOn(this.appleId);
  }

  protected isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status !== 404;
  }

  protected year(date: string | null): string | null {
    return date ? String(new Date(date).getFullYear()) : null;
  }

  protected play(index = 0): void {
    const tracks = this.result.state().data?.tracks ?? [];
    if (tracks.length) this.player.playTracks(tracks, index);
  }

  protected shufflePlay(): void {
    const tracks = this.result.state().data?.tracks ?? [];
    if (!tracks.length) return;
    if (!this.player.shuffle()) this.player.toggleShuffle();
    this.player.playTracks(tracks, Math.floor(Math.random() * tracks.length));
  }

  protected toggleSave(): void {
    const album = this.result.state().data?.album;
    if (album) this.library.toggleAlbumSave(album);
  }
}
