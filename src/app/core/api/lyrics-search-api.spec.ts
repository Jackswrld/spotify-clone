import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LyricHit, LyricsSearchApi, LyricsSearchResult } from './lyrics-search-api';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(LyricsSearchApi), http: TestBed.inject(HttpTestingController) };
}

describe('LyricsSearchApi', () => {
  it('maps the music server results to hits', () => {
    const { api, http } = setup();
    let out: LyricsSearchResult | undefined;
    api.search('left the party').subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url === '/api/lyrics/search');
    expect(req.request.params.get('q')).toBe('left the party');
    req.flush({ results: [{ title: 'WORTHLESS', artist: 'd4vd', image: 'w.jpg', geniusId: 9, durationS: 180 }] });
    expect(out).toEqual([{ title: 'WORTHLESS', artist: 'd4vd', image: 'w.jpg', durationS: 180 } as LyricHit]);
  });

  it('no token on the server means not set up', () => {
    const { api, http } = setup();
    let out: LyricsSearchResult | undefined;
    api.search('anything here').subscribe((r) => (out = r));
    http.expectOne((r) => r.url === '/api/lyrics/search').flush({ results: [], reason: 'no-key' });
    expect(out).toBe('not-set-up');
  });

  it('a failure is an error', () => {
    const { api, http } = setup();
    let out: LyricsSearchResult | undefined;
    api.search('anything here').subscribe((r) => (out = r));
    http.expectOne((r) => r.url === '/api/lyrics/search').flush('x', { status: 502, statusText: 'Bad Gateway' });
    expect(out).toBe('error');
  });
});
