import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CATALOG_COUNTRY, CatalogApi } from './catalog-api';
import { Album, Artist, Track } from '../models';
import { IT_ALBUM, IT_ARTIST, IT_OLD_ALBUM, IT_SONG } from '../testing/catalog-fixtures';

const BASE = 'https://itunes.apple.com';

function setup(country = 'us') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: CATALOG_COUNTRY, useValue: signal(country) },
    ],
  });
  return { api: TestBed.inject(CatalogApi), http: TestBed.inject(HttpTestingController) };
}

describe('CatalogApi', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('searchSongs maps iTunes results to catalog tracks with larger art and seconds', () => {
    const { api, http } = setup();
    let out: Track[] = [];
    api.searchSongs('calm down', 5).subscribe((t) => (out = t));
    const req = http.expectOne((r) => r.url === `${BASE}/search`);
    expect(req.request.params.get('term')).toBe('calm down');
    expect(req.request.params.get('entity')).toBe('song');
    expect(req.request.params.get('media')).toBe('music');
    expect(req.request.params.get('limit')).toBe('10'); // twice the limit: duplicates are removed
    req.flush({ resultCount: 1, results: [IT_SONG] });
    const t = out[0];
    expect(t.id).toBe('apple:1614063459');
    expect(t.appleId).toBe('1614063459');
    expect(t.source).toBe('catalog');
    expect(t.title).toBe('Calm Down');
    expect(t.artistId).toBe('apple:1304716885');
    expect(t.albumId).toBe('apple:1614063395');
    expect(t.albumName).toBe('Rave & Roses');
    expect(t.duration).toBeCloseTo(219.669, 2);
    expect(t.genre).toBe('Afrobeats');
    expect(t.artwork.large).toContain('600x600bb');
    expect(t.artwork.medium).toContain('300x300bb');
    expect(t.artwork.small).toContain('100x100bb');
    expect(t.appleUrl).toBe(IT_SONG.trackViewUrl);
    expect(JSON.stringify(t)).not.toContain('preview'); // previews are never used
  });

  it('album() splits the collection from its tracks', () => {
    const { api, http } = setup();
    let out: { album: Album; tracks: Track[] } | undefined;
    api.album('6831560084').subscribe((r) => (out = r));
    const req = http.expectOne((r) => r.url === `${BASE}/lookup`);
    expect(req.request.params.get('id')).toBe('6831560084');
    expect(req.request.params.get('entity')).toBe('song');
    req.flush({ resultCount: 2, results: [IT_ALBUM, IT_SONG] });
    expect(out?.album.name).toBe('E-Mortal Boy');
    expect(out?.album.id).toBe('apple:6831560084');
    expect(out?.album.releaseDate).toBe('2026-11-20T08:00:00Z');
    expect(out?.tracks.map((t) => t.title)).toEqual(['Calm Down']);
  });

  it('artistAlbums drops the artist row and sorts newest first', () => {
    const { api, http } = setup();
    let out: Album[] = [];
    api.artistAlbums('1304716885').subscribe((a) => (out = a));
    const req = http.expectOne((r) => r.url === `${BASE}/lookup`);
    expect(req.request.params.get('entity')).toBe('album');
    expect(req.request.params.get('sort')).toBe('recent');
    req.flush({ results: [IT_ARTIST, IT_OLD_ALBUM, IT_ALBUM] });
    expect(out.map((a) => a.name)).toEqual(['E-Mortal Boy', 'Rave & Roses']);
  });

  it('artist() maps the artist row', () => {
    const { api, http } = setup();
    let out: Artist | undefined;
    api.artist('1304716885').subscribe((a) => (out = a));
    http.expectOne((r) => r.url === `${BASE}/lookup`).flush({ results: [IT_ARTIST] });
    expect(out?.id).toBe('apple:1304716885');
    expect(out?.source).toBe('catalog');
    expect(out?.name).toBe('Rema');
    expect(out?.appleUrl).toBe(IT_ARTIST.artistLinkUrl);
  });

  it('findSong picks the exact artist and title match, ignoring case and "feat."', () => {
    const { api, http } = setup();
    let out: Track | null | undefined;
    api.findSong('REMA', 'Calm Down (feat. Selena Gomez)').subscribe((t) => (out = t));
    http.expectOne((r) => r.url === `${BASE}/search`).flush({
      results: [{ ...IT_SONG, trackId: 1, trackName: 'Calm Down (Remix)' }, IT_SONG],
    });
    expect(out?.appleId).toBe('1614063459');
  });

  it('findSong returns null when nothing matches exactly', () => {
    const { api, http } = setup();
    let out: Track | null | undefined;
    api.findSong('Rema', 'Something Else').subscribe((t) => (out = t));
    http.expectOne((r) => r.url === `${BASE}/search`).flush({ results: [IT_SONG] });
    expect(out).toBeNull();
  });

  it('uses the country signal in requests', () => {
    const { api, http } = setup('ng');
    api.searchArtists('rema').subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/search`);
    expect(req.request.params.get('country')).toBe('ng');
    expect(req.request.params.get('entity')).toBe('musicArtist');
    req.flush({ results: [] });
  });

  it('searchSongs and artistTopSongs return each song once, up to the limit', () => {
    const { api, http } = setup();
    const copy = (id: number, collectionName: string, artistName = 'Rema') => ({ ...IT_SONG, trackId: id, collectionName, artistName });
    const other = { ...IT_SONG, trackId: 9, trackName: 'Charm', collectionName: 'Rave & Roses' };
    let out: Track[] = [];
    api.searchSongs('calm down', 2).subscribe((t) => (out = t));
    http.expectOne((r) => r.url === `${BASE}/search`).flush({
      results: [copy(1, 'Rave & Roses'), copy(2, 'Calm Down - Single', 'Rema & Selena Gomez'), copy(3, 'Rave & Roses Ultra'), other],
    });
    expect(out.map((t) => t.appleId)).toEqual(['2', '9']);

    api.artistTopSongs('1304716885', 2).subscribe((t) => (out = t));
    const req = http.expectOne((r) => r.url === `${BASE}/lookup`);
    expect(req.request.params.get('limit')).toBe('4');
    req.flush({ results: [copy(1, 'Rave & Roses'), copy(3, 'Rave & Roses Ultra'), other] });
    expect(out.map((t) => t.appleId)).toEqual(['1', '9']);
  });
});
