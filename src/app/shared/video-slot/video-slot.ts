import { Component, DestroyRef, ElementRef, OnInit, inject, input } from '@angular/core';
import { VideoDockService } from '../../state/video-dock.service';

/**
 * An empty square where the YouTube video should appear (e.g. in place of album art).
 * The single player element is positioned over it by <app-video-dock>; nothing is drawn on top.
 */
@Component({
  selector: 'app-video-slot',
  template: '',
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 200px;
      aspect-ratio: 1 / 1;
      border-radius: var(--radius-m);
      background: var(--bg);
    }
  `,
})
export class VideoSlot implements OnInit {
  private readonly dock = inject(VideoDockService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** Higher wins when several slots are on screen (panel = 2, phone sheet = 3). */
  readonly priority = input.required<number>();

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;
    const unregister = this.dock.registerSlot(element, this.priority());
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => this.dock.relayout()) : null;
    observer?.observe(element);
    this.destroyRef.onDestroy(() => {
      observer?.disconnect();
      unregister();
      this.dock.relayout();
    });
  }
}
