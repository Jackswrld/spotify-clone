import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LyricsApi } from './lyrics-api';
import { APP_CONFIG } from '../config';
import { Lyrics } from '../models';

const URL = 'https://lrclib.net/api/get';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: APP_CONFIG,
        useValue: {
          audiusBaseUrl: '',
          audiusAppName: '',
          audiusApiKey: '',
          lastFmApiKey: '',
          lrclibClient: 'test-client/1.0',
        },
      },
    ],
  });
  return { api: TestBed.inject(LyricsApi), http: TestBed.inject(HttpTestingController) };
}

describe('LyricsApi', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends params and Lrclib-Client header; maps the record', () => {
    const { api, http } = setup();
    let out: Lyrics | null | undefined;
    api.get('Coldplay', 'Yellow', 268.6).subscribe((l) => (out = l));
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('artist_name')).toBe('Coldplay');
    expect(req.request.params.get('track_name')).toBe('Yellow');
    expect(req.request.params.get('duration')).toBe('269');
    expect(req.request.headers.get('Lrclib-Client')).toBe('test-client/1.0');
    req.flush({ plainLyrics: 'Look at the stars', syncedLyrics: '[00:35.66] Look at the stars', instrumental: false });
    expect(out).toEqual({
      plain: 'Look at the stars',
      lines: [{ time: 35.66, text: 'Look at the stars' }],
      instrumental: false,
    });
  });

  it('returns null on 404', () => {
    const { api, http } = setup();
    let out: Lyrics | null | undefined;
    api.get('A', 'B', 100).subscribe((l) => (out = l));
    http.expectOne((r) => r.url === URL).flush({ message: 'not found' }, { status: 404, statusText: 'Not Found' });
    expect(out).toBeNull();
  });

  it('retries once after Retry-After on 429', fakeAsync(() => {
    const { api, http } = setup();
    let out: Lyrics | null | undefined;
    api.get('A', 'B', 100).subscribe((l) => (out = l));
    http
      .expectOne((r) => r.url === URL)
      .flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '2' } });
    tick(1900);
    http.expectNone((r) => r.url === URL);
    tick(800); // 2s × up to 1.3
    http.expectOne((r) => r.url === URL).flush({ plainLyrics: 'x', syncedLyrics: null, instrumental: false });
    expect(out?.plain).toBe('x');
  }));

  it('gives up with null after a second 429', fakeAsync(() => {
    const { api, http } = setup();
    let out: Lyrics | null | undefined;
    api.get('A', 'B', 100).subscribe((l) => (out = l));
    const limited = { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '1' } };
    http.expectOne((r) => r.url === URL).flush({}, limited);
    tick(1300);
    http.expectOne((r) => r.url === URL).flush({}, limited);
    expect(out).toBeNull();
  }));
});
