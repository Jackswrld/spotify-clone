import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LastFmApi, LastFmArtistInfo } from './lastfm-api';
import { APP_CONFIG } from '../config';

const URL = 'https://ws.audioscrobbler.com/2.0/';

function setup(key = 'k') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: APP_CONFIG,
        useValue: { audiusBaseUrl: '', audiusAppName: '', audiusApiKey: '', lastFmApiKey: key, lrclibClient: '' },
      },
    ],
  });
  return { api: TestBed.inject(LastFmApi), http: TestBed.inject(HttpTestingController) };
}

const INFO_RESPONSE = {
  artist: {
    name: 'Cher',
    url: 'https://www.last.fm/music/Cher',
    tags: { tag: ['pop', 'dance', '80s', 'female vocalists', 'disco', 'rock'].map((name) => ({ name })) },
    bio: {
      summary:
        'Cher is an <b>American</b> singer. <a href="https://www.last.fm/music/Cher">Read more on Last.fm</a>',
    },
  },
};

describe('LastFmApi', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('artistInfo strips the "Read more" link and HTML, caps tags at 5', () => {
    const { api, http } = setup();
    let out: LastFmArtistInfo | null | undefined;
    api.artistInfo('Cher').subscribe((i) => (out = i));
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('method')).toBe('artist.getinfo');
    expect(req.request.params.get('artist')).toBe('Cher');
    expect(req.request.params.get('api_key')).toBe('k');
    expect(req.request.params.get('format')).toBe('json');
    expect(req.request.params.get('autocorrect')).toBe('0');
    req.flush(INFO_RESPONSE);
    expect(out).toEqual({
      name: 'Cher',
      bio: 'Cher is an American singer.',
      tags: ['pop', 'dance', '80s', 'female vocalists', 'disco'],
      url: 'https://www.last.fm/music/Cher',
    });
  });

  it('turns an empty bio into null', () => {
    const { api, http } = setup();
    let out: LastFmArtistInfo | null | undefined;
    api.artistInfo('Cher').subscribe((i) => (out = i));
    http.expectOne((r) => r.url === URL).flush({
      artist: { ...INFO_RESPONSE.artist, bio: { summary: ' <a href="https://www.last.fm/x">Read more on Last.fm</a>' } },
    });
    expect(out?.bio).toBeNull();
  });

  it('returns null for a Last.fm error body', () => {
    const { api, http } = setup();
    let out: LastFmArtistInfo | null | undefined;
    api.artistInfo('Nobody').subscribe((i) => (out = i));
    http.expectOne((r) => r.url === URL).flush({ error: 6, message: 'The artist you supplied could not be found' });
    expect(out).toBeNull();
  });

  it('makes no request and returns null/[] when no key is configured', () => {
    const { api, http } = setup('');
    let info: LastFmArtistInfo | null | undefined;
    let similar: string[] | undefined;
    api.artistInfo('Cher').subscribe((i) => (info = i));
    api.similar('Cher').subscribe((s) => (similar = s));
    http.expectNone(() => true);
    expect(info).toBeNull();
    expect(similar).toEqual([]);
  });

  it('similar returns names and [] on error', () => {
    const { api, http } = setup();
    let out: string[] | undefined;
    api.similar('Cher', 3).subscribe((s) => (out = s));
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('method')).toBe('artist.getsimilar');
    expect(req.request.params.get('limit')).toBe('3');
    req.flush({ similarartists: { artist: [{ name: 'Madonna' }, { name: 'Kylie Minogue' }] } });
    expect(out).toEqual(['Madonna', 'Kylie Minogue']);

    api.similar('Cher').subscribe((s) => (out = s));
    http.expectOne((r) => r.url === URL).flush('x', { status: 500, statusText: 'Server Error' });
    expect(out).toEqual([]);
  });
});
