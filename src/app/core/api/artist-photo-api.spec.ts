import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ArtistPhotoApi, ArtistPhoto } from './artist-photo-api';
import { makeArtist } from '../../pages/testing/page-test-helpers';
import { Artist } from '../models';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { api: TestBed.inject(ArtistPhotoApi), http: TestBed.inject(HttpTestingController) };
}

describe('ArtistPhotoApi', () => {
  it('asks the music server once per name per session', () => {
    const { api, http } = setup();
    const seen: ArtistPhoto[] = [];
    api.photoFor('Wizkid').subscribe((p) => seen.push(p));
    const req = http.expectOne((r) => r.url === '/api/artist-photo' && r.params.get('name') === 'Wizkid');
    req.flush({ image: 'w.jpg', fans: 1005214 });
    api.photoFor(' WIZKID').subscribe((p) => seen.push(p));
    http.expectNone('/api/artist-photo');
    expect(seen).toEqual([{ image: 'w.jpg', fans: 1005214 }, { image: 'w.jpg', fans: 1005214 }]);
  });

  it('a failure gives no photo and no fans', () => {
    const { api, http } = setup();
    let out: ArtistPhoto | undefined;
    api.photoFor('Rema').subscribe((p) => (out = p));
    http.expectOne((r) => r.url === '/api/artist-photo').flush('x', { status: 502, statusText: 'Bad Gateway' });
    expect(out).toEqual({ image: null, fans: 0 });
  });

  it('withPhoto fills a catalog artist photo and fan count, and leaves Audius artists alone', () => {
    const { api, http } = setup();
    let out: Artist | undefined;
    api.withPhoto(makeArtist('apple:9', { name: 'Rema', source: 'catalog' })).subscribe((a) => (out = a));
    http.expectOne((r) => r.url === '/api/artist-photo').flush({ image: 'r.jpg', fans: 900 });
    expect(out?.avatar).toEqual({ small: 'r.jpg', medium: 'r.jpg', large: 'r.jpg' });
    expect(out?.followerCount).toBe(900);
    const audius = makeArtist('a1', { name: 'Rema' });
    api.withPhoto(audius).subscribe((a) => (out = a));
    http.expectNone('/api/artist-photo');
    expect(out).toBe(audius);
  });
});
