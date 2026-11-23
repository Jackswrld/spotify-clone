import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Sections">
      @for (tab of tabs; track tab.link) {
        <a [routerLink]="tab.link" routerLinkActive="active" ariaCurrentWhenActive="page" class="tab">
          <i [class]="'fa-solid ' + tab.icon" aria-hidden="true"></i>
          <span>{{ tab.label }}</span>
        </a>
      }
    </nav>
  `,
  styleUrl: './tab-bar.scss',
})
export class TabBar {
  protected readonly tabs = [
    { link: '/home', label: 'Home', icon: 'fa-house' },
    { link: '/search', label: 'Search', icon: 'fa-magnifying-glass' },
    { link: '/library', label: 'Your Library', icon: 'fa-book' },
  ];
}
