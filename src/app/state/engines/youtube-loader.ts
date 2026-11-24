import { InjectionToken } from '@angular/core';

/** The parts of YT.Player we use (also implemented by the test fake). */
export interface YTPlayerLike {
  loadVideoById(videoId: string): void;
  cueVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export interface YTEvents {
  onReady(): void;
  onStateChange(state: number): void;
  onError(code: number): void;
}

/** Creates a player inside `host`. */
export type YTFactory = (host: HTMLElement, events: YTEvents) => YTPlayerLike;

/** YT.PlayerState values. */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

interface YTGlobal {
  Player: new (
    el: HTMLElement,
    options: {
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
    },
  ) => YTPlayerLike;
}

let apiPromise: Promise<YTGlobal> | null = null;

/** Loads https://www.youtube.com/iframe_api once (the official IFrame Player API). */
function loadIframeApi(): Promise<YTGlobal> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTGlobal>((resolve, reject) => {
    const w = window as unknown as { YT?: YTGlobal & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
    if (w.YT?.Player) return resolve(w.YT);
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT!);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube player failed to load'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Real factory: loads the API, then creates a full-size player in the host element. */
export const YT_PLAYER_FACTORY = new InjectionToken<() => Promise<YTFactory>>('YT_PLAYER_FACTORY', {
  factory: () => async () => {
    const YT = await loadIframeApi();
    return (host, events) => {
      const mount = document.createElement('div');
      host.replaceChildren(mount);
      return new YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => events.onReady(),
          onStateChange: (e) => events.onStateChange(e.data),
          onError: (e) => events.onError(e.data),
        },
      });
    };
  },
});
