import { TestBed } from '@angular/core/testing';
import { Injectable, effect } from '@angular/core';
import { PlayerService, RANDOM } from './player.service';
import { AudiusApi } from '../core/api/audius-api';
import { Track } from '../core/models';
import { makeTrack } from '../core/testing/make-track';
import { FakeAudio } from './testing/fake-audio';

let lastAudio: FakeAudio;

@Injectable()
class TestPlayer extends PlayerService {
  protected override createAudio(): HTMLAudioElement {
    lastAudio = new FakeAudio();
    return lastAudio as unknown as HTMLAudioElement;
  }
}

const T = ['1', '2', '3', '4', '5'].map((id) => makeTrack(id));

function setup(random = () => 0) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlayerService, useClass: TestPlayer },
      { provide: RANDOM, useValue: random },
      { provide: AudiusApi, useValue: { streamUrl: (id: string) => `stream:${id}` } },
    ],
  });
  return TestBed.inject(PlayerService);
}

const ids = (list: Track[]) => list.map((t) => t.id);
const flush = () => new Promise((r) => setTimeout(r));

describe('PlayerService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('playTracks sets queue, index and src', () => {
    const p = setup();
    p.playTracks(T, 2);
    expect(ids(p.queue())).toEqual(['1', '2', '3', '4', '5']);
    expect(p.index()).toBe(2);
    expect(p.current()?.id).toBe('3');
    expect(lastAudio.src).toBe('stream:3');
    expect(ids(p.upNext())).toEqual(['4', '5']);
  });

  it('previous restarts when more than 3s in', () => {
    const p = setup();
    p.playTracks(T, 2);
    lastAudio.currentTime = 10;
    lastAudio.dispatch('timeupdate');
    p.previous();
    expect(p.index()).toBe(2);
    expect(lastAudio.currentTime).toBe(0);
  });

  it('previous goes back when 3s or less in', () => {
    const p = setup();
    p.playTracks(T, 2);
    lastAudio.currentTime = 2;
    lastAudio.dispatch('timeupdate');
    p.previous();
    expect(p.index()).toBe(1);
  });

  it('next at end stops when repeat off, wraps when repeat all', () => {
    const p = setup();
    p.playTracks(T, 4);
    lastAudio.dispatch('playing');
    p.next();
    expect(p.index()).toBe(4);
    expect(p.isPlaying()).toBeFalse();
    expect(lastAudio.currentTime).toBe(0);

    p.cycleRepeat(); // all
    p.next();
    expect(p.index()).toBe(0);
  });

  it('ended with repeat one replays the same track', () => {
    const p = setup();
    p.playTracks(T, 1);
    p.cycleRepeat();
    p.cycleRepeat();
    expect(p.repeat()).toBe('one');
    lastAudio.currentTime = 200;
    lastAudio.dispatch('ended');
    expect(p.index()).toBe(1);
    expect(lastAudio.currentTime).toBe(0);
  });

  it('ended with repeat off moves to the next track', () => {
    const p = setup();
    p.playTracks(T, 1);
    lastAudio.dispatch('ended');
    expect(p.current()?.id).toBe('3');
  });

  it('shuffle keeps current track and restores order when turned off', () => {
    const p = setup(() => 0);
    p.playTracks(T, 1);
    p.toggleShuffle();
    expect(p.current()?.id).toBe('2');
    expect(p.index()).toBe(1);
    expect(ids(p.queue()).slice(0, 2)).toEqual(['1', '2']);
    expect([...ids(p.upNext())].sort()).toEqual(['3', '4', '5']);
    expect(ids(p.upNext())).not.toEqual(['3', '4', '5']);

    p.toggleShuffle();
    expect(p.current()?.id).toBe('2');
    expect(ids(p.queue())).toEqual(['1', '2', '3', '4', '5']);
    expect(p.index()).toBe(1);
  });

  it('playTracks with shuffle on starts at the chosen track', () => {
    const p = setup(() => 0);
    p.toggleShuffle();
    p.playTracks(T, 3);
    expect(p.current()?.id).toBe('4');
    expect(p.queue().length).toBe(5);
  });

  it('error skips to next and sets message', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('error');
    expect(p.current()?.id).toBe('2');
    expect(p.error()).toBe(`Couldn't play "Song 1". Skipping.`);
  });

  it('stops after 3 consecutive errors', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('error');
    lastAudio.dispatch('error');
    lastAudio.dispatch('error');
    expect(p.isPlaying()).toBeFalse();
    expect(p.error()).toBe('Playback failed. Check your connection.');
    expect(p.current()?.id).toBe('3');
  });

  it('a playing event resets the error counter and clears the message', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('error');
    lastAudio.dispatch('error');
    lastAudio.dispatch('playing');
    expect(p.error()).toBeNull();
    lastAudio.dispatch('error');
    expect(p.current()?.id).toBe('4');
    expect(p.error()).toBe(`Couldn't play "Song 3". Skipping.`);
  });

  it('recovers after the 3-error stop when the user plays something new', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('error');
    lastAudio.dispatch('error');
    lastAudio.dispatch('error');
    expect(p.isPlaying()).toBeFalse();

    p.playTracks(T, 0);
    expect(p.error()).toBeNull();
    lastAudio.dispatch('error');
    expect(p.current()?.id).toBe('2');
    expect(p.error()).toBe(`Couldn't play "Song 1". Skipping.`);
  });

  it('re-announces a repeated error message so the toast shows again', () => {
    const p = setup();
    const announced: string[] = [];
    TestBed.runInInjectionContext(() =>
      effect(() => {
        const message = p.error();
        if (message) announced.push(message);
      }),
    );
    p.cycleRepeat(); // all: a single failing track is retried
    p.playTracks([T[0]], 0);
    lastAudio.dispatch('error');
    TestBed.flushEffects();
    lastAudio.dispatch('error');
    TestBed.flushEffects();
    expect(announced).toEqual([`Couldn't play "Song 1". Skipping.`, `Couldn't play "Song 1". Skipping.`]);
  });

  it('a non-abort play() rejection resets isPlaying', async () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('playing');
    spyOn(FakeAudio.prototype, 'play').and.callFake(() =>
      Promise.reject(new DOMException('no source', 'NotSupportedError')),
    );
    lastAudio.paused = true;
    lastAudio.dispatch('pause');
    p.toggle();
    expect(p.isPlaying()).toBeTrue(); // optimistic until play() settles
    await flush();
    expect(p.isPlaying()).toBeFalse();
  });

  it('toggle reloads the track when the element is in an error state', () => {
    const p = setup();
    p.playTracks(T, 1);
    lastAudio.src = '';
    (lastAudio as unknown as { error: unknown }).error = { code: 2 };
    p.toggle();
    expect(lastAudio.src).toBe('stream:2');
  });

  it('error on the last track stops instead of looping', () => {
    const p = setup();
    p.playTracks(T, 4);
    lastAudio.dispatch('error');
    expect(p.isPlaying()).toBeFalse();
    expect(p.index()).toBe(4);
  });

  it('AbortError from play() is ignored', async () => {
    spyOn(FakeAudio.prototype, 'play').and.callFake(() =>
      Promise.reject(new DOMException('interrupted', 'AbortError')),
    );
    const p = setup();
    p.playTracks(T, 0);
    p.next();
    await flush();
    expect(p.error()).toBeNull();
    expect(p.current()?.id).toBe('2');
  });

  it('NotAllowedError from play() pauses without a message', async () => {
    spyOn(FakeAudio.prototype, 'play').and.callFake(() =>
      Promise.reject(new DOMException('no gesture', 'NotAllowedError')),
    );
    const p = setup();
    p.playTracks(T, 0);
    await flush();
    expect(p.isPlaying()).toBeFalse();
    expect(p.error()).toBeNull();
  });

  it('moveInQueue keeps current track current', () => {
    const p = setup();
    p.playTracks(T, 2);
    p.moveInQueue(2, 0);
    expect(ids(p.queue())).toEqual(['3', '1', '2', '4', '5']);
    expect(p.current()?.id).toBe('3');
    expect(p.index()).toBe(0);

    p.moveInQueue(4, 1);
    expect(ids(p.queue())).toEqual(['3', '5', '1', '2', '4']);
    expect(p.index()).toBe(0);
  });

  it('removeFromQueue before the current track shifts the index', () => {
    const p = setup();
    p.playTracks(T, 2);
    p.removeFromQueue(0);
    expect(p.current()?.id).toBe('3');
    expect(p.index()).toBe(1);
  });

  it('removeFromQueue of current plays the next track', () => {
    const p = setup();
    p.playTracks(T, 2);
    p.removeFromQueue(2);
    expect(p.current()?.id).toBe('4');
    expect(lastAudio.src).toBe('stream:4');
  });

  it('playAt jumps within the queue without reshuffling or losing the original order', () => {
    const p = setup(() => 0);
    p.playTracks(T, 0);
    p.toggleShuffle();
    const shuffled = ids(p.queue());
    p.playAt(3);
    expect(ids(p.queue())).toEqual(shuffled);
    expect(p.index()).toBe(3);
    expect(lastAudio.src).toBe(`stream:${shuffled[3]}`);
    p.toggleShuffle();
    expect(ids(p.queue())).toEqual(['1', '2', '3', '4', '5']);
    expect(p.current()?.id).toBe(shuffled[3]);
  });

  it('playNext inserts after current; addToQueue appends', () => {
    const p = setup();
    p.playTracks(T.slice(0, 3), 0);
    p.addToQueue(makeTrack('9'));
    p.playNext(makeTrack('8'));
    expect(ids(p.queue())).toEqual(['1', '8', '2', '3', '9']);
  });

  it('addToQueue on an empty player starts playing', () => {
    const p = setup();
    p.addToQueue(makeTrack('9'));
    expect(p.current()?.id).toBe('9');
  });

  it('clearQueue keeps only the current track', () => {
    const p = setup();
    p.playTracks(T, 2);
    p.clearQueue();
    expect(ids(p.queue())).toEqual(['3']);
    expect(p.index()).toBe(0);
  });

  it('persists volume/shuffle/repeat/mute and restores them in a new instance', () => {
    const p = setup();
    p.setVolume(0.4);
    p.toggleShuffle();
    p.cycleRepeat();
    p.toggleMute();
    TestBed.flushEffects();
    TestBed.resetTestingModule();
    const q = setup();
    expect(q.volume()).toBe(0.4);
    expect(q.shuffle()).toBeTrue();
    expect(q.repeat()).toBe('all');
    expect(q.muted()).toBeTrue();
    expect(lastAudio.volume).toBe(0.4);
  });

  it('clamps volume to 0–1', () => {
    const p = setup();
    p.setVolume(2);
    expect(p.volume()).toBe(1);
    p.setVolume(-1);
    expect(p.volume()).toBe(0);
  });

  it('starts with defaults when localStorage holds invalid JSON', () => {
    localStorage.setItem('player.settings', '{not json');
    const p = setup();
    expect(p.volume()).toBe(1);
    expect(p.repeat()).toBe('off');
  });

  it('starts with defaults when localStorage throws', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');
    const p = setup();
    expect(p.volume()).toBe(1);
    expect(() => {
      p.setVolume(0.5);
      TestBed.flushEffects();
    }).not.toThrow();
  });

  it('reads recently played items without source as audius', () => {
    const { source, ...old } = makeTrack('old');
    void source;
    localStorage.setItem('player.recent', JSON.stringify([old]));
    expect(setup().recentlyPlayed()[0].source).toBe('audius');
  });

  it('ignores recently played data of the wrong shape', () => {
    localStorage.setItem('player.recent', '{}');
    expect(setup().recentlyPlayed()).toEqual([]);
    TestBed.resetTestingModule();
    localStorage.setItem('player.recent', JSON.stringify([null, 'x', makeTrack('ok')]));
    const p = setup();
    expect(p.recentlyPlayed().map((t) => t.id)).toEqual(['ok']);
    p.playTracks(T, 0);
    expect(() => lastAudio.dispatch('playing')).not.toThrow();
  });

  it('recentlyPlayed is unique, newest first, capped at 20', () => {
    const p = setup();
    const many = Array.from({ length: 25 }, (_, i) => makeTrack(String(i)));
    for (let i = 0; i < 25; i++) {
      p.playTracks(many, i);
      lastAudio.dispatch('playing');
    }
    p.playTracks(many, 22);
    lastAudio.dispatch('playing');
    const recent = ids(p.recentlyPlayed());
    expect(recent.length).toBe(20);
    expect(recent[0]).toBe('22');
    expect(new Set(recent).size).toBe(20);
  });

  it('toggle pauses and resumes', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.dispatch('playing');
    expect(p.isPlaying()).toBeTrue();
    p.toggle();
    expect(lastAudio.paused).toBeTrue();
    lastAudio.dispatch('pause');
    expect(p.isPlaying()).toBeFalse();
    p.toggle();
    expect(lastAudio.paused).toBeFalse();
  });

  it('seek clamps to the duration and updates time', () => {
    const p = setup();
    p.playTracks(T, 0);
    lastAudio.duration = 200;
    lastAudio.dispatch('loadedmetadata');
    p.seek(500);
    expect(lastAudio.currentTime).toBe(200);
    expect(p.time()).toBe(200);
  });
});
