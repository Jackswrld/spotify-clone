import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { CatalogApi } from '../../core/api/catalog-api';
import { YouTubeMatchApi } from '../../core/api/youtube-match-api';
import { appleIdOf, artistLink } from '../../core/links';
import { PlayerService } from '../../state/player.service';
import { LyricsService } from '../../state/lyrics.service';
import { TrackMenuService } from '../../shared/add-to-playlist/track-menu.service';
import { Cover } from '../../shared/cover/cover';
import { LikeButton } from '../../shared/like-button/like-button';
import { TrackRow } from '../../shared/track-row/track-row';
import { ErrorState } from '../../shared/state-views/error-state';
import { Skeleton } from '../../shared/state-views/skeleton';
import { LyricsLines } from '../../shared/lyrics-lines/lyrics-lines';
import { LastfmAbout } from '../../shared/lastfm-about/lastfm-about';
import { formatTime } from '../../shared/utils/format';
import { loadable } from '../../shared/utils/loadable';
import { artworkColor } from '../../shared/utils/artwork-color';
import { scrollMainToTopOn } from '../scroll-top';

/** A mainstream (Apple catalog) song. Plays through YouTube. */
@Component({
  selector: 'app-song-page',
  imports: [RouterLink, Cover, LikeButton, TrackRow, ErrorState, Skeleton, LyricsLines, LastfmAbout],
  templateUrl: './song.html',
  styleUrl: './song.scss',
})
export class SongPage {
  private readonly catalog = inject(CatalogApi);
  private readonly matchApi = inject(YouTubeMatchApi);
  protected readonly player = inject(PlayerService);
  protected readonly trackMenu = inject(TrackMenuService);
  protected readonly lyricsService = inject(LyricsService);
  protected readonly artistLink = artistLink;
  protected readonly formatTime = formatTime;

  /** Route param, bound by the router. */
  readonly appleId = input.required<string>();

  protected readonly song = loadable(this.appleId, (id) => this.catalog.song(id));
  private readonly artistAppleId = computed(() => {
    const s = this.song.state().data;
    return s ? appleIdOf(s.artistId) : null;
  });
  protected readonly artist = loadable(this.artistAppleId, (id) => (id ? this.catalog.artist(id) : of(null)));
  private readonly artistSongs = loadable(this.artistAppleId, (id) => (id ? this.catalog.artistTopSongs(id, 10) : of([])));
  protected readonly moreByArtist = computed(() =>
    (this.artistSongs.state().data ?? []).filter((t) => t.appleId !== this.appleId()),
  );

  protected readonly headerColor = artworkColor(computed(() => this.song.state().data?.artwork.small));
  protected readonly isCurrent = computed(() => this.player.current()?.appleId === this.appleId());
  protected readonly isPlayingThis = computed(() => this.isCurrent() && this.player.isPlaying());

  /** Static lyrics when this song isn't the one playing. */
  private readonly songForLyrics = computed(() => (this.isCurrent() ? null : this.song.state().data));
  protected readonly staticLyrics = loadable(this.songForLyrics, (t) => (t ? this.lyricsService.fetchFor(t) : of(null)));

  /** Known YouTube video for this song — only from memory; this page never spends a search. */
  protected readonly youtubeVideo = computed(() => {
    this.player.current();
    this.player.isPlaying();
    const s = this.song.state().data;
    return s ? this.matchApi.cached(s.id) : null;
  });

  constructor() {
    scrollMainToTopOn(this.appleId);
  }

  protected isNetworkError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status !== 404;
  }

  protected year(date: string | null): string | null {
    return date ? String(new Date(date).getFullYear()) : null;
  }

  protected playOrPause(): void {
    const song = this.song.state().data;
    if (!song) return;
    if (this.isCurrent()) {
      this.player.toggle();
      return;
    }
    this.player.playTracks([song, ...this.moreByArtist()], 0);
  }

  protected playMore(index: number): void {
    this.player.playTracks(this.moreByArtist(), index);
  }
}
