import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TrackPage } from './track';
import { AudiusApi } from '../../core/api/audius-api';
import { PlayerService } from '../../state/player.service';
import { makeTrack } from '../../core/testing/make-track';
import { fakePlayer, makeArtist } from '../testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';

const TRACK = makeTrack('t1', {
  title: 'Fragments',
  artistId: 'a1',
  artistName: 'Xsetra',
  playCount: 1796,
  releaseDate: '2026-10-22T13:00:00Z',
  duration: 212,
  genre: 'Drum & Bass',
  mood: 'Fiery',
  tags: ['dnb'],
  description: 'A rolling roller.',
});
const MORE = [makeTrack('t1'), makeTrack('m1'), makeTrack('m2')];

function setup(trackResult = of(TRACK)) {
  const api = {
    track: jasmine.createSpy('track').and.callFake((id: string) =>
      id === 't2' ? of(makeTrack('t2', { title: 'Second' })) : trackResult,
    ),
    artist: jasmine.createSpy('artist').and.returnValue(of(makeArtist('a1', { name: 'Xsetra' }))),
    artistTracks: jasmine.createSpy('artistTracks').and.returnValue(of(MORE)),
  };
  const player = fakePlayer();
  TestBed.configureTestingModule({
    imports: [TrackPage],
    providers: [
      provideRouter([]),
      { provide: AudiusApi, useValue: api },
      { provide: PlayerService, useValue: player },
    ],
  });
  const fixture = TestBed.createComponent(TrackPage);
  fixture.componentRef.setInput('id', 't1');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, player };
}

describe('TrackPage', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  it('shows title, plays, year and length', () => {
    const { el } = setup();
    expect(el.querySelector('h1')?.textContent).toContain('Fragments');
    const line = el.querySelector('.stats-line')?.textContent ?? '';
    expect(line).toContain('1.8K plays');
    expect(line).toContain('2026');
    expect(line).toContain('3:32');
    expect(el.textContent).toContain('A rolling roller.');
    expect(el.textContent).toContain('Fiery');
  });

  it('play button plays [track, ...moreByArtist] without duplicating the track', () => {
    const { el, player } = setup();
    (el.querySelector('button.big-play') as HTMLButtonElement).click();
    const [list, index] = player.playTracks.calls.mostRecent().args;
    expect(list.map((t: { id: string }) => t.id)).toEqual(['t1', 'm1', 'm2']);
    expect(index).toBe(0);
  });

  it('play button pauses when this track is current and playing', () => {
    const { fixture, el, player } = setup();
    player.current.set(TRACK);
    player.isPlaying.set(true);
    fixture.detectChanges();
    const button = el.querySelector('button.big-play') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Pause');
    button.click();
    expect(player.toggle).toHaveBeenCalled();
    expect(player.playTracks).not.toHaveBeenCalled();
  });

  it('shows the unavailable message when the API errors', () => {
    const { el } = setup(throwError(() => new Error('gated')));
    expect(el.textContent).toContain("This track isn't available.");
  });

  it('reloads when the route id changes', () => {
    const { fixture, el, api } = setup();
    fixture.componentRef.setInput('id', 't2');
    fixture.detectChanges();
    expect(api.track).toHaveBeenCalledWith('t2');
    expect(el.querySelector('h1')?.textContent).toContain('Second');
  });

  it('lists more by the artist excluding this track', () => {
    const { el } = setup();
    const rows = el.querySelectorAll('.more app-track-row');
    expect(rows.length).toBe(2);
  });
});
