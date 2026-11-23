import { Injectable, InjectionToken, Signal, computed, effect, inject, signal } from '@angular/core';
import { AudiusApi } from '../core/api/audius-api';
import { Track } from '../core/models';
import { safeStorage } from './safe-storage';

export type RepeatMode = 'off' | 'all' | 'one';

/** Injectable randomness so shuffle is deterministic in tests. */
export const RANDOM = new InjectionToken<() => number>('RANDOM', { factory: () => Math.random });

const SETTINGS_KEY = 'player.settings';
const RECENT_KEY = 'player.recent';
const RECENT_MAX = 20;
const MAX_CONSECUTIVE_ERRORS = 3;
const RESTART_THRESHOLD_S = 3;

interface Settings {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
}

const DEFAULT_SETTINGS: Settings = { volume: 1, muted: false, shuffle: false, repeat: 'off' };

/**
 * Owns the app's single audio element and the play queue. Components read its
 * signals and call its methods; nothing else touches the audio element.
 */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly api = inject(AudiusApi);
  private readonly random = inject(RANDOM);
  private readonly audio: HTMLAudioElement;

  private readonly _queue = signal<Track[]>([]);
  private readonly _index = signal(-1);
  private readonly _isPlaying = signal(false);
  private readonly _isBuffering = signal(false);
  private readonly _time = signal(0);
  private readonly _duration = signal(0);
  private readonly _volume: ReturnType<typeof signal<number>>;
  private readonly _muted: ReturnType<typeof signal<boolean>>;
  private readonly _shuffle: ReturnType<typeof signal<boolean>>;
  private readonly _repeat: ReturnType<typeof signal<RepeatMode>>;
  private readonly _error = signal<string | null>(null);
  private readonly _recent = signal<Track[]>(safeStorage.get<Track[]>(RECENT_KEY, []));

  /** Queue order before shuffle was turned on; used to restore it. */
  private originalQueue: Track[] = [];
  private consecutiveErrors = 0;

  readonly queue: Signal<Track[]> = this._queue.asReadonly();
  readonly index: Signal<number> = this._index.asReadonly();
  readonly current = computed<Track | null>(() => this._queue()[this._index()] ?? null);
  readonly upNext = computed<Track[]>(() => this._queue().slice(this._index() + 1));
  readonly isPlaying: Signal<boolean> = this._isPlaying.asReadonly();
  readonly isBuffering: Signal<boolean> = this._isBuffering.asReadonly();
  readonly time: Signal<number> = this._time.asReadonly();
  readonly duration: Signal<number> = this._duration.asReadonly();
  readonly volume: Signal<number>;
  readonly muted: Signal<boolean>;
  readonly shuffle: Signal<boolean>;
  readonly repeat: Signal<RepeatMode>;
  readonly error: Signal<string | null> = this._error.asReadonly();
  readonly recentlyPlayed: Signal<Track[]> = this._recent.asReadonly();

  constructor() {
    const saved = { ...DEFAULT_SETTINGS, ...safeStorage.get<Partial<Settings>>(SETTINGS_KEY, {}) };
    this._volume = signal(clamp01(Number(saved.volume)));
    this._muted = signal(saved.muted === true);
    this._shuffle = signal(saved.shuffle === true);
    this._repeat = signal<RepeatMode>(
      ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off',
    );
    this.volume = this._volume.asReadonly();
    this.muted = this._muted.asReadonly();
    this.shuffle = this._shuffle.asReadonly();
    this.repeat = this._repeat.asReadonly();

    this.audio = this.createAudio();
    this.audio.preload = 'auto';
    this.audio.volume = this._volume();
    this.audio.muted = this._muted();
    this.listen();
    this.setUpMediaSession();
  }

  /** Overridden in tests with a fake element. */
  protected createAudio(): HTMLAudioElement {
    return new Audio();
  }

  // ---- Queue -------------------------------------------------------------

  playTracks(tracks: Track[], startIndex = 0): void {
    if (!tracks.length) return;
    const start = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    this.originalQueue = [...tracks];
    if (this._shuffle()) {
      const rest = tracks.filter((_, i) => i !== start);
      this._queue.set([tracks[start], ...this.shuffled(rest)]);
      this.load(0);
    } else {
      this._queue.set([...tracks]);
      this.load(start);
    }
  }

  playNext(track: Track): void {
    if (!this.current()) return this.playTracks([track]);
    const at = this._index() + 1;
    this._queue.update((q) => insertAt(q, at, track));
    const current = this.current();
    const origAt = current ? this.originalQueue.indexOf(current) + 1 : this.originalQueue.length;
    this.originalQueue = insertAt(this.originalQueue, origAt, track);
  }

  addToQueue(track: Track): void {
    if (!this.current()) return this.playTracks([track]);
    this._queue.update((q) => [...q, track]);
    this.originalQueue = [...this.originalQueue, track];
  }

  removeFromQueue(queueIndex: number): void {
    const q = this._queue();
    if (queueIndex < 0 || queueIndex >= q.length) return;
    const removed = q[queueIndex];
    const next = q.filter((_, i) => i !== queueIndex);
    const origAt = this.originalQueue.indexOf(removed);
    if (origAt >= 0) this.originalQueue = this.originalQueue.filter((_, i) => i !== origAt);
    this._queue.set(next);

    const index = this._index();
    if (queueIndex < index) {
      this._index.set(index - 1);
    } else if (queueIndex === index) {
      if (!next.length) return this.reset();
      if (queueIndex < next.length) this.load(queueIndex);
      else {
        this._index.set(next.length - 1);
        this.stop();
      }
    }
  }

  moveInQueue(from: number, to: number): void {
    const q = [...this._queue()];
    if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return;
    const [item] = q.splice(from, 1);
    q.splice(to, 0, item);
    const index = this._index();
    let nextIndex = index;
    if (from === index) nextIndex = to;
    else if (from < index && to >= index) nextIndex = index - 1;
    else if (from > index && to <= index) nextIndex = index + 1;
    this._queue.set(q);
    this._index.set(nextIndex);
  }

  clearQueue(): void {
    const current = this.current();
    if (!current) return;
    this._queue.set([current]);
    this.originalQueue = [current];
    this._index.set(0);
  }

  // ---- Transport ---------------------------------------------------------

  toggle(): void {
    if (!this.current()) return;
    if (this.audio.paused) this.play();
    else this.audio.pause();
  }

  next(): void {
    const q = this._queue();
    if (!q.length) return;
    const index = this._index();
    if (index < q.length - 1) this.load(index + 1);
    else if (this._repeat() === 'all') this.load(0);
    else this.stop();
  }

  previous(): void {
    if (!this.current()) return;
    if (this._time() > RESTART_THRESHOLD_S || this._index() === 0) this.seek(0);
    else this.load(this._index() - 1);
  }

  seek(seconds: number): void {
    const duration = this._duration();
    const max = Number.isFinite(duration) && duration > 0 ? duration : Infinity;
    const value = Math.min(Math.max(0, seconds), max);
    this.audio.currentTime = value;
    this._time.set(value);
    this.updatePositionState();
  }

  setVolume(v: number): void {
    const value = clamp01(v);
    this._volume.set(value);
    this.audio.volume = value;
    if (value > 0 && this._muted()) this.toggleMute();
    this.saveSettings();
  }

  toggleMute(): void {
    this._muted.update((m) => !m);
    this.audio.muted = this._muted();
    this.saveSettings();
  }

  toggleShuffle(): void {
    const turningOn = !this._shuffle();
    this._shuffle.set(turningOn);
    this.saveSettings();
    const current = this.current();
    if (!current) return;

    const q = this._queue();
    const index = this._index();
    if (turningOn) {
      this.originalQueue = [...q];
      this._queue.set([...q.slice(0, index + 1), ...this.shuffled(q.slice(index + 1))]);
    } else {
      const inQueue = new Set(q);
      const inOriginal = new Set(this.originalQueue);
      const restored = [
        ...this.originalQueue.filter((t) => inQueue.has(t)),
        ...q.filter((t) => !inOriginal.has(t)),
      ];
      this._queue.set(restored);
      this._index.set(restored.indexOf(current));
    }
  }

  cycleRepeat(): void {
    this._repeat.update((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));
    this.saveSettings();
  }

  // ---- Internals ---------------------------------------------------------

  private load(index: number): void {
    const track = this._queue()[index];
    if (!track) return;
    this._index.set(index);
    this._time.set(0);
    this._duration.set(track.duration);
    this.audio.src = this.api.streamUrl(track.id);
    this.play();
  }

  private play(): void {
    this._isPlaying.set(true);
    let result: Promise<void> | undefined;
    try {
      result = this.audio.play();
    } catch {
      result = undefined;
    }
    result?.catch((err: unknown) => {
      const name = (err as { name?: string })?.name;
      if (name === 'AbortError') return; // superseded by a newer load; not a failure
      if (name === 'NotAllowedError') this._isPlaying.set(false); // autoplay blocked
      // Other failures surface through the element's 'error' event.
    });
  }

  private stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this._time.set(0);
    this._isPlaying.set(false);
    this._isBuffering.set(false);
  }

  private reset(): void {
    this.stop();
    this.audio.removeAttribute('src');
    this._queue.set([]);
    this.originalQueue = [];
    this._index.set(-1);
  }

  private listen(): void {
    const a = this.audio;
    a.addEventListener('playing', () => {
      this._isPlaying.set(true);
      this._isBuffering.set(false);
      this.consecutiveErrors = 0;
      this._error.set(null);
      this.remember(this.current());
    });
    a.addEventListener('pause', () => this._isPlaying.set(false));
    a.addEventListener('waiting', () => this._isBuffering.set(true));
    a.addEventListener('canplay', () => this._isBuffering.set(false));
    a.addEventListener('timeupdate', () => this._time.set(a.currentTime));
    const onDuration = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) this._duration.set(a.duration);
      this.updatePositionState();
    };
    a.addEventListener('loadedmetadata', onDuration);
    a.addEventListener('durationchange', onDuration);
    a.addEventListener('ended', () => {
      if (this._repeat() === 'one') {
        this.seek(0);
        this.play();
      } else {
        this.next();
      }
    });
    a.addEventListener('error', () => this.onError());
  }

  private onError(): void {
    const track = this.current();
    if (!track) return;
    this.consecutiveErrors++;
    if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      this._error.set('Playback failed. Check your connection.');
      this.stop();
      return;
    }
    this._error.set(`Couldn't play "${track.title}". Skipping.`);
    const isLast = this._index() >= this._queue().length - 1;
    if (isLast && this._repeat() !== 'all') this.stop();
    else this.next();
  }

  private remember(track: Track | null): void {
    if (!track) return;
    this._recent.update((list) =>
      [track, ...list.filter((t) => t.id !== track.id)].slice(0, RECENT_MAX),
    );
    safeStorage.set(RECENT_KEY, this._recent());
  }

  private saveSettings(): void {
    safeStorage.set(SETTINGS_KEY, {
      volume: this._volume(),
      muted: this._muted(),
      shuffle: this._shuffle(),
      repeat: this._repeat(),
    } satisfies Settings);
  }

  /** Fisher–Yates using the injected random source. */
  private shuffled<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // ---- Media Session (lock screen, media keys) ----------------------------

  private setUpMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => this.play()],
      ['pause', () => this.audio.pause()],
      ['previoustrack', () => this.previous()],
      ['nexttrack', () => this.next()],
      ['seekto', (d) => d.seekTime != null && this.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }

    effect(() => {
      const track = this.current();
      if (!track || typeof MediaMetadata === 'undefined') return;
      const artwork: MediaImage[] = [];
      if (track.artwork.small) artwork.push({ src: track.artwork.small, sizes: '150x150', type: 'image/jpeg' });
      if (track.artwork.medium) artwork.push({ src: track.artwork.medium, sizes: '480x480', type: 'image/jpeg' });
      session.metadata = new MediaMetadata({ title: track.title, artist: track.artistName, artwork });
    });

    effect(() => {
      session.playbackState = this.current() ? (this._isPlaying() ? 'playing' : 'paused') : 'none';
    });
  }

  private updatePositionState(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const duration = this._duration();
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(this._time(), duration),
        playbackRate: 1,
      });
    } catch {
      // Ignore invalid states (e.g. position briefly past duration).
    }
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

function insertAt<T>(list: T[], at: number, item: T): T[] {
  return [...list.slice(0, at), item, ...list.slice(at)];
}
