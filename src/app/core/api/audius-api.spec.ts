import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AudiusApi } from './audius-api';
import { APP_CONFIG, AppConfig } from '../config';
import { RAW_GATED_TRACK, RAW_PLAYLIST, RAW_TRACK } from '../testing/fixtures';
import { Track } from '../models';

const BASE = 'https://audius.test/v1';

function setup(overrides: Partial<AppConfig> = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: APP_CONFIG,
        useValue: {
          audiusBaseUrl: BASE,
          audiusAppName: 'test-app',
          audiusApiKey: '',
          lastFmApiKey: '',
          lrclibClient: 'test',
          ...overrides,
        } satisfies AppConfig,
      },
    ],
  });
  return { api: TestBed.inject(AudiusApi), http: TestBed.inject(HttpTestingController) };
}

describe('AudiusApi', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('trendingTracks sends app_name and filters gated tracks', () => {
    const { api, http } = setup();
    let out: Track[] = [];
    api.trendingTracks({ genre: 'Electronic' }).subscribe((t) => (out = t));
    const req = http.expectOne((r) => r.url === `${BASE}/tracks/trending`);
    expect(req.request.params.get('app_name')).toBe('test-app');
    expect(req.request.params.get('genre')).toBe('Electronic');
    req.flush({ data: [RAW_TRACK, RAW_GATED_TRACK] });
    expect(out.length).toBe(1);
    expect(out[0].id).toBe(RAW_TRACK.id);
  });

  it('trendingTracks sends no genre when none is given', () => {
    const { api, http } = setup();
    api.trendingTracks().subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/tracks/trending`);
    expect(req.request.params.has('genre')).toBeFalse();
    req.flush({ data: [] });
  });

  it('playlist() unwraps the one-element array', () => {
    const { api, http } = setup();
    let name = '';
    api.playlist('4W67oyr').subscribe((p) => (name = p.name));
    http.expectOne((r) => r.url === `${BASE}/playlists/4W67oyr`).flush({ data: [RAW_PLAYLIST] });
    expect(name).toBe(RAW_PLAYLIST.playlist_name);
  });

  it('track() errors for a gated track', () => {
    const { api, http } = setup();
    let failed = false;
    api.track('Gated1').subscribe({ error: () => (failed = true) });
    http.expectOne((r) => r.url === `${BASE}/tracks/Gated1`).flush({ data: RAW_GATED_TRACK });
    expect(failed).toBeTrue();
  });

  it('searchTracks sends query and filters gated tracks', () => {
    const { api, http } = setup();
    let out: Track[] = [];
    api.searchTracks('lofi', 5).subscribe((t) => (out = t));
    const req = http.expectOne((r) => r.url === `${BASE}/tracks/search`);
    expect(req.request.params.get('query')).toBe('lofi');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ data: [RAW_GATED_TRACK, RAW_TRACK] });
    expect(out.map((t) => t.id)).toEqual([RAW_TRACK.id]);
  });

  it('streamUrl builds without a request', () => {
    const { api, http } = setup();
    expect(api.streamUrl('abc')).toBe(`${BASE}/tracks/abc/stream?app_name=test-app`);
    http.expectNone(() => true);
  });

  it('adds api_key param only when configured', () => {
    const { api, http } = setup({ audiusApiKey: 'k' });
    api.artist('M33MVx').subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/users/M33MVx`);
    expect(req.request.params.get('api_key')).toBe('k');
    req.flush({ data: {} });
  });
});
