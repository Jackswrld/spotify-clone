# Design: Turn the Spotify-style clone into a working music app (Audius-first)

Date: 2026-11-23
Status: Draft, awaiting approval

## Intent

The project started as a static Angular copy of Spotify's layout. It now becomes a real
music app. Anyone who opens the site can find a song, press play and hear the full track.
When they click into a song they see real information about it, fetched live from outside
sources. The look stays inspired by Spotify (dark, three-panel layout, bottom player bar)
and adds patterns current music apps use.

The first milestone is simple to state: **I can open the site and listen to music.**
Everything else in this doc supports that or makes it richer.

## Goals

1. Full-length playback in the browser for anyone, with no login.
2. Real content on every screen; the hard-coded mock data is removed.
3. A song page and the right-hand "Now playing" panel that show more about what's playing:
   artist, genre and mood, plays and likes, description, lyrics, similar artists, and more
   tracks by the same artist.
4. A player that works the way people expect: play/pause, next/previous, seek, volume,
   shuffle, repeat, a queue, and lock-screen and media-key controls.
5. UI improvements drawn from research (see "UI changes").

## Non-goals (this milestone)

- User accounts or "Log in with Audius". The user's library lives in the browser.
- Uploading music, comments, reposts or any other write action.
- Spotify, Deezer or any mainstream catalog. A "connect Spotify" option is a possible
  later project, not part of this one.
- Offline downloads, a PWA install, a native mobile app. (The website itself must work on
  phones; see "Phone and small screens".)
- Syncing the library or your playlists between devices. They live in one browser.
- Our own backend server.

## Anti-goals (this would count as failure even if it technically works)

- Songs that only play 30-second previews.
- Screens that still show fake data next to real data.
- The player losing its place or stopping when the user moves between pages.
- Showing information from another source about the wrong artist. Audius artists often
  share names with famous acts. Showing nothing is better than showing the wrong bio.

## Constraints (from research, Nov 2026)

| Source | Use | Key | Limits | Browser access (CORS) |
|---|---|---|---|---|
| Audius API (`api.audius.co/v1`) | Catalog, search, trending, streaming, artists, playlists | None needed; free key raises limits | Free: 10 requests/s, 500,000/month | Yes |
| LRCLIB (`lrclib.net/api`) | Plain and time-synced lyrics | None | About 45/min per visitor; send an `Lrclib-Client` header to get more | Yes |
| Last.fm (`ws.audioscrobbler.com/2.0`) | Artist bio, tags, similar artists | Free key, visible in the browser | Non-commercial use only | Yes |

- Audius is mostly independent and up-and-coming artists. LRCLIB and Last.fm cover
  well-known music well and small Audius artists poorly. **Audius's own data is the main
  source of song information**, and outside sources only add to it.
- With no backend, the Last.fm key ships in the browser bundle. That is acceptable for a
  non-commercial hobby project, and is noted here as a known trade-off.
- Audius audio is a direct stream URL that a plain HTML `<audio>` element can play. No
  special software kit is needed.
- Attribution: show "Powered by Audius" and link each track to its page on audius.co.
  Credit LRCLIB where lyrics appear, and Last.fm where its bio appears.

## Approaches considered

1. **Audius-first (chosen).** Full songs for anyone, free, no login; independent catalog.
2. **Spotify Web Playback SDK.** The real mainstream catalog, but every listener needs
   Premium, a hobby app is capped at 5 approved users, and since February 2026 many
   endpoints are gone (new releases, top tracks, bulk lookups) and search returns at most
   10 results. This fails "anyone can open it and listen".
3. **Audius plus optional Spotify.** Most coverage, roughly twice the work. Deferred until
   approach 1 works.

Rejected without detailed comparison: Deezer and iTunes give only 30-second previews, and
Deezer's terms limit audio to its own widget. Jamendo is a fine second open catalog, but
its CORS support is unreliable and it is capped at 35,000 requests a month. It could be
added later behind the same interface.

