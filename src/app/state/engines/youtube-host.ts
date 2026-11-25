import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * The element that holds the YouTube player. Catalog songs are audio-only in this app,
 * so the player is kept off screen: never seen, never focusable, never clickable.
 */
@Injectable({ providedIn: 'root' })
export class YouTubeHost {
  readonly host: HTMLElement;

  constructor() {
    const doc = inject(DOCUMENT);
    this.host = doc.createElement('div');
    this.host.className = 'yt-host';
    this.host.setAttribute('aria-hidden', 'true');
    this.host.inert = true;
    Object.assign(this.host.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '200px',
      height: '200px',
      pointerEvents: 'none',
    });
    doc.body.appendChild(this.host);
  }
}
