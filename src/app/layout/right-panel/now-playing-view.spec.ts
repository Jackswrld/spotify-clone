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
  TestBed.configureTestingModule({
    imports: [NowPlayingView],
    providers: [
      provideRouter([]),
      { provide: PlayerService, useValue: player },
      { provide: ArtistEnrichmentService, useValue: { infoFor: () => of(null), fansAlsoLike: () => of([]) } },
      { provide: AudiusApi, useValue: api },
      { provide: PanelStateService, useValue: { open: jasmine.createSpy('open') } },
      {
        provide: LyricsService,
        useValue: { lyrics: signal({ trackId: '', status: 'idle', data: null }), activeIndex: signal(-1) },
      },
    ],
  });
  const fixture = TestBed.createComponent(NowPlayingView);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, current, api };
}

describe('NowPlayingView', () => {
  it('shows placeholder when nothing is loaded', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Play something to see it here');
  });

  it('shows the video slot instead of the cover for a YouTube song', () => {
    const { fixture, el, current } = setup();
    current.set(makeTrack('apple:1', { source: 'catalog', appleId: '1', artistId: 'apple:9' }));
    fixture.detectChanges();
    expect(el.querySelector('app-video-slot')).toBeTruthy();
    expect(el.querySelector('app-cover.art')).toBeNull();
    current.set(makeTrack('1'));
    fixture.detectChanges();
    expect(el.querySelector('app-video-slot')).toBeNull();
    expect(el.querySelector('app-cover.art')).toBeTruthy();
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
});