## Architecture

The app stays a single Angular 20 front end with no backend. The decisions below are
mine, made because you left the technical choices to me.

### Layers

```
components / pages            (show data, send user actions to services)
      │
state services (signals)      PlayerService, LibraryService, PanelStateService
      │
data services                 AudiusApi, LyricsApi (LRCLIB), LastFmApi
      │
HttpClient + caching interceptor
```

- **Models.** The app defines its own `Track`, `Artist` and `Playlist` types. Each data
  service converts its API's response into these types, so components never see raw
  Audius or Last.fm shapes.
- **AudiusApi.** Search (tracks, artists, playlists), trending tracks (optionally by
  genre), trending playlists, a single track, an artist, an artist's tracks, a playlist and
  its tracks, and the stream URL for a track. Every request sends `app_name`. Builder: check
  each endpoint and the stream URL against docs.audius.co before relying on it.
- **LyricsApi.** Calls LRCLIB `GET /api/get` with artist, title and duration. It turns the
  LRC text into lines of `{ time, text }`. A 404 means "no lyrics" and is not an error. On a
  429 it obeys `Retry-After`.
- **LastFmApi.** `artist.getInfo` and `artist.getSimilar`. If no key is configured, every
  call returns nothing and the matching UI sections are hidden.
- **Caching.** Results are cached in memory per URL for the session (a few minutes for
  trending). This keeps the app inside its rate limits when users move back and forth.
- **Configuration.** `src/environments/` holds `audiusAppName`, an optional
  `audiusApiKey`, an optional `lastFmApiKey`, and `lrclibClient`. A git-ignored
  `environment.local.ts` holds real keys, and the committed files hold placeholders.

### PlayerService (the core of the app)

- It owns a single `HTMLAudioElement` that is never destroyed, so playback continues across
  route changes.
- It exposes state as signals: `currentTrack`, `queue`, `currentIndex`, `isPlaying`,
  `currentTime`, `duration`, `volume`, `isMuted`, `shuffle`, `repeat` (`off`, `all` or
  `one`), `isBuffering` and `error`.
- Actions: `playTracks(tracks, startIndex)` replaces the queue and plays, `playNext`,
  `addToQueue`, `toggle`, `next`, `previous`, `seek`, `setVolume`, `toggleMute`,
  `toggleShuffle`, `cycleRepeat`, `removeFromQueue` and `moveInQueue`.
- Previous: if more than 3 seconds have played, it restarts the track; otherwise it goes
  back one track.
- When a track ends it follows the repeat mode. When the queue runs out with repeat off,
  it stops.
- If a stream fails, it shows a short message and skips to the next track. It never retries
  forever.
- **Media Session API:** title, artist, artwork, play/pause/next/previous/seek handlers and
  position state. This gives lock-screen and media-key control.
- Volume, mute, shuffle and repeat are saved in `localStorage`. The queue and position are
  not restored after a reload (my call: keeps this milestone small).

### LibraryService (local "Your Library")

- Liked tracks and saved playlists or artists are stored in `localStorage`, together with
  the small amount of data needed to show them.
- **Your own playlists (your decision).** People can create, rename and delete their own
  playlists, add any track to one, remove tracks and reorder them. They live in
  `localStorage` (there is no Audius write access). Each track row, the player bar and the
  song page get an "Add to playlist" menu that lists your playlists and has a "New
  playlist" option. The "Create" button in the sidebar makes an empty playlist and opens
  it. Your playlists' covers show the first track's artwork, or the generated gradient
  when a playlist is empty.
- The left sidebar ("Your Library") shows these instead of the mock list. It keeps the
  filter chips (Playlists, Artists, Liked songs). The "All" bug is fixed by including an
  All chip, and clicking the active chip returns to All.
- When the library is empty, the sidebar shows an empty state with a "Find something to
  play" link to Search.

## Screens

