import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, filter, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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

  /**
   * What the box shows: exactly what was typed (spaces included). The address bar holds the
   * trimmed search, so it only replaces the box when it says something else (back button, a link).
   */
  protected readonly box = signal('');

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => this.router.parseUrl(this.router.url).queryParamMap.get('q') ?? ''),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        if (q !== this.box().trim()) this.box.set(q);
      });
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
    this.box.set(value);
    this.typed.next(value.trim());
  }
}
