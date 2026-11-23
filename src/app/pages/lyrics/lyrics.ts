import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlayerService } from '../../state/player.service';
import { LyricsService } from '../../state/lyrics.service';
import { LyricsLines } from '../../shared/lyrics-lines/lyrics-lines';
import { Skeleton } from '../../shared/state-views/skeleton';
import { artworkColor } from '../../shared/utils/artwork-color';

/** Full-screen synced lyrics for the current track. */
@Component({
  selector: 'app-lyrics-page',
  imports: [RouterLink, LyricsLines, Skeleton],
  template: `
    <div class="lyrics" [style.background]="'linear-gradient(180deg, ' + color() + ' 0%, var(--surface-1) 100%)'">
      @if (player.current(); as track) {
        <header class="head">
          <a [routerLink]="['/track', track.id]" class="title">{{ track.title }}</a>
          <span class="artist">{{ track.artistName }}</span>
        </header>

        @let state = lyrics.lyrics();
        @switch (state.status) {
          @case ('loading') {
            <app-skeleton shape="text" [count]="8" />
          }
          @case ('ready') {
            @if (state.data?.instrumental) {
              <p class="message">♪ Instrumental</p>
            } @else if (state.data?.lines?.length) {
              <app-lyrics-lines [lines]="state.data!.lines" [activeIndex]="lyrics.activeIndex()" (seek)="player.seek($event)" />
            } @else {
              <p class="plain">{{ state.data?.plain }}</p>
            }
            <p class="credit">Lyrics from <a href="https://lrclib.net" target="_blank" rel="noopener">LRCLIB</a></p>
          }
          @case ('error') {
            <p class="message">Couldn't load lyrics right now.</p>
          }
          @default {
            <p class="message">No lyrics found for this song</p>
          }
        }
      } @else {
        <p class="message">Play a song to see its lyrics</p>
      }
    </div>
  `,
  styles: `
    .lyrics {
      min-height: 100%;
      padding: 32px clamp(16px, 5vw, 64px) 64px;
    }
    .head {
      display: flex;
      flex-direction: column;
      margin-bottom: 32px;
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      &:hover {
        text-decoration: underline;
      }
    }
    .artist {
      font-size: 13px;
      color: var(--text-muted);
    }
    .plain {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.6;
      white-space: pre-line;
    }
    .message {
      padding: 48px 0;
      font-size: 22px;
      font-weight: 700;
    }
    .credit {
      margin-top: 32px;
      font-size: 12px;
      color: var(--text-muted);
      a {
        text-decoration: underline;
      }
    }
  `,
})
export class LyricsPage {
  protected readonly player = inject(PlayerService);
  protected readonly lyrics = inject(LyricsService);
  /** Background sampled from the current artwork. */
  protected readonly color = artworkColor(computed(() => this.player.current()?.artwork.small));
}
