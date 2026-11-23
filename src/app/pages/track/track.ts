import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { LyricsService } from '../../state/lyrics.service';
import { LyricsLines } from '../../shared/lyrics-lines/lyrics-lines';
import { LastfmAbout } from '../../shared/lastfm-about/lastfm-about';
import { TrackMenuService } from '../../shared/add-to-playlist/track-menu.service';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackRow } from '../../shared/track-row/track-row';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { formatCount, formatTime } from '../../shared/utils/format';
import { loadable } from '../../shared/utils/loadable';
import { scrollMainToTopOn } from '../scroll-top';

@Component({
  selector: 'app-track-page',
  imports: [RouterLink, Cover, LikeButton, TrackRow, ErrorState, Skeleton, LyricsLines, LastfmAbout],
  templateUrl: './track.html',
  styleUrl: './track.scss',
})
export class TrackPage {
  private readonly api = inject(AudiusApi);
  protected readonly player = inject(PlayerService);
  protected readonly trackMenu = inject(TrackMenuService);
  protected readonly lyricsService = inject(LyricsService);

  /** Route param, bound by the router. */
  readonly id = input.required<string>();

  /** Header tint; Task 15 replaces this with the artwork colour. */
  protected readonly headerColor = signal('var(--surface-2)');

  protected readonly track = loadable(this.id, (id) => this.api.track(id));
  private readonly artistId = computed(() => this.track.state().data?.artistId ?? null);
  protected readonly artist = loadable(this.artistId, (id) => (id ? this.api.artist(id) : of(null)));
  private readonly artistTracks = loadable(this.artistId, (id) =>
    id ? this.api.artistTracks(id, { sort: 'plays', limit: 10 }) : of([]),
  );

  protected readonly moreByArtist = computed(() =>
    (this.artistTracks.state().data ?? []).filter((t) => t.id !== this.id()),
  );

  protected readonly isCurrent = computed(() => this.player.current()?.id === this.id());

  /** Lyrics for this page's track when it isn't the one playing (the playing one comes from LyricsService). */
  private readonly trackForLyrics = computed(() => (this.isCurrent() ? null : this.track.state().data));
  protected readonly staticLyrics = loadable(this.trackForLyrics, (t) => (t ? this.lyricsService.fetchFor(t) : of(null)));
  protected readonly isPlayingThis = computed(() => this.isCurrent() && this.player.isPlaying());

  protected readonly formatCount = formatCount;
  protected readonly formatTime = formatTime;

  constructor() {
    scrollMainToTopOn(this.id);
  }

  protected year(date: string | null): string | null {
    return date ? String(new Date(date).getFullYear()) : null;
  }

  protected playOrPause(): void {
    const track = this.track.state().data;
    if (!track) return;
    if (this.isCurrent()) {
      this.player.toggle();
      return;
    }
    this.player.playTracks([track, ...this.moreByArtist()], 0);
  }

  protected playMore(index: number): void {
    this.player.playTracks(this.moreByArtist(), index);
  }
}
