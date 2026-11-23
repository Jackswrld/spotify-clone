import { Component } from '@angular/core';
import { Routes } from '@angular/router';

/** Placeholder for routes whose pages land in later tasks. */
@Component({
  selector: 'app-empty-page',
  template: `<p class="empty">Coming soon.</p>`,
  styles: `.empty { padding: 24px; color: var(--text-muted); }`,
})
export class EmptyPage {}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', loadComponent: () => import('./home/home').then((m) => m.Home) },
  { path: 'search', component: EmptyPage },
  { path: 'track/:id', component: EmptyPage },
  { path: 'artist/:id', component: EmptyPage },
  { path: 'playlist/:id', component: EmptyPage },
  { path: 'my-playlist/:id', component: EmptyPage },
  { path: 'library', component: EmptyPage },
  { path: 'lyrics', component: EmptyPage },
  { path: '**', redirectTo: 'home' },
];
