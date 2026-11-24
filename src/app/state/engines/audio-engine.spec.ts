import { AudioEngine } from './audio-engine';
import { EngineEvent } from './engine';
import { FakeAudio } from '../testing/fake-audio';
import { makeTrack } from '../../core/testing/make-track';

function setup() {
  const audio = new FakeAudio();
  const engine = new AudioEngine(audio as unknown as HTMLAudioElement, (id) => `stream:${id}`);
  const events: EngineEvent[] = [];
  engine.events.subscribe((e) => events.push(e));
  return { audio, engine, events };
}

const flush = () => new Promise((r) => setTimeout(r));

describe('AudioEngine', () => {
  it('is the audius engine and loads the stream URL', () => {
    const { audio, engine } = setup();
    expect(engine.source).toBe('audius');
    engine.load(makeTrack('7'), true);
    expect(audio.src).toBe('stream:7');
    expect(audio.paused).toBeFalse();
  });

  it('does not start when autoplay is false', () => {
    const { audio, engine } = setup();
    engine.load(makeTrack('7'), false);
    expect(audio.src).toBe('stream:7');
    expect(audio.paused).toBeTrue();
  });

  it('maps element events to engine events', () => {
    const { audio, events } = setup();
    audio.currentTime = 12;
    audio.duration = 200;
    for (const type of ['playing', 'pause', 'waiting', 'canplay', 'timeupdate', 'ended', 'error']) {
      audio.dispatch(type);
    }
    expect(events).toEqual([
      { type: 'playing' },
      { type: 'paused' },
      { type: 'waiting' },
      { type: 'canplay' },
      { type: 'time', time: 12, duration: 200 },
      { type: 'ended' },
      { type: 'error', kind: 'stream' },
    ]);
  });

  it('reports the duration when metadata loads', () => {
    const { audio, events } = setup();
    audio.duration = 180;
    audio.dispatch('loadedmetadata');
    expect(events).toEqual([{ type: 'time', time: 0, duration: 180 }]);
  });

  it('NotAllowedError from play() emits blocked, AbortError emits nothing, other errors emit paused', async () => {
    const { engine, events } = setup();
    const play = spyOn(FakeAudio.prototype, 'play');
    play.and.callFake(() => Promise.reject(new DOMException('x', 'AbortError')));
    engine.play();
    await flush();
    expect(events).toEqual([]);
    play.and.callFake(() => Promise.reject(new DOMException('x', 'NotAllowedError')));
    engine.play();
    await flush();
    expect(events).toEqual([{ type: 'blocked' }]);
    play.and.callFake(() => Promise.reject(new DOMException('x', 'NotSupportedError')));
    engine.play();
    await flush();
    expect(events[1]).toEqual({ type: 'paused' });
  });

  it('seek, volume and mute go to the element', () => {
    const { audio, engine } = setup();
    engine.seek(42);
    engine.setVolume(0.3);
    engine.setMuted(true);
    expect(audio.currentTime).toBe(42);
    expect(audio.volume).toBe(0.3);
    expect(audio.muted).toBeTrue();
  });

  it('hasFailed reflects the element error and isPaused its paused state', () => {
    const { audio, engine } = setup();
    expect(engine.hasFailed()).toBeFalse();
    (audio as unknown as { error: unknown }).error = { code: 2 };
    expect(engine.hasFailed()).toBeTrue();
    expect(engine.isPaused()).toBeTrue();
  });

  it('unload pauses, clears src and emits nothing afterwards', () => {
    const { audio, engine, events } = setup();
    engine.load(makeTrack('7'), true);
    engine.unload();
    expect(audio.paused).toBeTrue();
    expect(audio.src).toBe('');
    audio.dispatch('ended');
    audio.dispatch('error');
    expect(events).toEqual([]);
  });

  it('events resume after a new load following unload', () => {
    const { audio, engine, events } = setup();
    engine.unload();
    engine.load(makeTrack('8'), true);
    audio.dispatch('playing');
    expect(events).toEqual([{ type: 'playing' }]);
  });
});
