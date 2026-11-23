import { Injectable, Signal, signal } from '@angular/core';
import { Track } from '../../core/models';

/** Extra entries a screen can add to the menu (e.g. "Remove from this playlist"). */
export interface TrackMenuExtra {
  label: string;
  icon: string;
  action: () => void;
}

export interface TrackMenuState {
  track: Track;
  anchor: HTMLElement | null;
  extras: TrackMenuExtra[];
}

/** Opens the single track menu rendered in the app shell. */
@Injectable({ providedIn: 'root' })
export class TrackMenuService {
  private readonly _state = signal<TrackMenuState | null>(null);
  readonly state: Signal<TrackMenuState | null> = this._state.asReadonly();

  open(track: Track, anchor: HTMLElement | null, extras: TrackMenuExtra[] = []): void {
    this._state.set({ track, anchor, extras });
  }

  close(): void {
    const anchor = this._state()?.anchor;
    this._state.set(null);
    if (anchor?.isConnected) anchor.focus();
  }
}
