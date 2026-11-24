import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { Track } from '../../core/models';
import { CatalogApi } from '../../core/api/catalog-api';
import { YouTubeMatchApi } from '../../core/api/youtube-match-api';
import { lyricsTitle } from '../../core/title';
import { VideoDockService } from '../video-dock.service';
import { Engine, EngineEvent } from './engine';
import { YT_PLAYER_FACTORY, YT_STATE, YTPlayerLike } from './youtube-loader';

const POLL_MS = 250;
/** An autoplay start that hasn't begun after this long was refused by the browser. */
const BLOCKED_AFTER_MS = 1500;
/** Player errors meaning "this video can't be embedded / no longer exists". */
const GONE_ERRORS = [100, 101, 150];

/**
 * Plays catalog songs through YouTube's official embedded player (IFrame Player API).
 * It never hides, shrinks or separates the video; PlayerService only starts it while the
 * video dock can be seen.
 */
@Injectable({ providedIn: 'root' })
export class YouTubeEngine implements Engine {
  readonly source = 'catalog' as const;

  private readonly http = inject(HttpClient);
  private readonly matchApi = inject(YouTubeMatchApi);
  private readonly catalog = inject(CatalogApi);
  private readonly dock = inject(VideoDockService);
  private readonly createFactory = inject(YT_PLAYER_FACTORY);

  private readonly subject = new Subject<EngineEvent>();
  readonly events = this.subject.asObservable();

  private player: YTPlayerLike | null = null;
  private playerReady: Promise<YTPlayerLike> | null = null;
  /** Increments on every load/unload; async work from an older load is ignored. */
  private token = 0;
  private active = false;
  private track: Track | null = null;
  private videoId: string | null = null;
  private state: number = YT_STATE.UNSTARTED;
  private failed = false;
  private volume = 100;
  private muted = false;
  private poll: ReturnType<typeof setInterval> | null = null;
  private blockedTimer: ReturnType<typeof setTimeout> | null = null;

  load(track: Track, autoplay: boolean): void {
    const token = ++this.token;
    this.active = true;
    this.track = track;
    this.videoId = null;
    this.failed = false;
    this.stopPolling();
    this.clearBlockedTimer();
    this.player?.stopVideo();
    this.emit({ type: 'waiting' });

    this.withDuration(track)
      .pipe(switchMap((t) => this.matchApi.match(t)))
      .subscribe((result) => {
        if (token !== this.token) return; // a newer load or an unload happened meanwhile
        if (result.videoId === null) {
          this.failed = true;
          const kind = result.reason === 'no-match' || result.reason === 'quota' ? result.reason : 'offline';
          this.emit({ type: 'error', kind });
          return;
        }
        this.videoId = result.videoId;
        this.ensurePlayer().then(
          (player) => {
            if (token !== this.token) return;
            if (autoplay) {
              player.loadVideoById(result.videoId);
              this.watchForBlockedStart(token);
            } else {
              player.cueVideoById(result.videoId);
            }
          },
          () => {
            if (token !== this.token) return;
            this.failed = true;
            this.emit({ type: 'error', kind: 'offline' });
          },
        );
      });
  }

  play(): void {
    if (!this.player || !this.videoId) return;
    this.player.playVideo();
    this.watchForBlockedStart(this.token);
  }

  pause(): void {
    this.clearBlockedTimer();
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(seconds, true);
  }

  setVolume(v: number): void {
    this.volume = Math.round(v * 100);
    this.player?.setVolume(this.volume);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.player?.mute();
    else this.player?.unMute();
  }

  unload(): void {
    this.token++;
    this.active = false;
    this.track = null;
    this.videoId = null;
    this.stopPolling();
    this.clearBlockedTimer();
    this.player?.stopVideo();
  }

  hasFailed(): boolean {
    return this.failed;
  }

  isPaused(): boolean {
    return this.state !== YT_STATE.PLAYING && this.state !== YT_STATE.BUFFERING;
  }

  // ---- internals -----------------------------------------------------------

  private emit(event: EngineEvent): void {
    if (this.active) this.subject.next(event);
  }

  /** Chart songs have no length; one iTunes lookup gives it (used to check the video length). */
  private withDuration(track: Track): Observable<Track> {
    if (track.duration > 0 || !track.appleId) return of(track);
    return this.catalog.song(track.appleId).pipe(
      map((full) => ({ ...track, duration: full.duration })),
      catchError(() => of(track)),
    );
  }

  private ensurePlayer(): Promise<YTPlayerLike> {
    if (this.playerReady) return this.playerReady;
    this.playerReady = this.createFactory().then(
      (factory) =>
        new Promise<YTPlayerLike>((resolve) => {
          const player = factory(this.dock.host, {
            onReady: () => {
              player.setVolume(this.volume);
              if (this.muted) player.mute();
              this.player = player;
              resolve(player);
            },
            onStateChange: (state) => this.onState(state),
            onError: (code) => this.onPlayerError(code),
          });
        }),
    );
    this.playerReady.catch(() => (this.playerReady = null));
    return this.playerReady;
  }

  private onState(state: number): void {
    this.state = state;
    switch (state) {
      case YT_STATE.PLAYING:
        this.clearBlockedTimer();
        this.emit({ type: 'playing' });
        this.startPolling();
        break;
      case YT_STATE.PAUSED:
      case YT_STATE.CUED:
        this.stopPolling();
        this.emit({ type: 'paused' });
        break;
      case YT_STATE.BUFFERING:
        this.emit({ type: 'waiting' });
        break;
      case YT_STATE.ENDED:
        this.stopPolling();
        this.emit({ type: 'ended' });
        break;
    }
  }

  private onPlayerError(code: number): void {
    this.failed = true;
    this.stopPolling();
    this.clearBlockedTimer();
    if (GONE_ERRORS.includes(code) && this.track) this.forgetMatch(this.track);
    this.emit({ type: 'error', kind: 'stream' });
  }

  /** The video was removed or blocked from embedding: drop it from both caches. */
  private forgetMatch(track: Track): void {
    this.matchApi.forget(track.id);
    const params = new HttpParams().set('artist', track.artistName).set('title', lyricsTitle(track));
    this.http.delete('/api/youtube/match', { params }).subscribe({ error: () => undefined });
  }

  private startPolling(): void {
    this.stopPolling();
    this.poll = setInterval(() => {
      if (!this.player) return;
      this.emit({ type: 'time', time: this.player.getCurrentTime(), duration: this.player.getDuration() });
    }, POLL_MS);
  }

  private stopPolling(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  private watchForBlockedStart(token: number): void {
    this.clearBlockedTimer();
    this.blockedTimer = setTimeout(() => {
      if (token !== this.token) return;
      if (this.state !== YT_STATE.PLAYING && this.state !== YT_STATE.BUFFERING) this.emit({ type: 'blocked' });
    }, BLOCKED_AFTER_MS);
  }

  private clearBlockedTimer(): void {
    if (this.blockedTimer) clearTimeout(this.blockedTimer);
    this.blockedTimer = null;
  }
}
