import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TrackRow } from './track-row';
import { PlayerService } from '../../state/player.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';

function setup(track = makeTrack('1', { title: 'Fragments', duration: 212 })) {
  const player = { current: signal<Track | null>(null), isPlaying: signal(false) };
  TestBed.configureTestingModule({
    imports: [TrackRow],
    providers: [provideRouter([]), { provide: PlayerService, useValue: player }],
  });
  const fixture = TestBed.createComponent(TrackRow);
  fixture.componentRef.setInput('track', track);
  fixture.componentRef.setInput('index', 0);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, player, track };
}

describe('TrackRow', () => {
  it('shows number, title and duration', () => {
    const { el } = setup();
    expect(el.querySelector('.num')?.textContent?.trim()).toBe('1');
    expect(el.textContent).toContain('Fragments');
    expect(el.textContent).toContain('3:32');
  });

  it('marks the current track and shows the equaliser while playing', () => {
    const { fixture, el, player, track } = setup();
    player.current.set(track);
    player.isPlaying.set(true);
    fixture.detectChanges();
    expect(el.querySelector('.row')?.classList).toContain('current');
    expect(el.querySelector('.eq')).toBeTruthy();

    player.isPlaying.set(false);
    fixture.detectChanges();
    expect(el.querySelector('.eq')).toBeNull();
    expect(el.querySelector('.row')?.classList).toContain('current');
  });

  it('emits play when the row button is clicked', () => {
    const { fixture, el } = setup();
    let played = 0;
    fixture.componentInstance.play.subscribe(() => played++);
    (el.querySelector('button.main') as HTMLButtonElement).click();
    expect(played).toBe(1);
  });

  it('emits menu with the track and anchor when ⋯ is clicked', () => {
    const { fixture, el, track } = setup();
    let event: { track: Track; anchor: HTMLElement } | undefined;
    fixture.componentInstance.menu.subscribe((e) => (event = e));
    const more = el.querySelector('button[aria-label^="More options"]') as HTMLButtonElement;
    more.click();
    expect(event?.track).toBe(track);
    expect(event?.anchor).toBe(more);
  });
});
