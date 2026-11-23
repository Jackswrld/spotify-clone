import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LibraryService } from '../../state/library.service';
import { PlayerService } from '../../state/player.service';
import { LibraryList } from '../../shared/library-list/library-list';
import { TrackRow } from '../../shared/track-row/track-row';

/** Full-page library (mainly for phones) and the Liked songs list (?view=liked). */
@Component({
  selector: 'app-library-page',
  imports: [RouterLink, LibraryList, TrackRow],
  template: `
    <div class="library">
      @if (showLiked()) {
        <header class="liked-head">
          <a routerLink="/library" class="back" aria-label="Back to Your Library">
            <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          </a>
          <div>
            <p class="kind">Playlist</p>
            <h1>Liked songs</h1>
            <p class="count">{{ liked().length }} {{ liked().length === 1 ? 'song' : 'songs' }}</p>
          </div>
        </header>
        @if (liked().length) {
          <button type="button" class="play" aria-label="Play Liked songs" (click)="play(0)">
            <i class="fa-solid fa-play" aria-hidden="true"></i>
          </button>
          @for (t of liked(); track t.id; let i = $index) {
            <app-track-row [track]="t" [index]="i" (play)="play(i)" />
          }
        } @else {
          <p class="empty">Songs you like will appear here. Tap the heart on any song.</p>
        }
      } @else {
        <header class="head">
          <h1>Your Library</h1>
          <button type="button" class="create" (click)="create()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create
          </button>
        </header>
        <app-library-list>
          <button empty-action type="button" class="create" (click)="create()">Create playlist</button>
        </app-library-list>
      }
    </div>
  `,
  styleUrl: './library.scss',
})
export class LibraryPage {
  private readonly library = inject(LibraryService);
  private readonly player = inject(PlayerService);
  private readonly router = inject(Router);

  /** Query param ?view=liked, bound by the router. */
  readonly view = input<string | undefined>(undefined);

  protected readonly showLiked = computed(() => this.view() === 'liked');
  protected readonly liked = this.library.likedTracks;

  protected play(index: number): void {
    this.player.playTracks(this.liked(), index);
  }

  protected create(): void {
    const playlist = this.library.createPlaylist();
    this.router.navigate(['/my-playlist', playlist.id]);
  }
}
