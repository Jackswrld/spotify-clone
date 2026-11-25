import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NowPlayingView } from './now-playing-view';
import { PlayerService } from '../../state/player.service';
import { PanelStateService } from '../../state/panel-state.service';
import { AudiusApi } from '../../core/api/audius-api';
import { LyricsService } from '../../state/lyrics.service';
import { CatalogApi } from '../../core/api/catalog-api';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';
import { makeArtist } from '../../pages/testing/page-test-helpers';

function setup() {
  const current = signal<Track | null>(null);
  const player = {
    current,
    isPlaying: signal(false),
    upNext: computed(() => [] as Track[]),
    time: signal(0),
    playTracks: jasmine.createSpy('playTracks'),
  };
  const api = {
    artist: jasmine.createSpy('artist').and.callFake((id: string) => of(makeArtist(id, { name: `Name ${id}` }))),
    artistTracks: jasmine.createSpy('artistTracks').and.returnValue(of([])),
  };
  const catalog = {
    artist: jasmine.createSpy('artist').and.returnValue(of(makeArtist('apple:9', { name: 'Apple Rema', source: 'catalog' }))),
    artistTopSongs: jasmine.createSpy('artistTopSongs').and.returnValue(
      of([makeTrack('apple:2', { source: 'catalog', appleId: '2', title: 'Another Hit' })]),
    ),
  };
  TestBed.configureTestingModule({
    imports: [NowPlayingView],
    providers: [
      provideRouter([]),
      { provide: PlayerService, useValue: player },
      { provide: ArtistEnrichmentService, useValue: { infoFor: () => of(null), fansAlsoLike: () => of([]) } },
      { provide: AudiusApi, useValue: api },
      { provide: CatalogApi, useValue: catalog },
      { provide: PanelStateService, useValue: { open: jasmine.createSpy('open') } },
      {
        provide: LyricsService,
        useValue: { lyrics: signal({ trackId: '', status: 'idle', data: null }), activeIndex: signal(-1) },
      },
    ],
  });
  const fixture = TestBed.createComponent(NowPlayingView);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, current, api, catalog };
}

describe('NowPlayingView', () => {
  it('shows placeholder when nothing is loaded', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Play something to see it here');
  });

  it('shows the original cover art for a chart song (audio-only, no video)', () => {
    const { fixture, el, current } = setup();
    current.set(
      makeTrack('apple:1', {
        source: 'catalog', appleId: '1', artistId: 'apple:9',
        artwork: { small: 's.jpg', medium: 'm.jpg', large: 'https://is1.mzstatic.com/x/600x600bb.jpg' },
      }),
    );
    fixture.detectChanges();
    expect(el.querySelector('.view > app-cover.art')).toBeTruthy();
    expect(el.querySelector('.view > app-cover.art img')?.getAttribute('src')).toBe('https://is1.mzstatic.com/x/600x600bb.jpg');
    expect(el.querySelector('iframe, app-video-slot')).toBeNull();
  });

  it('loads the artist for the current track and swaps when the track changes', () => {
    const { fixture, el, current, api } = setup();
    current.set(makeTrack('1', { title: 'Fragments', artistId: 'a1', genre: 'Drum & Bass' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Fragments');
    expect(el.textContent).toContain('Name a1');
    expect(el.textContent).toContain('Drum & Bass');

    current.set(makeTrack('2', { title: 'Other', artistId: 'a2' }));
    fixture.detectChanges();
    expect(api.artist).toHaveBeenCalledWith('a2');
    expect(el.textContent).toContain('Name a2');
    expect(el.textContent).not.toContain('Name a1');
  });

  it('uses Apple catalog sources for a catalog song', () => {
    const { fixture, el, current, api, catalog } = setup();
    current.set(makeTrack('apple:1', { source: 'catalog', appleId: '1', artistId: 'apple:9' }));
    fixture.detectChanges();
    expect(catalog.artist).toHaveBeenCalledWith('9');
    expect(catalog.artistTopSongs).toHaveBeenCalledWith('9', 6);
    expect(api.artist).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Apple Rema');
    expect(el.textContent).toContain('Another Hit');
    expect(el.textContent).not.toContain('followers');
  });
});
