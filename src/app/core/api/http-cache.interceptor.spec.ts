import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { clearHttpCache, httpCacheInterceptor } from './http-cache.interceptor';

describe('httpCacheInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  const start = new Date('2026-11-23T12:00:00Z');

  beforeEach(() => {
    clearHttpCache();
    jasmine.clock().install();
    jasmine.clock().mockDate(start);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([httpCacheInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    backend.verify();
  });

  it('serves a repeated GET from cache', () => {
    const results: unknown[] = [];
    http.get('/api/users/1').subscribe((r) => results.push(r));
    backend.expectOne('/api/users/1').flush({ n: 1 });
    http.get('/api/users/1').subscribe((r) => results.push(r));
    backend.expectNone('/api/users/1');
    expect(results).toEqual([{ n: 1 }, { n: 1 }]);
  });

  it('expires /trending after 3 minutes but keeps other URLs for 10', () => {
    http.get('/api/tracks/trending').subscribe();
    backend.expectOne('/api/tracks/trending').flush({});
    http.get('/api/users/1').subscribe();
    backend.expectOne('/api/users/1').flush({});

    jasmine.clock().mockDate(new Date(start.getTime() + 3 * 60_000 + 1000));

    http.get('/api/tracks/trending').subscribe();
    backend.expectOne('/api/tracks/trending').flush({});
    http.get('/api/users/1').subscribe();
    backend.expectNone('/api/users/1');
  });

  it('does not cache errors', () => {
    http.get('/api/users/2').subscribe({ error: () => undefined });
    backend.expectOne('/api/users/2').flush('boom', { status: 500, statusText: 'Server Error' });
    http.get('/api/users/2').subscribe();
    backend.expectOne('/api/users/2').flush({});
  });

  it('never caches relay health, YouTube match or lyric search calls', () => {
    for (const url of ['/api/health', '/api/youtube/match?artist=a&title=b', '/api/lyrics/search?q=a']) {
      http.get(url).subscribe();
      backend.expectOne(url).flush({});
      http.get(url).subscribe();
      backend.expectOne(url).flush({});
    }
  });

  it('keys by full URL including query params', () => {
    http.get('/api/search', { params: { q: 'a' } }).subscribe();
    backend.expectOne('/api/search?q=a').flush({});
    http.get('/api/search', { params: { q: 'b' } }).subscribe();
    backend.expectOne('/api/search?q=b').flush({});
  });
});
