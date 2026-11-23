import { TestBed } from '@angular/core/testing';
import { LikeButton } from './like-button';
import { LibraryService } from '../../state/library.service';
import { makeTrack } from '../../core/testing/make-track';

describe('LikeButton', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('toggles the like and reflects it with aria-pressed and label', () => {
    const fixture = TestBed.createComponent(LikeButton);
    fixture.componentRef.setInput('track', makeTrack('1', { title: 'Fragments' }));
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Add Fragments to Liked songs');

    button.click();
    fixture.detectChanges();
    expect(TestBed.inject(LibraryService).isLiked('1')).toBeTrue();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Remove Fragments from Liked songs');
  });
});
