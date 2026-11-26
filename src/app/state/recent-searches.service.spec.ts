import { TestBed } from '@angular/core/testing';
import { RecentSearchesService } from './recent-searches.service';
import { makeTrack } from '../core/testing/make-track';

describe('RecentSearchesService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  const make = () => TestBed.inject(RecentSearchesService);

  it('keeps searches and songs newest first', () => {
    const s = make();
    s.addQuery('drake');
    s.addSong(makeTrack('apple:1', { title: 'Calm Down', artistName: 'Rema' }));
    expect(s.items().map((i) => i.title)).toEqual(['Calm Down', 'drake']);
    expect(s.items()[0].subtitle).toBe('Song • Rema');
    expect(s.items()[0].track?.id).toBe('apple:1'); // saved whole, so it can be played again
  });

  it('the same thing again moves to the top instead of appearing twice', () => {
    const s = make();
    s.addQuery('Drake');
    s.addQuery('rema');
    s.addQuery('drake ');
    expect(s.items().map((i) => i.title)).toEqual(['drake', 'rema']);
  });

  it('remembers them next time, up to 20', () => {
    const s = make();
    for (let i = 0; i < 25; i++) s.addQuery(`q${i}`);
    TestBed.resetTestingModule();
    const again = make();
    expect(again.items().length).toBe(20);
    expect(again.items()[0].title).toBe('q24');
  });

  it('removes one, or clears all', () => {
    const s = make();
    s.addQuery('a');
    s.addQuery('b');
    s.remove(s.items()[0].id);
    expect(s.items().map((i) => i.title)).toEqual(['a']);
    s.clear();
    expect(s.items()).toEqual([]);
    expect(JSON.parse(localStorage.getItem('recent-searches')!)).toEqual([]);
  });

  it('ignores a corrupt or old saved list', () => {
    localStorage.setItem('recent-searches', JSON.stringify([{ id: 'x', kind: 'weird', title: 't' }, { id: 'song:1', kind: 'song', title: 'no track' }, 7]));
    expect(make().items()).toEqual([]);
  });
});
