import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatchResult, YouTubeMatchApi } from './youtube-match-api';
import { makeTrack } from '../testing/make-track';

describe('YouTubeMatchApi', () => {
  let api: YouTubeMatchApi;
  let http: HttpTestingController;
  const song = makeTrack('apple:1', {
    source: 'catalog',
    appleId: '1',
    artistName: 'Rema',
    title: 'Rema - Calm Down',
    duration: 219.669,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(YouTubeMatchApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('calls the relay with artist, cleaned title and rounded duration', () => {
    let out: MatchResult | undefined;
    api.match(song).subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url === '/api/youtube/match');
    expect(req.request.params.get('artist')).toBe('Rema');
    expect(req.request.params.get('title')).toBe('Calm Down');
    expect(req.request.params.get('duration')).toBe('220');
    req.flush({ videoId: 'v1', title: 'Calm Down', channel: 'Rema - Topic', confidence: 6 });
    expect(out).toEqual({ videoId: 'v1', title: 'Calm Down', channel: 'Rema - Topic' });
  });

  it('omits duration when unknown', () => {
    api.match({ ...song, duration: 0 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/youtube/match');
    expect(req.request.params.has('duration')).toBeFalse();
    req.flush({ videoId: null, reason: 'no-match' });
  });

  it('tells apart no connection (offline), too many requests (busy) and a server problem (server)', () => {
    let out: MatchResult | undefined;
    api.match(song).subscribe((r) => (out = r));
    http.expectOne((r) => r.url === '/api/youtube/match').error(new ProgressEvent('error'), { status: 0 });
    expect(out).toEqual({ videoId: null, reason: 'offline' });
    api.match(song).subscribe((r) => (out = r));
    http.expectOne((r) => r.url === '/api/youtube/match').flush({}, { status: 429, statusText: 'Too Many Requests' });
    expect(out).toEqual({ videoId: null, reason: 'busy' });
    api.match(song).subscribe((r) => (out = r));
    http.expectOne((r) => r.url === '/api/youtube/match').flush({}, { status: 502, statusText: 'Bad Gateway' });
    expect(out).toEqual({ videoId: null, reason: 'server' });
  });

  it('caches matches and no-match per track for the session, but not quota or offline', () => {
    api.match(song).subscribe();
    http.expectOne((r) => r.url === '/api/youtube/match').flush({ videoId: null, reason: 'quota' });
    api.match(song).subscribe();
    http.expectOne((r) => r.url === '/api/youtube/match').flush({ videoId: 'v1', title: 't', channel: 'c' });
    let out: MatchResult | undefined;
    api.match(song).subscribe((r) => (out = r));
    http.expectNone((r) => r.url === '/api/youtube/match');
    expect(out?.videoId).toBe('v1');
  });

  it('cached() returns a known match without a request', () => {
    expect(api.cached(song.id)).toBeNull();
    api.match(song).subscribe();
    http.expectOne((r) => r.url === '/api/youtube/match').flush({ videoId: 'v9', title: 't', channel: 'c' });
    expect(api.cached(song.id)).toEqual({ videoId: 'v9', title: 't', channel: 'c' });
  });
});
