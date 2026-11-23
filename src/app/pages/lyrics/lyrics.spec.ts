import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LyricsPage } from './lyrics';
import { LyricsService, LyricsState } from '../../state/lyrics.service';
import { PlayerService } from '../../state/player.service';
import { Track } from '../../core/models';
import { makeTrack } from '../../core/testing/make-track';

function setup(state: LyricsState, current: Track | null = makeTrack('1')) {
  const player = { current: signal(current), seek: jasmine.createSpy('seek') };
  const lyrics = { lyrics: signal(state), activeIndex: signal(1) };
  TestBed.configureTestingModule({
    imports: [LyricsPage],
    providers: [
      provideRouter([]),
      { provide: PlayerService, useValue: player },
      { provide: LyricsService, useValue: lyrics },
    ],
  });
  const fixture = TestBed.createComponent(LyricsPage);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, player };
}

const READY: LyricsState = {
  trackId: '1',
  status: 'ready',
  data: {
    plain: 'a\nb',
    lines: [
      { time: 10, text: 'First line' },
      { time: 20, text: 'Second line' },
      { time: 30, text: 'Third line' },
    ],
    instrumental: false,
  },
};

describe('LyricsPage', () => {
  beforeEach(() => spyOn(Element.prototype, 'scrollIntoView'));

  it('marks the active line and clicking a line seeks to its time', () => {
    const { el, player } = setup(READY);
    const lines = el.querySelectorAll('button.line');
    expect(lines.length).toBe(3);
    expect(lines[1].classList).toContain('active');
    (lines[2] as HTMLButtonElement).click();
    expect(player.seek).toHaveBeenCalledWith(30);
    expect(el.textContent).toContain('Lyrics from LRCLIB');
  });

  it('shows plain lyrics when there are no synced lines', () => {
    const { el } = setup({ trackId: '1', status: 'ready', data: { plain: 'Just words', lines: [], instrumental: false } });
    expect(el.querySelector('button.line')).toBeNull();
    expect(el.textContent).toContain('Just words');
  });

  it('shows the instrumental state', () => {
    const { el } = setup({ trackId: '1', status: 'ready', data: { plain: '', lines: [], instrumental: true } });
    expect(el.textContent).toContain('♪ Instrumental');
  });

  it('shows the not-found state', () => {
    const { el } = setup({ trackId: '1', status: 'none', data: null });
    expect(el.textContent).toContain('No lyrics found for this song');
  });

  it('asks to play something when nothing is playing', () => {
    const { el } = setup({ trackId: '', status: 'idle', data: null }, null);
    expect(el.textContent).toContain('Play a song to see its lyrics');
  });
});
