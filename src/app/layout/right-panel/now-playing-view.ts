import { ArtistPhotoApi } from '../../core/api/artist-photo-api';
import { Component, computed, inject, input } from '@angular/core';
import { artistLink, trackLink } from '../../core/links';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AudiusApi } from '../../core/api/audius-api';
import { CatalogApi } from '../../core/api/catalog-api';
import { appleIdOf } from '../../core/links';
import { Track } from '../../core/models';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { LibraryService } from '../../state/library.service';
import { LyricsService } from '../../state/lyrics.service';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackRow } from '../../shared/track-row/track-row';
import { LastfmAbout } from '../../shared/lastfm-about/lastfm-about';
import { formatCount } from '../../shared/utils/format';
import { loadable } from '../../shared/utils/loadable';

/** Right panel: details about what's playing. */
@Component({
  selector: 'app-now-playing-view',
  imports: [RouterLink, Cover, LikeButton, TrackRow, LastfmAbout],
  templateUrl: './now-playing-view.html',
  styleUrl: './now-playing-view.scss',
})
export class NowPlayingView {
  protected readonly trackLink = trackLink;
  protected readonly artistLink = artistLink;
  private readonly api = inject(AudiusApi);
  private readonly catalog = inject(CatalogApi);
  protected readonly player = inject(PlayerService);
  protected readonly panel = inject(PanelStateService);
  protected readonly library = inject(LibraryService);
  protected readonly lyrics = inject(LyricsService);

  /** False inside the phone sheet, which already shows the artwork and title. */
  readonly showHeader = input(true);

  /** The current artist and where their data comes from (Audius or the Apple catalog). */
  private readonly photos = inject(ArtistPhotoApi);
  private readonly artistKey = computed<{ id: string; catalog: boolean } | null>(
    () => {
      const t: Track | null = this.player.current();
      return t ? { id: t.artistId, catalog: t.source === 'catalog' } : null;
    },
    { equal: (a, b) => a?.id === b?.id && a?.catalog === b?.catalog },
  );
  protected readonly artist = loadable(this.artistKey, (k) =>
    !k
      ? of(null)
      : k.catalog
        ? this.catalog.artist(appleIdOf(k.id)).pipe(switchMap((a) => this.photos.withPhoto(a)))
        : this.api.artist(k.id),
  );
  private readonly artistTracks = loadable(this.artistKey, (k) =>
    !k
      ? of([])
      : k.catalog
        ? this.catalog.artistTopSongs(appleIdOf(k.id), 6)
        : this.api.artistTracks(k.id, { sort: 'plays', limit: 6 }),
  );

  protected readonly moreByArtist = computed(() =>
    (this.artistTracks.state().data ?? []).filter((t) => t.id !== this.player.current()?.id).slice(0, 5),
  );
  /** The active lyric line with one line either side. */
  protected readonly lyricPreview = computed(() => {
    const lines = this.lyrics.lyrics().data?.lines ?? [];
    if (!lines.length) return [];
    const active = Math.max(0, this.lyrics.activeIndex());
    const start = Math.max(0, Math.min(active - 1, lines.length - 3));
    return lines.slice(start, start + 3).map((line, i) => ({ ...line, active: start + i === this.lyrics.activeIndex() }));
  });

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
