import { Observable } from 'rxjs';
import { Track, TrackSource } from '../../core/models';

/** What an engine reports back to PlayerService. */
export type EngineEvent =
  | { type: 'playing' }
  | { type: 'paused' }
  | { type: 'waiting' }
  | { type: 'canplay' }
  | { type: 'time'; time: number; duration: number }
  | { type: 'ended' }
  | { type: 'error'; kind: 'stream' | 'no-match' | 'quota' | 'offline' }
  /** The browser refused to start playback without a user gesture: a pause, never an error. */
  | { type: 'blocked' };

/** Something that can make sound for one kind of track (Audius audio, YouTube video). */
export interface Engine {
  readonly source: TrackSource;
  readonly events: Observable<EngineEvent>;
  load(track: Track, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  /** Stops and releases media; emits nothing until the next load. */
  unload(): void;
  /** True when the last load failed and play() would not recover it. */
  hasFailed(): boolean;
  isPaused(): boolean;
}
