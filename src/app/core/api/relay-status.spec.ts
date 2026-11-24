import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RelayStatusService } from './relay-status';

describe('RelayStatusService', () => {
  let http: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(RelayStatusService);
  }
  afterEach(() => http.verify());

  it('starts unknown, then reports ok and youtubeReady from /api/health', () => {
    const s = setup();
    expect(s.status()).toBe('unknown');
    http.expectOne('/api/health').flush({ ok: true, youtubeKey: true });
    expect(s.status()).toBe('ok');
    expect(s.youtubeReady()).toBeTrue();
  });

  it('reports ok without YouTube when no key is set', () => {
    const s = setup();
    http.expectOne('/api/health').flush({ ok: true, youtubeKey: false });
    expect(s.youtubeReady()).toBeFalse();
  });

  it('reports down when the relay is unreachable, and recheck recovers', () => {
    const s = setup();
    http.expectOne('/api/health').error(new ProgressEvent('error'), { status: 0 });
    expect(s.status()).toBe('down');
    expect(s.youtubeReady()).toBeFalse();
    s.recheck();
    http.expectOne('/api/health').flush({ ok: true, youtubeKey: true });
    expect(s.status()).toBe('ok');
  });
});
