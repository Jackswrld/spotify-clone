import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';
import { YouTubeEngine } from './youtube-engine';
import { YT_PLAYER_FACTORY, YTEvents } from './youtube-loader';
import { EngineEvent } from './engine';
import { MatchResult, YouTubeMatchApi } from '../../core/api/youtube-match-api';
import { CatalogApi } from '../../core/api/catalog-api';
import { FakeYTPlayer } from '../testing/fake-yt';
import { makeTrack } from '../../core/testing/make-track';
import { Track } from '../../core/models';

const SONG = makeTrack('apple:1', { source: 'catalog', appleId: '1', title: 'Calm Down', artistName: 'Rema', duration: 220 });

function setup(match: (t: Track) => Observable<MatchResult> = () => of({ videoId: 'v1', title: 't', channel: 'c' })) {
  let player: FakeYTPlayer | undefined;
  const matchApi = { match: jasmine.createSpy('match').and.callFake(match), forget: jasmine.createSpy('forget') };
  const catalog = { song: jasmine.createSpy('song').and.returnValue(of({ ...SONG, duration: 199 })) };
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: YouTubeMatchApi, useValue: matchApi },
      { provide: CatalogApi, useValue: catalog },
      {
        provide: YT_PLAYER_FACTORY,
        useValue: () =>
          Promise.resolve((_host: HTMLElement, events: YTEvents) => {
            player = new FakeYTPlayer(events);
            queueMicrotask(() => events.onReady());
            return player;
          }),
      },
    ],
  });
  const engine = TestBed.inject(YouTubeEngine);
  const events: EngineEvent[] = [];
  engine.events.subscribe((e) => events.push(e));
  return { engine, events, matchApi, catalog, http: TestBed.inject(HttpTestingController), player: () => player! };
}

describe('YouTubeEngine', () => {
  it('is the catalog engine and loads the matched video when autoplay is on', fakeAsync(() => {
    const { engine, player } = setup();
    expect(engine.source).toBe('catalog');
    engine.load(SONG, true);
    flushMicrotasks();
    expect(player().calls).toContain('load:v1');
    tick(2000);
  }));

  it('cues instead of loading when autoplay is false', fakeAsync(() => {
    const { engine, player } = setup();
    engine.load(SONG, false);
    flushMicrotasks();
    expect(player().calls).toContain('cue:v1');
    expect(player().calls).not.toContain('load:v1');
  }));

  it('maps player states and polls time only while playing', fakeAsync(() => {
    const { engine, events, player } = setup();
    engine.load(SONG, true);
    flushMicrotasks();
    const p = player();
    p.duration = 220;
    p.time = 5;
    p.fireState(1);
    tick(250);
    expect(events).toContain({ type: 'playing' });
    expect(events).toContain({ type: 'time', time: 5, duration: 220 });
    p.fireState(2);
    const count = events.filter((e) => e.type === 'time').length;
    tick(1000);
    expect(events.filter((e) => e.type === 'time').length).toBe(count);
    p.fireState(3);
    p.fireState(0);
    expect(events).toContain({ type: 'paused' });
    expect(events).toContain({ type: 'waiting' });
    expect(events).toContain({ type: 'ended' });
  }));

  it('error 150 emits a stream error and asks the relay to forget the match', fakeAsync(() => {
    const { engine, events, player, matchApi, http } = setup();
    engine.load(SONG, true);
    flushMicrotasks();
    player().fireError(150);
    expect(events).toContain({ type: 'error', kind: 'stream' });
    expect(engine.hasFailed()).toBeTrue();
    expect(matchApi.forget).toHaveBeenCalledWith(SONG.id);
    const req = http.expectOne((r) => r.url === '/api/youtube/match' && r.method === 'DELETE');
    expect(req.request.params.get('artist')).toBe('Rema');
    expect(req.request.params.get('title')).toBe('Calm Down');
    req.flush({ ok: true });
    tick(2000);
  }));

  it('no match, quota and offline become the matching error kinds', fakeAsync(() => {
    for (const [reason, kind] of [
      ['no-match', 'no-match'],
      ['quota', 'quota'],
      ['offline', 'offline'],
      ['no-key', 'offline'],
    ] as const) {
      TestBed.resetTestingModule();
      const { engine, events } = setup(() => of({ videoId: null, reason }));
      engine.load(SONG, true);
      flushMicrotasks();
      expect(events).toContain({ type: 'error', kind });
    }
  }));

  it('looks up the duration via CatalogApi when the track has none', fakeAsync(() => {
    const { engine, catalog, matchApi } = setup();
    engine.load({ ...SONG, duration: 0 }, true);
    flushMicrotasks();
    expect(catalog.song).toHaveBeenCalledWith('1');
    expect(matchApi.match.calls.mostRecent().args[0].duration).toBe(199);
    tick(2000);
  }));

  it('still matches when the duration lookup fails', fakeAsync(() => {
    const { engine, catalog, matchApi } = setup();
    catalog.song.and.returnValue(throwError(() => new Error('x')));
    engine.load({ ...SONG, duration: 0 }, true);
    flushMicrotasks();
    expect(matchApi.match).toHaveBeenCalled();
    tick(2000);
  }));

  it('emits blocked when an autoplay start never reaches playing', fakeAsync(() => {
    const { engine, events } = setup();
    engine.load(SONG, true);
    flushMicrotasks();
    tick(1600);
    expect(events).toContain({ type: 'blocked' });
  }));

  it('ignores a slow match that resolves after a newer load or an unload', fakeAsync(() => {
    let resolveFirst: (r: MatchResult) => void = () => undefined;
    const { engine, player, events } = setup((t) =>
      t.id === 'apple:1'
        ? new Observable<MatchResult>((s) => {
            resolveFirst = (r) => {
              s.next(r);
              s.complete();
            };
          })
        : of({ videoId: 'v2', title: 't', channel: 'c' }),
    );
    engine.load(SONG, true);
    engine.load({ ...SONG, id: 'apple:2', appleId: '2' }, true);
    flushMicrotasks();
    resolveFirst({ videoId: null, reason: 'no-match' });
    flushMicrotasks();
    expect(player().calls).toContain('load:v2');
    expect(events.some((e) => e.type === 'error')).toBeFalse();
    engine.unload();
    expect(player().calls).toContain('stop');
    tick(2000);
  }));

  it('play, pause, seek, volume and mute drive the player', fakeAsync(() => {
    const { engine, player } = setup();
    engine.load(SONG, false);
    flushMicrotasks();
    engine.play();
    engine.pause();
    engine.seek(30);
    engine.setVolume(0.5);
    engine.setMuted(true);
    engine.setMuted(false);
    expect(player().calls).toEqual(
      jasmine.arrayContaining(['play', 'pause', 'seek:30', 'volume:50', 'mute', 'unmute']),
    );
  }));
});