| Route | Content |
|---|---|
| `/home` | Greeting (kept; fun facts move to a data file and lose the duplicates). Genre filter chips that re-query trending. Shelves: "Trending this week", "Trending playlists", "Underground trending", "Recently played" (local), "Liked songs" shortcut. Each shelf has its own scroll arrows. |
| `/search` | Search box (the navbar input navigates here). With no query, genre and mood tiles. Typing waits 300 ms, then shows a top result followed by Songs, Artists and Playlists groups. Every song row plays directly. |
| `/track/:id` | A header tinted with colour from the artwork, a big play button, like, and add to queue. Below: description, genre and mood tags, plays, likes and reposts, release date, lyrics (static or synced), "More by this artist", and an "About the artist" card (Audius profile plus Last.fm bio when the name matches), plus a link to audius.co. |
| `/artist/:id` | A tinted header, follower and track counts, play all, popular tracks, playlists, bio, and "Fans also like" (Last.fm similar artists that are searched on Audius; only those found are shown). |
| `/playlist/:id` | An Audius playlist: header, play all and shuffle, and a track list with the current track highlighted. |
| `/my-playlist/:id` | One of your own playlists. The same layout plus an editable name, removing and drag-reordering tracks, and delete. An empty playlist shows "Search for songs to add". |
| `/library` | Full-page view of the local library, with Liked songs as a playlist. |
| `/lyrics` | Full-screen synced lyrics for the current track: the current line is large and bright, other lines are dimmed, the page scrolls automatically, and clicking a line jumps to that time. Falls back to plain lyrics or "No lyrics found". |

Persistent parts of the layout:

- **Player bar.** Wired to PlayerService. Clicking the title opens the song page.
  It adds a buffering state, a seek bar that shows progress while dragging, and buttons for
  lyrics, queue and the right-hand panel. The unused mini-player and fullscreen buttons are
  removed.
- **Right panel.** It switches between "Now playing" and "Queue".
  - Now playing shows real data for the current track: artwork, title, artist, like, a short
    lyrics preview that links to `/lyrics`, about the artist, "Next in queue", and "More by
    this artist". The "Related music videos" section is removed because Audius has no video,
    and the Credits section is replaced by Audius's genre, mood and tag data.
  - Queue shows Now playing and Next up, lets the user drag to reorder and remove items,
    and has a clear button.
- **Navbar.** Back and forward use browser history. Home and the search box both work.

## UI changes from research

1. **Colour from artwork.** Take the main colour from the artwork using a small canvas
   sample at load time, cached per track. Use it as a darkened gradient at the top of the
   track, artist and playlist pages and the lyrics page. Darken it enough that white text
   stays readable. If the image's server blocks reading its pixels (CORS), use the default
   colour.
2. **Synced lyrics** that you can click to jump to a line.
3. **A real queue** with drag-to-reorder (Angular CDK drag-drop).
4. **Search with browse tiles** and grouped results.
5. **Lock-screen and media-key controls** (Media Session API) plus keyboard shortcuts:
   Space play/pause, Shift+←/→ previous/next, ←/→ seek 5 s, M mute, `/` focus search.
   Shortcuts are ignored while the user is typing in a field.
6. **Loading and empty states.** Skeleton placeholders while data loads, and a short
   friendly message plus a retry button when a request fails.
7. **Placeholder cover art.** When a track has no artwork, show a gradient generated from
   its title, so the same track always looks the same.

## Phone and small screens (your decision: the layout must work on phones)

Built in from the first step. The layout grid has three size ranges:

- **Desktop (≥ 1024px):** left library sidebar, main view and right panel, with the full
  player bar along the bottom.
- **Tablet (768–1023px):** the sidebar is collapsed to icons by default. The right panel
  opens as a drawer over the main view instead of taking up a column.
