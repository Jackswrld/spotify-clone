import { albumLink, artistLink, trackLink } from './links';
import { makeTrack } from './testing/make-track';
import { Album, Artist } from './models';

describe('links', () => {
  it('routes catalog and audius tracks differently', () => {
    expect(trackLink(makeTrack('1'))).toEqual(['/track', '1']);
    expect(trackLink(makeTrack('apple:55', { source: 'catalog', appleId: '55' }))).toEqual(['/song', '55']);
  });

  it('routes artists by source, from a track or an artist', () => {
    expect(artistLink(makeTrack('1', { artistId: 'a1' }))).toEqual(['/artist', 'a1']);
    expect(artistLink(makeTrack('x', { source: 'catalog', artistId: 'apple:9' }))).toEqual(['/catalog-artist', '9']);
    const artist = { id: 'apple:9', source: 'catalog' } as Artist;
    expect(artistLink(artist)).toEqual(['/catalog-artist', '9']);
  });

  it('routes albums by apple id', () => {
    expect(albumLink({ appleId: '77' } as Album)).toEqual(['/album', '77']);
  });
});
