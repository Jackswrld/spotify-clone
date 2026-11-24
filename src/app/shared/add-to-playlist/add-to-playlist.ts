import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { artistLink } from '../../core/links';
import { Router } from '@angular/router';
import { LibraryService } from '../../state/library.service';
import { PlayerService } from '../../state/player.service';
import { ToastService } from '../../state/toast.service';
import { LayoutService } from '../../state/layout.service';
import { UserPlaylist } from '../../core/models';
import { TrackMenuService } from './track-menu.service';

const MENU_WIDTH = 260;
const MARGIN = 8;

/** The track "⋯" menu: popover on desktop/tablet, bottom sheet on phone. */
@Component({
  selector: 'app-track-menu',
  templateUrl: './add-to-playlist.html',
  styleUrl: './add-to-playlist.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(document:pointerdown)': 'onOutside($event)',
    '(window:resize)': 'menu.state() && close()',
  },
})
export class TrackMenu {
  protected readonly menu = inject(TrackMenuService);
  protected readonly library = inject(LibraryService);
  private readonly player = inject(PlayerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);

  protected readonly showPlaylists = signal(false);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly isSheet = computed(() => this.layout.mode() === 'phone');

  /** Fixed position next to the anchor, flipped to stay on screen. */
  protected readonly position = computed(() => {
    const state = this.menu.state();
    if (!state?.anchor || this.isSheet()) return null;
    const rect = state.anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right - MENU_WIDTH;
    if (left < MARGIN) left = Math.min(rect.left, vw - MENU_WIDTH - MARGIN);
    const below = rect.bottom + 4;
    const openUp = below + 320 > vh && rect.top > vh / 2;
    return openUp
      ? { left: Math.max(MARGIN, left), bottom: vh - rect.top + 4, top: null }
      : { left: Math.max(MARGIN, left), top: below, bottom: null };
  });

  constructor() {
    effect(() => {
      // Each time the menu opens: start on the main list and focus the first item.
      if (this.menu.state()) {
        this.showPlaylists.set(false);
        queueMicrotask(() => this.panel()?.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
      }
    });
  }

  protected close(): void {
    this.menu.close();
  }

  protected onEscape(): void {
    if (this.menu.state()) this.close();
  }

  protected onOutside(event: Event): void {
    const state = this.menu.state();
    if (!state) return;
    const target = event.target as Node;
    if (this.panel()?.nativeElement.contains(target) || state.anchor?.contains(target)) return;
    this.close();
  }

  protected playNext(): void {
    const track = this.menu.state()?.track;
    if (track) this.player.playNext(track);
    this.close();
  }

  protected addToQueue(): void {
    const track = this.menu.state()?.track;
    if (track) {
      this.player.addToQueue(track);
      this.toast.show('Added to queue');
    }
    this.close();
  }

  protected toggleLike(): void {
    const track = this.menu.state()?.track;
    if (track) this.library.toggleLike(track);
    this.close();
  }

  protected addTo(playlist: UserPlaylist): void {
    const track = this.menu.state()?.track;
    if (!track) return;
    const result = this.library.addToPlaylist(playlist.id, track);
    this.toast.show(result === 'added' ? `Added to ${playlist.name}` : `Already in ${playlist.name}`);
    this.close();
  }

  protected addToNew(): void {
    const track = this.menu.state()?.track;
    if (!track) return;
    const playlist = this.library.createPlaylist();
    this.library.addToPlaylist(playlist.id, track);
    this.toast.show(`Added to ${playlist.name}`);
    this.close();
  }

  protected goToArtist(): void {
    const track = this.menu.state()?.track;
    this.close();
    if (track) this.router.navigate(artistLink(track));
  }

  protected runExtra(action: () => void): void {
    this.close();
    action();
  }

  /** Arrow keys move between menu items. */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = [...(this.panel()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (!items.length) return;
    event.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
    items[next].focus();
  }
}
