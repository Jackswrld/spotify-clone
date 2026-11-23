import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

const PHONE_QUERY = '(max-width: 767.98px)';
const TABLET_QUERY = '(max-width: 1023.98px)';

/** Current breakpoint: phone < 768px, tablet 768–1023px, desktop ≥ 1024px. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly _mode = signal<LayoutMode>('desktop');
  readonly mode: Signal<LayoutMode> = this._mode.asReadonly();

  constructor() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const phone = window.matchMedia(PHONE_QUERY);
    const tablet = window.matchMedia(TABLET_QUERY);
    const update = () => this._mode.set(phone.matches ? 'phone' : tablet.matches ? 'tablet' : 'desktop');
    update();
    phone.addEventListener('change', update);
    tablet.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => {
      phone.removeEventListener('change', update);
      tablet.removeEventListener('change', update);
    });
  }
}
