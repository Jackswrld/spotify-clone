import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { LibraryService } from '../../state/library.service';
import { PlayerService } from '../../state/player.service';
import { Cover } from '../../shared/cover/cover';
import { TrackRow } from '../../shared/track-row/track-row';
import { TrackMenuExtra } from '../../shared/add-to-playlist/track-menu.service';
import { formatTime } from '../../shared/utils/format';
import { scrollMainToTopOn } from '../scroll-top';
import { artworkColor } from '../../shared/utils/artwork-color';

/** One of the user's own playlists: rename, reorder, remove, delete. */
@Component({
  selector: 'app-my-playlist-page',
  imports: [RouterLink, Cover, TrackRow, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './my-playlist.html',
  styleUrl: './my-playlist.scss',
})
export class MyPlaylistPage {
  private readonly library = inject(LibraryService);
  private readonly router = inject(Router);
  protected readonly player = inject(PlayerService);

  readonly id = input.required<string>();


  protected readonly playlist = computed(() => this.library.myPlaylists().find((p) => p.id === this.id()));
  /** Header tint sampled from the first track's artwork. */
  protected readonly headerColor = artworkColor(computed(() => this.playlist()?.tracks[0]?.artwork.small));

  protected readonly totalTime = computed(() =>
    formatTime((this.playlist()?.tracks ?? []).reduce((sum, t) => sum + t.duration, 0)),
  );
  protected readonly editing = signal(false);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  constructor() {
    scrollMainToTopOn(this.id);
  }

  protected menuExtras(index: number): TrackMenuExtra[] {
    return [
      {
        label: 'Remove from this playlist',
        icon: 'fa-trash-can',
        action: () => this.library.removeFromPlaylist(this.id(), index),
      },
    ];
  }

  protected startEditing(): void {
    this.editing.set(true);
    queueMicrotask(() => this.nameInput()?.nativeElement.select());
  }

  protected onNameKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveName((event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.editing.set(false);
    }
  }

  protected saveName(value: string): void {
    if (!this.editing()) return;
    this.library.renamePlaylist(this.id(), value);
    this.editing.set(false);
  }

  protected play(index = 0): void {
    const tracks = this.playlist()?.tracks ?? [];
    if (tracks.length) this.player.playTracks(tracks, index);
  }

  protected shufflePlay(): void {
    const tracks = this.playlist()?.tracks ?? [];
    if (!tracks.length) return;
    if (!this.player.shuffle()) this.player.toggleShuffle();
    this.player.playTracks(tracks, Math.floor(Math.random() * tracks.length));
  }

  protected drop(event: Pick<CdkDragDrop<unknown>, 'previousIndex' | 'currentIndex'>): void {
    this.library.moveInPlaylist(this.id(), event.previousIndex, event.currentIndex);
  }

  protected remove(): void {
    const playlist = this.playlist();
    if (!playlist || !window.confirm(`Delete "${playlist.name}"?`)) return;
    this.library.deletePlaylist(playlist.id);
    this.router.navigate(['/library']);
  }
}
