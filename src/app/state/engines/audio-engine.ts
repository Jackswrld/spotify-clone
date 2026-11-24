import { Observable, Subject } from 'rxjs';
import { Track } from '../../core/models';
import { Engine, EngineEvent } from './engine';

/** Plays Audius tracks through one HTMLAudioElement. */
export class AudioEngine implements Engine {
  readonly source = 'audius' as const;
  private readonly subject = new Subject<EngineEvent>();
  readonly events: Observable<EngineEvent> = this.subject.asObservable();
  /** False after unload() so late element events are dropped. */
  private active = true;

  constructor(
    private readonly audio: HTMLAudioElement,
    private readonly streamUrl: (trackId: string) => string,
  ) {
    audio.preload = 'auto';
    const a = audio;
    const on = (type: string, toEvent: () => EngineEvent) =>
      a.addEventListener(type, () => {
        if (this.active) this.subject.next(toEvent());
      });
    on('playing', () => ({ type: 'playing' }));
    on('pause', () => ({ type: 'paused' }));
    on('waiting', () => ({ type: 'waiting' }));
    on('canplay', () => ({ type: 'canplay' }));
    on('timeupdate', () => ({ type: 'time', time: a.currentTime, duration: a.duration }));
    on('loadedmetadata', () => ({ type: 'time', time: a.currentTime, duration: a.duration }));
    on('durationchange', () => ({ type: 'time', time: a.currentTime, duration: a.duration }));
    on('ended', () => ({ type: 'ended' }));
    on('error', () => ({ type: 'error', kind: 'stream' }));
  }

  load(track: Track, autoplay: boolean): void {
    this.active = true;
    this.audio.src = this.streamUrl(track.id);
    if (autoplay) this.play();
  }

  play(): void {
    let result: Promise<void> | undefined;
    try {
      result = this.audio.play();
    } catch {
      result = undefined;
    }
    result?.catch((err: unknown) => {
      if (!this.active) return;
      const name = (err as { name?: string })?.name;
      if (name === 'AbortError') return; // superseded by a newer load; not a failure
      // Autoplay refused → 'blocked'. Anything else: show Play again; real stream failures
      // also arrive as the element's 'error' event, which handles skipping.
      this.subject.next(name === 'NotAllowedError' ? { type: 'blocked' } : { type: 'paused' });
    });
  }

  pause(): void {
    this.audio.pause();
  }

  seek(seconds: number): void {
    this.audio.currentTime = seconds;
  }

  setVolume(v: number): void {
    this.audio.volume = v;
  }

  setMuted(m: boolean): void {
    this.audio.muted = m;
  }

  unload(): void {
    this.active = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  hasFailed(): boolean {
    return Boolean(this.audio.error);
  }

  isPaused(): boolean {
    return this.audio.paused;
  }
}
