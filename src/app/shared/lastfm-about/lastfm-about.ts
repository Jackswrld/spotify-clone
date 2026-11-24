import { Component, Injector, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Artist } from '../../core/models';
import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
import { CatalogApi } from '../../core/api/catalog-api';
import { appleIdOf } from '../../core/links';
import { ToastService } from '../../state/toast.service';
import { MediaCard } from '../media-card/media-card';
import { Shelf } from '../shelf/shelf';

/** Last.fm bio and tags (and optionally "Fans also like") for verified artists only. */
@Component({
  selector: 'app-lastfm-about',
  imports: [MediaCard, Shelf],
  template: `
    @if (info(); as i) {
      <div class="lastfm">
        @if (i.bio) {
          <p class="bio">{{ i.bio }}</p>
        }
        @if (i.tags.length) {
          <div class="tags">
            @for (tag of i.tags; track tag) {
              <span class="tag">{{ tag }}</span>
            }
          </div>
        }
        <a class="credit" [href]="i.url" target="_blank" rel="noopener">Bio from Last.fm</a>
      </div>
    }
    @if (showSimilar() && isCatalog()) {
      @if (similarNames().length) {
        <section class="similar" aria-label="Fans also like">
          <h2>Fans also like</h2>
          <div class="names">
            @for (name of similarNames(); track name) {
              <button type="button" (click)="openSimilar(name)">{{ name }}</button>
            }
          </div>
        </section>
      }
    } @else if (showSimilar()) {
      <app-shelf title="Fans also like" [count]="similar().length">
        @for (a of similar(); track a.id) {
          <app-media-card
            [title]="a.name"
            subtitle="Artist"
            [image]="a.avatar.medium"
            [seed]="a.id"
            [round]="true"
            [playable]="false"
            [link]="['/artist', a.id]"
          />
        }
      </app-shelf>
    }
  `,
  styles: `
    .lastfm {
      margin-top: 12px;
    }
    .bio {
      max-width: 70ch;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-muted);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 10px 0;
    }
    .tag {
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--surface-3);
      font-size: 12px;
    }
    .credit {
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: underline;
    }
    app-shelf {
      display: block;
      margin-top: 24px;
    }
    .similar {
      margin-top: 24px;
      h2 {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 12px;
      }
    }
    .names {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      button {
        min-height: 36px;
        padding: 0 16px;
        border: 0;
        border-radius: 999px;
        background: var(--surface-2);
        font-weight: 600;
        cursor: pointer;
        &:hover {
          background: var(--surface-3);
        }
      }
    }
  `,
})
export class LastfmAbout {
  private readonly enrichment = inject(ArtistEnrichmentService);
  /** Resolved only when a similar artist is clicked. */
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly artist = input.required<Artist>();
  readonly showSimilar = input(false);

  protected readonly isCatalog = computed(() => this.artist().source === 'catalog');

  // switchMap drops a previous artist's response when the artist changes.
  protected readonly info = toSignal(
    toObservable(this.artist).pipe(
      switchMap((a) => this.enrichment.infoFor(a).pipe(catchError(() => of(null)))),
    ),
    { initialValue: null },
  );

  protected readonly similar = toSignal(
    toObservable(this.artist).pipe(
      switchMap((a) =>
        this.showSimilar() && a.source !== 'catalog' ? this.enrichment.fansAlsoLike(a).pipe(catchError(() => of([] as Artist[]))) : of([] as Artist[]),
      ),
    ),
    { initialValue: [] as Artist[] },
  );

  /** Catalog artists: Last.fm similar names, each resolved on Apple only when clicked. */
  protected readonly similarNames = toSignal(
    toObservable(this.artist).pipe(
      switchMap((a) =>
        this.showSimilar() && a.source === 'catalog'
          ? this.enrichment.similarNames(a).pipe(catchError(() => of([] as string[])))
          : of([] as string[]),
      ),
    ),
    { initialValue: [] as string[] },
  );

  protected openSimilar(name: string): void {
    this.injector.get(CatalogApi).findArtist(name).subscribe((artist) => {
      if (artist) this.router.navigate(['/catalog-artist', appleIdOf(artist.id)]);
      else this.toast.show("Couldn't find this on Apple Music");
    });
  }
}
