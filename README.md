# Music

A music streaming web app with a Spotify-inspired layout, built with Angular 20.

- **Mainstream music:** the current charts and the latest releases, with full songs played
  through YouTube's official embedded player.
- **Independent music:** full-length songs from the open [Audius](https://audius.co) catalog,
  streamed as audio.

No login needed.

## Features

- **Real charts:** top songs and albums for your country (from Apple Music's chart feed), plus a
  global top songs list from Last.fm (optional key).
- **Full songs, legally:** pressing play on a mainstream song finds its official video and plays
  it in YouTube's own player, which stays visible. Audius songs play as audio. Both share one
  queue, shuffle, repeat and seek.
- **Search** across both catalogs: songs (All / Audius), artists, albums and playlists.
- **Song, album and artist pages:**
  - Release dates, genres and an artist's newest releases first.
  - "Listen on Apple Music" links.
  - Headers tinted with colour from the artwork.
- **Synced lyrics** from LRCLIB. Click a line to jump to it.
- **Artist bios and "Fans also like"** from Last.fm (optional key).
- **Your Library**, saved in this browser:
  - Liked songs.
  - Saved albums, playlists and artists, including followed mainstream artists.
  - Your own playlists (create, rename, reorder, delete).
- **Works on phones:** bottom tabs, a mini player, a full-screen Now playing view and a small
  floating video for YouTube songs.
- **Keyboard shortcuts:** Space play/pause · ←/→ seek 5 s · Shift+←/→ previous/next ·
  M mute · `/` search.

## Getting started

```bash
npm install
cp src/environments/environment.local.example.ts src/environments/environment.local.ts
cp server/.env.example server/.env
npm start
```

`npm start` runs two things together:

- **The music relay**, a small Node server on port 4400.
- **The app**, at `http://localhost:4300/`. Open this one.

The relay fetches the Apple charts (they can't be loaded directly in the browser), finds the
YouTube video for a song, and keeps your YouTube key off the web page. After changing anything
in `server/`, restart `npm start`.

- **Last.fm (optional):** add a free key to `src/environments/environment.local.ts` as
  `lastFmApiKey` (create one at https://www.last.fm/api/account/create). Without it, artist bios,
  similar artists and the global chart stay hidden.

## YouTube setup

Mainstream songs play through YouTube, which needs a free **YouTube Data API key**:

1. Go to https://console.cloud.google.com and create a project (any name).
2. Open **APIs & Services → Library**, search for **YouTube Data API v3**, and click **Enable**.
3. Open **APIs & Services → Credentials → Create credentials → API key**.
4. Click **Restrict key**, and under *API restrictions* allow only **YouTube Data API v3**.
5. Put the key in `server/.env`: `YOUTUBE_API_KEY=your-key`. This file is git-ignored.
6. Restart `npm start`. The sidebar footer then says "Mainstream songs play via YouTube".

Without a key, everything else works, but mainstream songs can't play. Their play button is
disabled, and the sidebar says "YouTube playback isn't set up".

**Daily limit.** YouTube allows **100 searches a day** for free. The relay remembers every match
in `server/data/youtube-cache.json`:

- **Repeat plays are free.** Playing a song again, by anyone using this relay, needs no search.
- **About 100 new songs a day.** Only the first play of each song uses a search.
- **When the limit runs out,** the app says so and already-matched songs keep playing.
- **Browsing is free.** Searching or opening pages never uses this limit.

**What doesn't work, by design (YouTube's rules):**

- YouTube songs stop when the tab is hidden or a phone screen is off. Audius songs keep playing.
- The video is always visible while it plays, and it's never covered.
- No downloads.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Relay + dev server with live reload |
| `npm test` | App unit tests (Karma + Jasmine). Use `npx ng test --watch=false --browsers=ChromeHeadless` for a single run |
| `npm run test:relay` | Relay tests (Node's built-in test runner) |
| `npm run build` | Production build to `dist/` |

## How it's put together

- `server/`: the music relay (plain Node, no dependencies). It serves `/api/charts`,
  `/api/youtube/match` and `/api/health`.
- `src/app/core`: models and API clients that turn each service's response into the app's own
  `Track`, `Artist`, `Album` and `Playlist` types. The services are Audius, iTunes Search, the
  relay, LRCLIB and Last.fm.
- `src/app/state`: signal-based services.
  - `PlayerService`: the queue. It picks an engine for each song: `AudioEngine` for Audius,
    `YouTubeEngine` for mainstream songs.
  - `VideoDockService`: decides when the video can be seen.
  - `LibraryService`, `LyricsService`, and smaller services for layout, toasts and shortcuts.
- `src/app/layout`: the app shell (navbar, sidebar, player bar, mini player, right panel, tab bar,
  video dock).
- `src/app/pages`: routed pages. `src/app/shared`: reusable components and utilities.
- Design docs: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Credits

- Charts from [Apple Music](https://music.apple.com); song, album and artist details from the
  iTunes Search API.
- Mainstream playback through [YouTube](https://www.youtube.com)'s embedded player.
- Independent music from [Audius](https://audius.co).
- Lyrics from [LRCLIB](https://lrclib.net); artist bios from [Last.fm](https://www.last.fm).

This is a non-commercial hobby project and is not affiliated with Spotify, Apple or YouTube.
