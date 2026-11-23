import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { LibraryService } from '../../state/library.service';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackRow } from '../../shared/track-row/track-row';
import { formatCount } from '../../shared/utils/format';
import { loadable } from '../../shared/utils/loadable';

/** Right panel: details about what's playing. */
@Component({
  selector: 'app-now-playing-view',
  imports: [RouterLink, Cover, LikeButton, TrackRow],
  templateUrl: './now-playing-view.html',
  styleUrl: './now-playing-view.scss',
})
export class NowPlayingView {
  private readonly api = inject(AudiusApi);
  protected readonly player = inject(PlayerService);
  protected readonly panel = inject(PanelStateService);
  protected readonly library = inject(LibraryService);

  /** False inside the phone sheet, which already shows the artwork and title. */
  readonly showHeader = input(true);

  private readonly artistId = computed(() => this.player.current()?.artistId ?? null);
  protected readonly artist = loadable(this.artistId, (id) => (id ? this.api.artist(id) : of(null)));
  private readonly artistTracks = loadable(this.artistId, (id) =>
    id ? this.api.artistTracks(id, { sort: 'plays', limit: 6 }) : of([]),
  );

  protected readonly moreByArtist = computed(() =>
    (this.artistTracks.state().data ?? []).filter((t) => t.id !== this.player.current()?.id).slice(0, 5),
  );
  protected readonly nextUp = computed(() => this.player.upNext()[0] ?? null);
  protected readonly following = computed(() => {
    const a = this.artist.state().data;
    return a ? this.library.isArtistSaved(a.id) : false;
  });

  protected readonly formatCount = formatCount;

  protected shortBio(bio: string | null): string | null {
    if (!bio) return null;
    return bio.length > 200 ? bio.slice(0, 197).trimEnd() + '…' : bio;
  }

  protected toggleFollow(): void {
    const a = this.artist.state().data;
    if (a) this.library.toggleArtistSave(a);
  }

  protected playMore(index: number): void {
    this.player.playTracks(this.moreByArtist(), index);
  }
}
