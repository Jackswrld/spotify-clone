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
  { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
  { path: 'search', loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage) },
  { path: 'track/:id', loadComponent: () => import('./pages/track/track').then((m) => m.TrackPage) },
  { path: 'artist/:id', loadComponent: () => import('./pages/artist/artist').then((m) => m.ArtistPage) },
  { path: 'playlist/:id', loadComponent: () => import('./pages/playlist/playlist').then((m) => m.PlaylistPage) },
  { path: 'my-playlist/:id', loadComponent: () => import('./pages/my-playlist/my-playlist').then((m) => m.MyPlaylistPage) },
  { path: 'library', loadComponent: () => import('./pages/library/library').then((m) => m.LibraryPage) },
  { path: 'lyrics', component: EmptyPage },
  { path: '**', redirectTo: 'home' },
];
