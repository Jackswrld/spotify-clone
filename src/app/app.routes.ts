import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
  { path: 'search', loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage) },
  { path: 'track/:id', loadComponent: () => import('./pages/track/track').then((m) => m.TrackPage) },
  { path: 'artist/:id', loadComponent: () => import('./pages/artist/artist').then((m) => m.ArtistPage) },
  { path: 'playlist/:id', loadComponent: () => import('./pages/playlist/playlist').then((m) => m.PlaylistPage) },
  { path: 'my-playlist/:id', loadComponent: () => import('./pages/my-playlist/my-playlist').then((m) => m.MyPlaylistPage) },
  { path: 'library', loadComponent: () => import('./pages/library/library').then((m) => m.LibraryPage) },
  { path: 'lyrics', loadComponent: () => import('./pages/lyrics/lyrics').then((m) => m.LyricsPage) },
  { path: '**', redirectTo: 'home' },
];
