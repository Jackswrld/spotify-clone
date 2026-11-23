import { Component, DestroyRef, inject } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, filter, map } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { LayoutService } from '../../state/layout.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);

  private readonly typed = new Subject<string>();

  /** Mirrors ?q= so the box shows the current search after navigation. */
  protected readonly query = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.parseUrl(this.router.url).queryParamMap.get('q') ?? ''),
    ),
    { initialValue: '' },
  );

  constructor() {
    this.typed
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((q) => {
        this.router.navigate(['/search'], {
          queryParams: q ? { q } : {},
          replaceUrl: this.router.url.startsWith('/search'),
        });
      });
  }

  protected back(): void {
    this.location.back();
  }

  protected forward(): void {
    this.location.forward();
  }

  protected onSearch(value: string): void {
    this.typed.next(value.trim());
  }
}
