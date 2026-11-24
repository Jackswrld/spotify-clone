import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ArtistEnrichmentService } from './artist-enrichment.service';
import { LastFmApi } from '../core/api/lastfm-api';
import { AudiusApi } from '../core/api/audius-api';
import { Artist, ArtistInfo } from '../core/models';
import { makeArtist } from '../pages/testing/page-test-helpers';

function setup(opts: { lastFmName?: string; similar?: string[]; search?: Record<string, Artist[]> } = {}) {
  const lastfm = {
    artistInfo: jasmine
      .createSpy('artistInfo')
      .and.returnValue(of({ name: opts.lastFmName ?? 'Xsetra', bio: 'Bio', tags: ['dnb'], url: 'u' })),
    similar: jasmine.createSpy('similar').and.returnValue(of(opts.similar ?? [])),
  };
  const audius = {
    searchArtists: jasmine
      .createSpy('searchArtists')
      .and.callFake((q: string) => of(opts.search?.[q] ?? [])),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: LastFmApi, useValue: lastfm },
      { provide: AudiusApi, useValue: audius },
    ],
  });
  return { service: TestBed.inject(ArtistEnrichmentService), lastfm, audius };
}

describe('ArtistEnrichmentService', () => {
  it('infoFor returns null for an unverified artist without calling Last.fm', () => {
    const { service, lastfm } = setup();
    let out: ArtistInfo | null | undefined;
    service.infoFor(makeArtist('a1', { name: 'Xsetra', verified: false })).subscribe((i) => (out = i));
    expect(out).toBeNull();
    expect(lastfm.artistInfo).not.toHaveBeenCalled();
  });

  it('infoFor returns the info for a verified exact-name match (case-insensitive)', () => {
    const { service } = setup({ lastFmName: 'XSETRA ' });
    let out: ArtistInfo | null | undefined;
    service.infoFor(makeArtist('a1', { name: 'Xsetra', verified: true })).subscribe((i) => (out = i));
    expect(out).toEqual({ bio: 'Bio', tags: ['dnb'], url: 'u' });
  });

  it('infoFor skips the verified rule for Apple catalog artists but keeps the exact name', () => {
    const { service } = setup({ lastFmName: 'Rema' });
    let out: ArtistInfo | null | undefined;
    service.infoFor(makeArtist('apple:9', { name: 'Rema', verified: false, source: 'catalog' })).subscribe((i) => (out = i));
    expect(out).toEqual({ bio: 'Bio', tags: ['dnb'], url: 'u' });
    TestBed.resetTestingModule();
    const other = setup({ lastFmName: 'Rema Band' });
    other.service.infoFor(makeArtist('apple:9', { name: 'Rema', source: 'catalog' })).subscribe((i) => (out = i));
    expect(out).toBeNull();
  });

  it('infoFor returns null when the Last.fm name differs', () => {
    const { service } = setup({ lastFmName: 'Xsetra Band' });
    let out: ArtistInfo | null | undefined;
    service.infoFor(makeArtist('a1', { name: 'Xsetra', verified: true })).subscribe((i) => (out = i));
    expect(out).toBeNull();
  });

  it('fansAlsoLike keeps only verified exact-name Audius matches, max 6', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const search: Record<string, Artist[]> = {};
    for (const n of names) search[n] = [makeArtist(n, { name: n, verified: true })];
    search['B'] = [makeArtist('b-fake', { name: 'B', verified: false })]; // impostor
    search['C'] = [makeArtist('c-other', { name: 'C Junior', verified: true })]; // different person
    const { service } = setup({ similar: names, search });
    let out: Artist[] = [];
    service.fansAlsoLike(makeArtist('x', { name: 'X', verified: true })).subscribe((a) => (out = a));
    expect(out.map((a) => a.name)).toEqual(['A', 'D', 'E', 'F', 'G', 'H']);
  });

  it('fansAlsoLike returns [] for an unverified artist', () => {
    const { service, lastfm } = setup({ similar: ['A'] });
    let out: Artist[] | undefined;
    service.fansAlsoLike(makeArtist('x', { verified: false })).subscribe((a) => (out = a));
    expect(out).toEqual([]);
    expect(lastfm.similar).not.toHaveBeenCalled();
  });
});
