# Music

A music streaming web app with a Spotify-inspired layout, built with Angular 20. It plays
full-length songs from the open [Audius](https://audius.co) catalog in the browser, with no
login needed.

## Features

- **Full-song playback** from Audius: queue, shuffle, repeat, seek, volume, and lock-screen and
  media-key controls (Media Session API).
- **Home** with trending songs (filter by genre), trending playlists, underground picks and
  recently played.
- **Search** with genre and mood tiles, a top result, and grouped songs, artists and playlists.
- **Song, artist and playlist pages** with real data. Headers are tinted with colour from the
  artwork.
- **Synced lyrics** from LRCLIB. Click a line to jump to it.
- **Artist bios and "Fans also like"** from Last.fm (optional key). These only appear for
  verified artists whose name matches exactly.
- **Your Library**: liked songs, saved playlists and artists, and your own playlists (create,
  rename, reorder, delete). Saved in this browser.
- **Works on phones**: bottom tabs, a mini player and a full-screen Now playing view.
- **Keyboard shortcuts**: Space play/pause · ←/→ seek 5 s · Shift+←/→ previous/next ·
  M mute · `/` search.

## Getting started

```bash
npm install
cp src/environments/environment.local.example.ts src/environments/environment.local.ts
npm start
```

Then open the URL that `ng serve` prints (by default `http://localhost:4200/`).

`environment.local.ts` is git-ignored and used by the development build. To show artist bios
and similar artists, add a free Last.fm API key there as `lastFmApiKey` (create one at
https://www.last.fm/api/account/create). Without a key those sections stay hidden.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server with live reload |
| `npm test` | Unit tests (Karma + Jasmine). Use `npx ng test --watch=false --browsers=ChromeHeadless` for a single run |
| `npm run build` | Production build to `dist/` |

## How it's put together

- `src/app/core`: config, models, and API clients (Audius, LRCLIB, Last.fm) that turn each
  API's response into the app's own `Track`, `Artist` and `Playlist` types, plus an in-memory
  HTTP cache.
- `src/app/state`: signal-based services: `PlayerService` (the single audio element and the
  queue), `LibraryService`, `LyricsService`, layout, panel, toast and shortcuts.
- `src/app/layout`: the app shell (navbar, sidebar, player bar, mini player, right panel and
  tab bar).
- `src/app/pages`: routed pages.
- `src/app/shared`: reusable components and utilities.
- Design docs: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Credits

Music and artist data from [Audius](https://audius.co). Lyrics from [LRCLIB](https://lrclib.net).
Artist bios from [Last.fm](https://www.last.fm). This is a non-commercial hobby project and is
not affiliated with Spotify.
