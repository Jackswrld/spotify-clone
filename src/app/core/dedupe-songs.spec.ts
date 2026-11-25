import { dedupeSongs, leadArtist } from './dedupe-songs';
import { makeTrack } from './testing/make-track';

const song = (id: string, artistName: string, title: string, albumName: string) =>
  makeTrack(id, { artistName, title, albumName, source: 'catalog' });

describe('dedupeSongs', () => {
  it('leadArtist keeps the first credited artist', () => {
    expect(leadArtist('Rema & Selena Gomez')).toBe('Rema');
    expect(leadArtist('A, B')).toBe('A');
    expect(leadArtist('A feat. B')).toBe('A');
    expect(leadArtist('A x B')).toBe('A');
    expect(leadArtist('Simon & Garfunkel')).toBe('Simon');
    expect(leadArtist('Rema')).toBe('Rema');
  });

  it('collapses one song released on a single, an album and deluxe editions, keeping the single', () => {
    const out = dedupeSongs([
      song('1', 'Rema & Selena Gomez', 'Calm Down', 'Rave & Roses Ultra'),
      song('2', 'Rema', 'Calm Down', 'Rave & Roses'),
      song('3', 'Taylor Swift', 'You Need To Calm Down', 'Lover'),
      song('4', 'Rema & Selena Gomez', 'Calm Down', 'Calm Down - Single'),
      song('5', 'Rema', 'Calm Down', 'Rave & Roses Ultra'),
      song('6', 'Rema', 'Calm Down', 'Rave & Roses'),
    ]);
    expect(out.map((t) => t.id)).toEqual(['4', '3']);
  });

  it('keeps remixes, live versions and other artists separate', () => {
    const out = dedupeSongs([
      song('1', 'Rema', 'Calm Down', 'Rave & Roses'),
      song('2', 'Rema', 'Calm Down (Remix)', 'Calm Down (Remix) - Single'),
      song('3', 'Taylor Swift', 'Calm Down', 'Lover'),
    ]);
    expect(out.map((t) => t.id)).toEqual(['1', '2', '3']);
  });

  it('without a single, the plain album beats deluxe, expanded and remastered editions', () => {
    const out = dedupeSongs([
      song('1', 'Drake', 'Hotline Bling', 'Views (Deluxe)'),
      song('2', 'Drake', 'Hotline Bling', 'Views (Expanded Edition)'),
      song('3', 'Drake', 'Hotline Bling', 'Views'),
      song('4', 'Drake', 'Hotline Bling', 'Views (Remastered)'),
    ]);
    expect(out.map((t) => t.id)).toEqual(['3']);
  });
});
