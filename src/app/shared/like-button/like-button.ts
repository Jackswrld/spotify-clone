import { Component, computed, inject, input } from '@angular/core';
import { Track } from '../../core/models';
import { LibraryService } from '../../state/library.service';

@Component({
  selector: 'app-like-button',
  template: `
    <button
      type="button"
      [attr.aria-pressed]="liked()"
      [attr.aria-label]="liked() ? 'Remove ' + track().title + ' from Liked songs' : 'Add ' + track().title + ' to Liked songs'"
      (click)="$event.stopPropagation(); library.toggleLike(track())"
    >
      <i [class]="liked() ? 'fa-solid fa-heart' : 'fa-regular fa-heart'" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    @use 'ui';
    button {
      @include ui.icon-button(var(--size, 32px));
    }
    button[aria-pressed='true'] {
      color: var(--accent);
    }
  `,
})
export class LikeButton {
  protected readonly library = inject(LibraryService);
  readonly track = input.required<Track>();
  protected readonly liked = computed(() => this.library.isLiked(this.track().id));
}
