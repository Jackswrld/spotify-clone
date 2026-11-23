import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { PlayerBar } from './player-bar';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';

function fakePlayer() {
  return {
    current: signal<Track | null>(null),
    isPlaying: signal(false),
    isBuffering: signal(false),
    time: signal(0),
    duration: signal(200),
    volume: signal(1),
    muted: signal(false),
    shuffle: signal(false),
    repeat: signal<'off' | 'all' | 'one'>('off'),
    toggle: jasmine.createSpy('toggle'),
    next: jasmine.createSpy('next'),
    previous: jasmine.createSpy('previous'),
    seek: jasmine.createSpy('seek'),
    setVolume: jasmine.createSpy('setVolume'),
    toggleMute: jasmine.createSpy('toggleMute'),
    toggleShuffle: jasmine.createSpy('toggleShuffle'),
    cycleRepeat: jasmine.createSpy('cycleRepeat'),
  };
}

function setup() {
  const player = fakePlayer();
  const panel = { view: signal(null), toggle: jasmine.createSpy('toggle') };
  TestBed.configureTestingModule({
    imports: [PlayerBar],
    providers: [
      provideRouter([]),
      { provide: PlayerService, useValue: player },
      { provide: PanelStateService, useValue: panel },
    ],
  });
  const fixture = TestBed.createComponent(PlayerBar);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) => el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  return { fixture, el, player, panel, button };
}

describe('PlayerBar', () => {
  it('shows "Pick something to play" when nothing is loaded', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Pick something to play');
  });

  it('play button label reflects state', () => {
    const { fixture, player, button } = setup();
    player.current.set(makeTrack('1'));
    fixture.detectChanges();
    expect(button('Play')).toBeTruthy();
    player.isPlaying.set(true);
    fixture.detectChanges();
    expect(button('Pause')).toBeTruthy();
    expect(button('Play')).toBeNull();
  });

  it('shows the track title and artist', () => {
    const { fixture, player, el } = setup();
    player.current.set(makeTrack('1', { title: 'Fragments', artistName: 'Xsetra' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Fragments');
    expect(el.textContent).toContain('Xsetra');
  });

  it('clicking next calls player.next()', () => {
    const { fixture, player, button } = setup();
    player.current.set(makeTrack('1'));
    fixture.detectChanges();
    button('Next').click();
    expect(player.next).toHaveBeenCalled();
  });

  it('seek slider only calls seek on change, not on input', () => {
    const { fixture, player, el } = setup();
    player.current.set(makeTrack('1'));
    fixture.detectChanges();
    const slider = el.querySelector('input[aria-label="Seek"]') as HTMLInputElement;
    slider.value = '50';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(player.seek).not.toHaveBeenCalled();
    expect(el.textContent).toContain('0:50');
    slider.dispatchEvent(new Event('change'));
    expect(player.seek).toHaveBeenCalledWith(50);
  });

  it('queue button toggles the queue panel', () => {
    const { fixture, player, panel, button } = setup();
    player.current.set(makeTrack('1'));
    fixture.detectChanges();
    button('Queue').click();
    expect(panel.toggle).toHaveBeenCalledWith('queue');
  });

  it('repeat button reflects mode with aria-pressed', () => {
    const { fixture, player, el } = setup();
    player.current.set(makeTrack('1'));
    player.repeat.set('one');
    fixture.detectChanges();
    const repeat = el.querySelector('button.repeat') as HTMLButtonElement;
    expect(repeat.getAttribute('aria-pressed')).toBe('true');
    expect(repeat.getAttribute('aria-label')).toBe('Repeat one');
  });
});
