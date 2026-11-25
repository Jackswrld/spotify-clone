import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LibraryService } from '../../state/library.service';
import { LayoutService } from '../../state/layout.service';
import { safeStorage } from '../../state/safe-storage';
import { LibraryList } from '../../shared/library-list/library-list';
import { RelayStatusService } from '../../core/api/relay-status';

type SidebarState = 'collapsed' | 'normal' | 'expanded';
const STORAGE_KEY = 'library.sidebar';

/** Desktop/tablet left column: "Your Library". */
@Component({
  selector: 'app-library-sidebar',
  imports: [LibraryList],
  template: `
    <div class="sidebar" [class]="state()">
      <header class="head">
        <button
          type="button"
          class="collapse"
          [attr.aria-label]="state() === 'collapsed' ? 'Expand Your Library' : 'Collapse Your Library'"
          [attr.aria-expanded]="state() !== 'collapsed'"
          (click)="toggleCollapse()"
        >
          <i class="fa-solid fa-book" aria-hidden="true"></i>
          @if (state() !== 'collapsed') {
            <span>Your Library</span>
          }
        </button>
        @if (state() !== 'collapsed') {
          <button type="button" class="create" (click)="create()">
            <i class="fa-solid fa-plus" aria-hidden="true"></i> Create
          </button>
          <button
            type="button"
            class="widen"
            [attr.aria-label]="state() === 'expanded' ? 'Show less' : 'Show more'"
            (click)="toggleExpand()"
          >
            <i class="fa-solid" [class.fa-arrow-right]="state() !== 'expanded'" [class.fa-arrow-left]="state() === 'expanded'" aria-hidden="true"></i>
          </button>
        }
      </header>

      <app-library-list class="list" [compact]="state() === 'collapsed'">
        <button empty-action type="button" class="create-empty" (click)="create()">Create playlist</button>
      </app-library-list>

      @if (state() !== 'collapsed') {
        <footer class="credit">
          Powered by <a href="https://audius.co" target="_blank" rel="noopener">Audius</a>
          @if (!relay.youtubeReady()) {
            ·
            <span title="Add a YouTube API key to server/.env (see the README, YouTube setup)">
              Chart songs can't play yet
            </span>
          }
        </footer>
      }
    </div>
  `,
  styleUrl: './library-sidebar.scss',
})
export class LibrarySidebar {
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  protected readonly relay = inject(RelayStatusService);

  protected readonly state = signal<SidebarState>(
    safeStorage.get<SidebarState | null>(STORAGE_KEY, null) ??
      (inject(LayoutService).mode() === 'tablet' ? 'collapsed' : 'normal'),
  );

  protected toggleCollapse(): void {
    this.set(this.state() === 'collapsed' ? 'normal' : 'collapsed');
  }

  protected toggleExpand(): void {
    this.set(this.state() === 'expanded' ? 'normal' : 'expanded');
  }

  protected create(): void {
    const playlist = this.library.createPlaylist();
    this.router.navigate(['/my-playlist', playlist.id]);
  }

  private set(state: SidebarState): void {
    this.state.set(state);
    safeStorage.set(STORAGE_KEY, state);
  }
}
