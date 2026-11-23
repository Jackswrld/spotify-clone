import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { LyricsService } from './lyrics.service';
import { PlayerService } from './player.service';
import { LyricsApi } from '../core/api/lyrics-api';
import { Lyrics, Track } from '../core/models';
import { makeTrack } from '../core/testing/make-track';

function setup() {
  const current = signal<Track | null>(null);
  const time = signal(0);
  const pending = new Map<string, Subject<Lyrics | null>>();
  const api = {
    get: jasmine.createSpy('get').and.callFake((_artist: string, title: string) => {
      const s = new Subject<Lyrics | null>();
      pending.set(title, s);
      return s;
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: PlayerService, useValue: { current, time } },
      { provide: LyricsApi, useValue: api },
    ],
  });
  const service = TestBed.inject(LyricsService);
  const respond = (title: string, value: Lyrics | null) => {
    pending.get(title)!.next(value);
    pending.get(title)!.complete();
    TestBed.flushEffects();
  };
  return { service, current, time, api, respond };
}

const LINES: Lyrics = {
  plain: 'a\nb\nc',
  lines: [
    { time: 10, text: 'a' },
    { time: 20, text: 'b' },
    { time: 30, text: 'c' },
  ],
  instrumental: false,
};

describe('LyricsService', () => {
  it('loads lyrics for the current track', () => {
    const { service, current, respond, api } = setup();
    current.set(makeTrack('1', { title: 'Yellow', artistName: 'Coldplay', duration: 269 }));
    TestBed.flushEffects();
    expect(api.get).toHaveBeenCalledWith('Coldplay', 'Yellow', 269);
    expect(service.lyrics().status).toBe('loading');
    respond('Yellow', LINES);
    expect(service.lyrics()).toEqual({ trackId: '1', status: 'ready', data: LINES });
  });

  it('reports none when no lyrics exist', () => {
    const { service, current, respond } = setup();
    current.set(makeTrack('1', { title: 'Yellow' }));
    TestBed.flushEffects();
    respond('Yellow', null);
    expect(service.lyrics().status).toBe('none');
  });

  it('activeIndex follows player time', () => {
    const { service, current, time, respond } = setup();
    current.set(makeTrack('1', { title: 'Yellow' }));
    TestBed.flushEffects();
    respond('Yellow', LINES);
    expect(service.activeIndex()).toBe(-1);
    time.set(9.8); // within the 0.25s lead
    expect(service.activeIndex()).toBe(0);
    time.set(25);
    expect(service.activeIndex()).toBe(1);
    time.set(99);
    expect(service.activeIndex()).toBe(2);
  });

  it('drops a stale response when the track changes mid-request', () => {
    const { service, current, respond } = setup();
    current.set(makeTrack('1', { title: 'Old' }));
    TestBed.flushEffects();
    current.set(makeTrack('2', { title: 'New' }));
    TestBed.flushEffects();
    respond('Old', LINES);
    expect(service.lyrics().trackId).toBe('2');
    expect(service.lyrics().status).toBe('loading');
    respond('New', null);
    expect(service.lyrics()).toEqual({ trackId: '2', status: 'none', data: null });
  });

  it('strips "Artist - " from Audius titles before searching', () => {
    const { current, api } = setup();
    current.set(makeTrack('1', { title: 'Xsetra - Fragments', artistName: 'Xsetra' }));
    TestBed.flushEffects();
    expect(api.get).toHaveBeenCalledWith('Xsetra', 'Fragments', 200);
  });
});