- **Phone (< 768px):**
  - One column. The left sidebar is replaced by a bottom tab bar (Home, Search, Your
    Library), and Your Library becomes the `/library` page.
  - The player bar becomes a mini player above the tab bar: artwork, title and artist,
    play/pause, and a thin progress line. It has no seek bar or volume, and volume is left
    to the device.
  - Tapping the mini player opens a full-screen Now playing view: large artwork, the
    artwork-colour background, a seek bar, all controls, and buttons for lyrics and the
    queue. The Now playing panel's sections sit below the controls.
  - Lyrics and the queue open as full-screen views. Menus such as "Add to playlist" open as
    bottom sheets.
  - All tap targets are at least 44px. Shelves scroll sideways with touch, and their arrow
    buttons are hidden.
- Manual check at 375px, 768px and 1280px widths before the milestone is done.

## Code clean-up included

These come from the earlier review and are needed for the new work anyway:

- Use one Angular style throughout: `@if`/`@for`, `input()`/`output()`, signals, `inject()`,
  and no `standalone: true`.
- Move colours into CSS custom properties in `styles.scss`. Put shared button, section and
  card styles in shared partials.
- Make the layout a CSS grid (navbar / body / player rows), so the player bar is no longer
  `position: fixed` with a hard-coded 98px padding.
- Use real `<button>` elements for clickable cards, and labels that reflect state
  ("Play" or "Pause").
- Rename components consistently (`HomePage`, `LibrarySidebar` and so on).
- Fix the stale `app.spec.ts`.

## Testing

- Unit tests:
  - Response conversion in each data service (using recorded sample responses).
  - The LRC parser.
  - PlayerService queue logic: next, previous, shuffle, repeat modes, end of queue,
    reordering and removing.
  - LibraryService saving and loading.
  - The colour-darkening helper.
- Component tests for the player bar (it reflects state, and clicks call the service) and
  the lyrics view (active line and click to seek).
- No tests call the real APIs. One manual check in the browser before calling the
  milestone done: search → play → skip → seek → open the song page → lyrics → queue
  reorder → reload keeps likes.

## Calls made after review

- **Matching artists across sources (my call).** Last.fm bio, tags and "Fans also like"
  appear only when the Audius artist is **verified** and the names match exactly, ignoring
  case. For any other artist, only Audius's own profile data is shown. For "Fans also like",
  a Last.fm name is shown only if the Audius search result for it is a verified account
  with exactly that name. Otherwise that name is dropped.
- **Tracks that can't play in full (my call).** Tracks that are gated (`stream_conditions`
  is set), not streamable, or delisted are filtered out of every list before they reach
  the UI. If a shelf ends up empty, it is hidden. The `Track` model carries no "preview
  only" state.
- **Where it runs (my call).** This milestone runs locally with `ng serve`. The Audius
  `app_name` is not secret and is committed. The Last.fm key goes in the git-ignored
  `environment.local.ts`, and without it the Last.fm sections are hidden. Hosting, and the
  page-refresh fallback that deep links like `/track/:id` need on a host, are a later step.

## Left to the builder

- Exact Audius endpoint paths and query parameters, and which trending endpoints exist
  (for example, the underground trending feed). Verify against docs.audius.co, and drop a
  shelf whose endpoint doesn't exist.
- Choice of artwork size (Audius returns several).
- Skeleton and empty-state visuals, which should match the existing dark style.
- Whether to use Angular CDK for drag-drop or a hand-written version. CDK is preferred.

## Build order (for the plan)

1. Groundwork: config, models, AudiusApi with caching, layout grid, CSS tokens.
2. PlayerService, then the wired player bar and Media Session. **This is milestone 1: music
   plays.**
3. Home with real shelves, and Search.
4. Track, artist and playlist pages; LibraryService, your own playlists, "Add to
   playlist", and the sidebar.
5. Right panel with real data, the queue view and drag-drop.
6. LRCLIB lyrics, the panel preview and the full-screen lyrics view.
7. Last.fm enrichment, colour from artwork, keyboard shortcuts, loading and empty states.
8. Clean-up and tests throughout, then the manual browser check.
