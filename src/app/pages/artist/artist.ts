import { Component, computed, inject, input, signal } from '@angular/core';
import { AudiusApi } from '../../core/api/audius-api';
import { Playlist } from '../../core/models';
import { PlayerService } from '../../state/player.service';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../../shared/cover/cover';
import { TrackRow } from '../../shared/track-row/track-row';
import { Shelf } from '../../shared/shelf/shelf';
import { MediaCard } from '../../shared/media-card/media-card';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { LastfmAbout } from '../../shared/lastfm-about/lastfm-about';
import { formatCount } from '../../shared/utils/format';
import { loadable } from '../../shared/utils/loadable';
import { scrollMainToTopOn } from '../scroll-top';

@Component({
  selector: 'app-artist-page',
  imports: [Cover, TrackRow, Shelf, MediaCard, ErrorState, Skeleton, LastfmAbout],
  templateUrl: './artist.html',
  styleUrl: './artist.scss',
})
export class ArtistPage {
  private readonly api = inject(AudiusApi);
  protected readonly player = inject(PlayerService);
  protected readonly library = inject(LibraryService);

  readonly id = input.required<string>();

  /** Header tint; Task 15 replaces this with the artwork colour. */
  protected readonly headerColor = signal('var(--surface-2)');

  protected readonly artist = loadable(this.id, (id) => this.api.artist(id));
  protected readonly popular = loadable(this.id, (id) => this.api.artistTracks(id, { sort: 'plays', limit: 10 }));
  protected readonly playlists = loadable(this.id, (id) => this.api.artistPlaylists(id, 12));

  protected readonly following = computed(() => this.library.isArtistSaved(this.id()));
  protected readonly formatCount = formatCount;

  constructor() {
    scrollMainToTopOn(this.id);
  }

  protected playPopular(index = 0): void {
    const tracks = this.popular.state().data ?? [];
    if (tracks.length) this.player.playTracks(tracks, index);
  }

  protected toggleFollow(): void {
    const artist = this.artist.state().data;
    if (artist) this.library.toggleArtistSave(artist);
  }

  protected playPlaylist(playlist: Playlist): void {
    this.api.playlistTracks(playlist.id).subscribe((tracks) => {
      if (tracks.length) this.player.playTracks(tracks, 0);
    });
  }
}
