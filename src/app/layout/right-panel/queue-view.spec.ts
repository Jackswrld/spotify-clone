import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { QueueView } from './queue-view';
import { PlayerService } from '../../state/player.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';

function setup(queue: Track[], index: number) {
  const q = signal(queue);
  const i = signal(index);
  const player = {
    queue: q,
    index: i,
    current: computed(() => q()[i()] ?? null),
    upNext: computed(() => q().slice(i() + 1)),
    isPlaying: signal(false),
    moveInQueue: jasmine.createSpy('moveInQueue'),
    removeFromQueue: jasmine.createSpy('removeFromQueue'),
    clearQueue: jasmine.createSpy('clearQueue'),
    playTracks: jasmine.createSpy('playTracks'),
    playAt: jasmine.createSpy('playAt'),
  };
  TestBed.configureTestingModule({
    imports: [QueueView],
    providers: [provideRouter([]), { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(QueueView);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, player };
}

const FIVE = ['1', '2', '3', '4', '5'].map((id) => makeTrack(id));

describe('QueueView', () => {
  it('shows now playing and next up', () => {
    const { el } = setup(FIVE, 1);
    expect(el.querySelector('.now app-track-row')).toBeTruthy();
    expect(el.querySelectorAll('.next app-track-row').length).toBe(3);
  });

  it('maps drop indices to queue indices (offset by current index + 1)', () => {
    const { fixture, player } = setup(FIVE, 1);
    fixture.debugElement
      .query(By.directive(CdkDropList))
      .triggerEventHandler('cdkDropListDropped', { previousIndex: 0, currentIndex: 2 });
    expect(player.moveInQueue).toHaveBeenCalledWith(2, 4);
  });

  it('remove calls removeFromQueue with the queue index', () => {
    const { el, player } = setup(FIVE, 1);
    const removes = el.querySelectorAll('.next button.remove');
    (removes[1] as HTMLButtonElement).click();
    expect(player.removeFromQueue).toHaveBeenCalledWith(3);
  });

  it('clicking a next-up row jumps to that queue index without rebuilding the queue', () => {
    const { el, player } = setup(FIVE, 1);
    (el.querySelectorAll('.next app-track-row button.main')[0] as HTMLButtonElement).click();
    expect(player.playAt).toHaveBeenCalledWith(2);
    expect(player.playTracks).not.toHaveBeenCalled();
  });

  it('shows empty message when upNext is empty', () => {
    const { el } = setup(FIVE, 4);
    expect(el.textContent).toContain('Your queue is empty');
  });

  it('Clear queue calls clearQueue', () => {
    const { el, player } = setup(FIVE, 1);
    (el.querySelector('button.clear') as HTMLButtonElement).click();
    expect(player.clearQueue).toHaveBeenCalled();
  });
});
