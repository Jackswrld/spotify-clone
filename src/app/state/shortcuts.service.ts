import { DestroyRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlayerService } from './player.service';
import { LayoutService } from './layout.service';

const SEEK_STEP_S = 5;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest('[contenteditable="true"]') !== null
  );
}

/**
 * Space play/pause · Shift+←/→ previous/next · ←/→ seek 5 s · M mute · / search.
 * Ignored while typing and when Ctrl, Meta or Alt is held.
 */
@Injectable({ providedIn: 'root' })
export class ShortcutsService {
  private readonly player = inject(PlayerService);
  private readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private listening = false;

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTyping(event.target)) return;

    const handled = this.handle(event);
    if (handled) event.preventDefault();
  };

  constructor() {
    // Never leave a document listener behind when the app (or a test) is torn down.
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (this.listening) return;
    document.addEventListener('keydown', this.onKeydown);
    this.listening = true;
  }

  stop(): void {
    document.removeEventListener('keydown', this.onKeydown);
    this.listening = false;
  }

  private handle(event: KeyboardEvent): boolean {
    switch (event.key) {
      case ' ':
      case 'Spacebar':
        // A focused button already activates on Space; don't toggle twice.
        if (event.target instanceof HTMLButtonElement || (event.target as HTMLElement)?.getAttribute?.('role') === 'button') {
          return false;
        }
        this.player.toggle();
        return true;
      case 'ArrowRight':
        if (event.shiftKey) this.player.next();
        else this.player.seek(this.player.time() + SEEK_STEP_S);
        return true;
      case 'ArrowLeft':
        if (event.shiftKey) this.player.previous();
        else this.player.seek(this.player.time() - SEEK_STEP_S);
        return true;
      case 'm':
      case 'M':
        this.player.toggleMute();
        return true;
      case '/':
        if (this.layout.mode() === 'phone') {
          this.router.navigate(['/search']);
        } else {
          document.getElementById('global-search')?.focus();
        }
        return true;
      default:
        return false;
    }
  }
}
