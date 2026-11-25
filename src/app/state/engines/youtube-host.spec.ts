import { TestBed } from '@angular/core/testing';
import { YouTubeHost } from './youtube-host';

describe('YouTubeHost', () => {
  it('keeps the player off screen, hidden from screen readers and unclickable', () => {
    const { host } = TestBed.inject(YouTubeHost);
    expect(host.isConnected).toBeTrue();
    const r = host.getBoundingClientRect();
    expect(r.right).toBeLessThanOrEqual(0);
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.inert).toBeTrue();
    expect(getComputedStyle(host).pointerEvents).toBe('none');
    host.remove();
  });
});
