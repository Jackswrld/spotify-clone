import { Subject } from 'rxjs';
import { Track, TrackSource } from '../../core/models';
import { Engine, EngineEvent } from '../engines/engine';
import { YTEvents, YTPlayerLike } from '../engines/youtube-loader';

/** Records calls and lets tests fire YouTube player states and errors. */
export class FakeYTPlayer implements YTPlayerLike {
  calls: string[] = [];
  time = 0;
  duration = 0;
  state = -1;
  constructor(public events: YTEvents) {}
  loadVideoById(id: string) {
    this.calls.push(`load:${id}`);
  }
  cueVideoById(id: string) {
    this.calls.push(`cue:${id}`);
  }
  playVideo() {
    this.calls.push('play');
  }
  pauseVideo() {
    this.calls.push('pause');
  }
  stopVideo() {
    this.calls.push('stop');
  }
  seekTo(s: number) {
    this.calls.push(`seek:${s}`);
  }
  setVolume(v: number) {
    this.calls.push(`volume:${v}`);
  }
  mute() {
    this.calls.push('mute');
  }
  unMute() {
    this.calls.push('unmute');
  }
  getCurrentTime() {
    return this.time;
  }
  getDuration() {
    return this.duration;
  }
  getPlayerState() {
    return this.state;
  }
  destroy() {
    this.calls.push('destroy');
  }
  fireState(state: number) {
    this.state = state;
    this.events.onStateChange(state);
  }
  fireError(code: number) {
    this.events.onError(code);
  }
}

/** A controllable Engine for PlayerService tests. */
export class FakeEngine implements Engine {
  readonly events$ = new Subject<EngineEvent>();
  readonly events = this.events$.asObservable();
  calls: string[] = [];
  paused = true;
  failed = false;
  constructor(readonly source: TrackSource) {}
  load(track: Track, autoplay: boolean) {
    this.calls.push(`load:${track.id}:${autoplay ? 'play' : 'cue'}`);
    this.paused = !autoplay;
  }
  play() {
    this.calls.push('play');
    this.paused = false;
  }
  pause() {
    this.calls.push('pause');
    this.paused = true;
  }
  seek(s: number) {
    this.calls.push(`seek:${s}`);
  }
  setVolume(v: number) {
    this.calls.push(`volume:${v}`);
  }
  setMuted(m: boolean) {
    this.calls.push(`muted:${m}`);
  }
  unload() {
    this.calls.push('unload');
    this.paused = true;
  }
  hasFailed() {
    return this.failed;
  }
  isPaused() {
    return this.paused;
  }
  emit(e: EngineEvent) {
    this.events$.next(e);
  }
}
