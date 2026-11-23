import { Signal, effect } from '@angular/core';

/** Scrolls the main content area to the top whenever `key` changes. */
export function scrollMainToTopOn(key: Signal<unknown>): void {
  effect(() => {
    key();
    document.querySelector('.shell-main')?.scrollTo({ top: 0 });
  });
}
