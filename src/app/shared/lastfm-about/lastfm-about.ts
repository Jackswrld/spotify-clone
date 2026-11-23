import { Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Artist } from '../../core/models';
import { ArtistEnrichmentService } from '../../state/artist-enrichment.service';
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
    @if (showSimilar()) {
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
  `,
})
export class LastfmAbout {
  private readonly enrichment = inject(ArtistEnrichmentService);

  readonly artist = input.required<Artist>();
  readonly showSimilar = input(false);

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
        this.showSimilar() ? this.enrichment.fansAlsoLike(a).pipe(catchError(() => of([] as Artist[]))) : of([] as Artist[]),
      ),
    ),
    { initialValue: [] as Artist[] },
  );
}
