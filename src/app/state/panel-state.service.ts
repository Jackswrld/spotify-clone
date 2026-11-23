import { Injectable, Signal, inject, signal } from '@angular/core';
import { LayoutService } from './layout.service';

export type PanelView = 'now-playing' | 'queue';

/** Which view the right-hand panel shows, or null when it is closed. */
@Injectable({ providedIn: 'root' })
export class PanelStateService {
  private readonly _view = signal<PanelView | null>(
    inject(LayoutService).mode() === 'desktop' ? 'now-playing' : null,
  );
  readonly view: Signal<PanelView | null> = this._view.asReadonly();

  open(view: PanelView): void {
    this._view.set(view);
  }

  close(): void {
    this._view.set(null);
  }

  toggle(view: PanelView): void {
    this._view.update((current) => (current === view ? null : view));
  }
}
