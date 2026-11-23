import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { NowPlayingSheet } from './now-playing-sheet';
import { PlayerService } from '../../state/player.service';
import { TrackMenuService } from '../../shared/add-to-playlist/track-menu.service';
import { NowPlayingView } from '../right-panel/now-playing-view';
import { makeTrack } from '../../core/testing/make-track';

function setup() {
  const player = {
    current: signal(makeTrack('1')),
    isPlaying: signal(false),
    isBuffering: signal(false),
    time: signal(0),
    duration: signal(200),
    shuffle: signal(false),
    repeat: signal<'off' | 'all' | 'one'>('off'),
  };
  TestBed.configureTestingModule({
    imports: [NowPlayingSheet],
    providers: [provideRouter([]), { provide: PlayerService, useValue: player }],
  });
  // The embedded Now playing sections aren't under test here.
  TestBed.overrideComponent(NowPlayingSheet, { remove: { imports: [NowPlayingView] } });
  TestBed.overrideComponent(NowPlayingSheet, { add: { schemas: [NO_ERRORS_SCHEMA] } });
  const fixture = TestBed.createComponent(NowPlayingSheet);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  let closed = 0;
  fixture.componentInstance.close.subscribe(() => closed++);
  return { fixture, closed: () => closed, menu: TestBed.inject(TrackMenuService) };
}

describe('NowPlayingSheet', () => {
  it('Escape closes the sheet', () => {
    const { closed } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed()).toBe(1);
  });

  it('Escape closes an open track menu first, not the sheet', () => {
    const { closed, menu } = setup();
    menu.open(makeTrack('1'), null);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed()).toBe(0);
  });
});
