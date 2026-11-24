import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { LastfmAbout } from './lastfm-about';
import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
import { ArtistInfo } from '../../core/models';
import { makeArtist } from '../../pages/testing/page-test-helpers';
import { FakeMedia, installFakeMatchMedia } from '../../state/testing-media';
import { Router } from '@angular/router';
import { CatalogApi } from '../../core/api/catalog-api';
import { ToastService } from '../../state/toast.service';

describe('LastfmAbout', () => {
  let media: FakeMedia;
  beforeEach(() => (media = installFakeMatchMedia(1280)));
  afterEach(() => media.restore());

  function setup() {
    const pending = new Map<string, Subject<ArtistInfo | null>>();
    const enrichment = {
      infoFor: jasmine.createSpy('infoFor').and.callFake((a: { id: string }) => {
        const s = new Subject<ArtistInfo | null>();
        pending.set(a.id, s);
        return s;
      }),
      fansAlsoLike: jasmine.createSpy('fansAlsoLike').and.returnValue(of([])),
      similarNames: jasmine.createSpy('similarNames').and.returnValue(of(['Burna Boy', 'Nobody'])),
    };
    const catalog = {
      findArtist: jasmine.createSpy('findArtist').and.callFake((name: string) =>
        of(name === 'Burna Boy' ? makeArtist('apple:44', { name, source: 'catalog' }) : null),
      ),
    };
    TestBed.configureTestingModule({
      imports: [LastfmAbout],
      providers: [
        provideRouter([]),
        { provide: ArtistEnrichmentService, useValue: enrichment },
        { provide: CatalogApi, useValue: catalog },
      ],
    });
    const fixture = TestBed.createComponent(LastfmAbout);
    const respond = (id: string, info: ArtistInfo | null) => {
      pending.get(id)!.next(info);
      pending.get(id)!.complete();
      fixture.detectChanges();
    };
    return { fixture, el: fixture.nativeElement as HTMLElement, respond };
  }

  it('renders the bio and tags with credit', () => {
    const { fixture, el, respond } = setup();
    fixture.componentRef.setInput('artist', makeArtist('a1', { verified: true }));
    fixture.detectChanges();
    respond('a1', { bio: 'A long story.', tags: ['pop'], url: 'https://last.fm/a1' });
    expect(el.textContent).toContain('A long story.');
    expect(el.textContent).toContain('pop');
    expect(el.querySelector('a[href="https://last.fm/a1"]')?.textContent).toContain('Bio from Last.fm');
  });

  it('renders nothing when there is no data', () => {
    const { fixture, el, respond } = setup();
    fixture.componentRef.setInput('artist', makeArtist('a1', { verified: true }));
    fixture.detectChanges();
    respond('a1', null);
    expect(el.textContent?.trim()).toBe('');
  });

  it('drops a stale response when the artist changes', () => {
    const { fixture, el, respond } = setup();
    fixture.componentRef.setInput('artist', makeArtist('old', { verified: true }));
    fixture.detectChanges();
    fixture.componentRef.setInput('artist', makeArtist('new', { verified: true }));
    fixture.detectChanges();
    respond('old', { bio: 'Old bio', tags: [], url: 'u' });
    expect(el.textContent).not.toContain('Old bio');
    respond('new', { bio: 'New bio', tags: [], url: 'u' });
    expect(el.textContent).toContain('New bio');
  });

  it('for catalog artists, similar names resolve on Apple when clicked', () => {
    const { fixture, el, respond } = setup();
    const nav = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentRef.setInput('artist', makeArtist('apple:9', { name: 'Rema', source: 'catalog' }));
    fixture.componentRef.setInput('showSimilar', true);
    fixture.detectChanges();
    respond('apple:9', null);
    const buttons = [...el.querySelectorAll('.similar button')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Burna Boy', 'Nobody']);
    buttons[0].click();
    expect(nav).toHaveBeenCalledWith(['/catalog-artist', '44']);
    buttons[1].click();
    expect(TestBed.inject(ToastService).message()).toBe("Couldn't find this on Apple Music");
  });
});
