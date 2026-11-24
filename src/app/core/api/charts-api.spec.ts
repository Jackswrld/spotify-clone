import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChartsApi } from './charts-api';
import { Album, Track } from '../models';
import { APPLE_CHART_ALBUMS, APPLE_CHART_SONGS } from '../testing/catalog-fixtures';

describe('ChartsApi', () => {
  let api: ChartsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ChartsApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('topSongs calls the relay and maps the Apple feed', () => {
    let out: Track[] = [];
    api.topSongs('us').subscribe((t) => (out = t));
    http.expectOne('/api/charts/us/songs/25').flush(APPLE_CHART_SONGS);
    const t = out[0];
    expect(t.id).toBe('apple:1844932150');
    expect(t.appleId).toBe('1844932150');
    expect(t.source).toBe('catalog');
    expect(t.title).toBe("Choosin' Texas");
    expect(t.artistName).toBe('Ella Langley');
    expect(t.artistId).toBe('apple:1384373733');
    expect(t.genre).toBe('Country');
    expect(t.duration).toBe(0);
    expect(t.artwork.large).toContain('600x600bb');
    expect(t.appleUrl).toContain('music.apple.com');
  });

  it('topAlbums maps albums', () => {
    let out: Album[] = [];
    api.topAlbums('ng', 10).subscribe((a) => (out = a));
    http.expectOne('/api/charts/ng/albums/10').flush(APPLE_CHART_ALBUMS);
    expect(out[0].id).toBe('apple:6831560084');
    expect(out[0].appleId).toBe('6831560084');
    expect(out[0].name).toBe('E-Mortal Boy');
    expect(out[0].genre).toBe('Afrobeats');
  });
});
