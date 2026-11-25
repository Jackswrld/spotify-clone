# Search Fixes, Real Artists, Lyric Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search shows each song once, the real artist with a real photo, song titles before artists, and songs found by a line of their lyrics. Audius moves out of the mainstream results.

**Architecture:** Two new relay routes keep third-party calls and the Genius token on the server:
- `/api/artist-photo` uses Deezer, which sends no browser CORS header.
- `/api/lyrics/search` uses Genius and then Deezer. Deezer confirms each hit is a real song, which drops books and translation pages.

In the app:
- A shared `dedupeSongs` helper runs inside `CatalogApi`.
- `ArtistPhotoApi` gives catalog artists their photo and fan count.
- The search page becomes Apple-first, with **Independent** (Audius) and **Lyrics** tabs.

**Tech Stack:** Angular 20 (signals, standalone), RxJS, Karma/Jasmine; Node 22 relay (`node:http`, `node --test`).

**Spec:** `docs/superpowers/specs/2026-11-25-search-fixes-design.md`

## Global Constraints

- Secrets only in `server/.env` (`GENIUS_ACCESS_TOKEN`, `YOUTUBE_API_KEY`). Never in the app bundle or git.
- New relay routes go after the existing cross-site check (403) and share the per-IP limit of 30 a minute per route.
- Search never calls YouTube.
- Never show an artist page for the wrong person: showing nothing is better than a namesake.
- Artist filter: Deezer exact-name match (`exactKey`) and at least 1,000 fans. If that leaves no artists, keep Apple's list unfiltered. Sort by fans, at most 6.
- Lyric section appears automatically at 4 or more words.
- Copy:
  - "Couldn't find this song to play"
  - "Lyric search isn't set up"
  - "Songs with these lyrics"
  - "Independent"
  - "Independent artists"
- TDD per task. Explicit-path commits on branch `feat/search-fixes` (cut from `feat/audio-only`), never on `main`. Restart the relay after server changes before any manual check.

## Review Focus

1. **A namesake on Deezer with more fans** (a different "Drake" band): pick the exact-name match with the most fans, and never fall back to a non-exact name.
2. **Featured-artist duplicates** ("Rema & Selena Gomez" vs "Rema" for one song): collapse to one entry. Different songs by the same artist must stay separate, and "(Remix)" must stay separate.
3. **A lyric query with quotes, emoji or more than 200 characters**: the relay answers 400 for over 200 characters, and works for everything else.
4. **Genius or Deezer down, or no token**: the lyrics section shows its message, and the other search results still show.
5. **Typing fast in search**: no lyric request for fewer than 4 words. Only the latest query's lyric results show (switchMap).

---

### Task 1: One copy of each song

**Files:**
- Create: `src/app/core/dedupe-songs.ts`, `src/app/core/dedupe-songs.spec.ts`
- Modify: `src/app/core/api/catalog-api.ts` (`searchSongs`, `artistTopSongs`), `src/app/core/api/catalog-api.spec.ts`

**Interfaces:**
- Produces: `dedupeSongs(tracks: Track[]): Track[]` and `leadArtist(name: string): string`.

- [ ] **Step 1: Write failing tests** in `dedupe-songs.spec.ts`:
  - `leadArtist('Rema & Selena Gomez')` is `'Rema'`. Also `leadArtist('A, B')` is `'A'`, `leadArtist('A feat. B')` is `'A'`, `leadArtist('A x B')` is `'A'`, `leadArtist('Simon & Garfunkel')` is `'Simon'`. That last one is acceptable: it's only used for the key.
  - Five "Calm Down" entries become one:
    - Rema & Selena Gomez, "Calm Down - Single"
    - Rema, "Rave & Roses"
    - Rema, "Rave & Roses Ultra"
    - Rema, "Rave & Roses" (repeated)
    - Rema & Selena Gomez, "Rave & Roses Ultra"

    The kept one is the "- Single" entry. Order is otherwise preserved.
  - "Calm Down (Remix)" by Rema stays separate from "Calm Down".
  - Same title by a different artist (Taylor Swift "Calm Down") stays.
  - Preference: when no "- Single" copy exists, a plain album copy beats `/\b(deluxe|ultra|expanded|edition|remaster(ed)?|anniversary)\b/i` copies.
- [ ] **Step 2: Run** `npx ng test --watch=false --browsers=ChromeHeadless --include src/app/core/dedupe-songs.spec.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** both functions in `src/app/core/dedupe-songs.ts`.
  - Key = `exactKey(leadArtist(t.artistName)) + '|' + exactKey(t.title)`.
  - Rank: single 0, plain 1, edition 2.
  - Keep the best-ranked copy, in the position of the first occurrence.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Catalog test.** In `catalog-api.spec.ts`, `searchSongs` and `artistTopSongs` return deduped lists. Flush two copies of one song and expect one.
  - To keep the result count, request `limit * 2` from iTunes (max 50) and slice to `limit` after deduping.
  - Run: FAIL. Implement. Run: PASS.
- [ ] **Step 6: Commit** `src/app/core/dedupe-songs.ts src/app/core/dedupe-songs.spec.ts src/app/core/api/catalog-api.ts src/app/core/api/catalog-api.spec.ts` with message `fix(search): show each song once across singles, albums and deluxe editions`.

### Task 2: Artist photos (relay + app)

**Files:**
- Create: `server/deezer.mjs`, `server/test/deezer.test.mjs`, `src/app/core/api/artist-photo-api.ts` (+ spec)
- Modify: `server/relay.mjs`, `src/app/pages/catalog-artist/catalog-artist.ts`, `src/app/layout/right-panel/now-playing-view.ts` (catalog artist avatar), `src/app/shared/media-card` usage in search (Task 3 uses it)

**Interfaces:**
- Relay: `GET /api/artist-photo?name=<name>` returns `{ image: string|null, fans: number }`.
  - Bad name (empty `exactKey`, or more than 200 characters): 400.
  - Deezer failure: 502.
- `server/deezer.mjs` exports:
  - `createDeezer({ fetch, now })` returning `{ artistPhoto(name), findTrack(artist, title) }`, with a 24 h in-memory cache.
  - `findTrack` returns `{ cover: string, durationS: number } | null` (used by Task 4).
- App: `ArtistPhotoApi.photoFor(name: string): Observable<{ image: string | null; fans: number }>`.
  - Session memory per `exactKey(name)`.
  - On error it emits `{ image: null, fans: 0 }`.

- [ ] **Step 1: Relay tests** in `server/test/deezer.test.mjs`, with a fake fetch on `https://api.deezer.com/search/artist`:
  - Exact-name match with the most fans wins over a non-exact name with more fans.
  - No exact match gives `{ image: null, fans: 0 }`.
  - The second call for the same name makes no fetch.
  - The route returns 400 for `name=%21%21`, and 403 with `Origin: http://evil.test`.
  - `findTrack`, against `https://api.deezer.com/search?q=artist:"A" track:"T"`, returns the first item whose `exactKey(artist.name)` and `exactKey(title)` match, otherwise null.
- [ ] **Step 2: Run** `npm run test:relay`. Expected: FAIL.
- [ ] **Step 3: Implement** `server/deezer.mjs`. Image = `picture_xl`, fans = `nb_fan`, cover = `album.cover_xl`, durationS = `duration`. Then add the route in `relay.mjs` and rate-limit it like `/api/youtube/match`.
- [ ] **Step 4: Run** `npm run test:relay`. Expected: PASS.
- [ ] **Step 5: App tests:**
  - `artist-photo-api.spec.ts`: one HTTP call per name per session, and the error maps to `{ image: null, fans: 0 }`.
  - `catalog-artist.spec.ts`: the header `img` uses the Deezer image when present, and falls back to the newest release art when `image` is null.
  - `now-playing-view.spec.ts`: a catalog artist's avatar uses the photo.
- [ ] **Step 6: Run** the app suite. Expected: FAIL. Implement. Run: PASS.
- [ ] **Step 7: Commit** the listed files with message `feat: real artist photos from Deezer through the music server`.

### Task 3: Apple-first search, Independent tab, Home rename

**Files:**
- Modify: `src/app/pages/search/search.ts`, `search.html`, `search.spec.ts`, `src/app/pages/home/home.html` (+ spec text)

**Interfaces:**
- Consumes: `ArtistPhotoApi.photoFor` (Task 2) and `dedupeSongs` (Task 1, already applied by `CatalogApi`).
- Produces: `songTab = signal<'all' | 'independent' | 'lyrics'>('all')` (Task 5 fills the lyrics tab).

- [ ] **Step 1: Failing tests** in `search.spec.ts`:
  - **Artists:** Apple artists only, with no Audius artist even if Audius returns "Wizkid". Each artist shows its Deezer photo.
  - **Namesakes dropped:** with Deezer giving Wizkid 1,005,214 fans, Wiz Kid 120, and Wizkid T no match, only Wizkid shows.
  - **Fallback:** if every artist would be dropped, Apple's list shows unfiltered.
  - **Order:** artists are sorted by fans, at most 6.
  - **Top result:**
    - "calm down" → the song "Calm Down" (a title match), even if an artist is named "Calm Down" on Audius.
    - "wizkid" → the artist Wizkid.
    - Never an Audius artist.
  - **Songs:** the songs list on "All" holds catalog songs only. The "Independent" tab button shows Audius songs, and the Audius playlists section shows only on that tab.
  - **Home:** shows the heading "Independent artists", not "Independent on Audius".
- [ ] **Step 2: Run** the search and home specs. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - After `forkJoin`, `switchMap` the Apple artists through `forkJoin(photoFor(...))`, and attach `avatar` (all three sizes = image) and `followerCount` = fans.
  - Remove `allSongs` merging: "All" = catalog songs, "Independent" = Audius songs.
  - Rename the tab label "Audius" to "Independent".
- [ ] **Step 4: Run** the specs. Expected: PASS. Then run the full app suite.
- [ ] **Step 5: Commit** the listed files with message `fix(search): real artists only, song titles find songs, Audius moves to an Independent tab`.

### Task 4: Relay lyric search

**Files:**
- Create: `server/genius.mjs`, `server/test/genius.test.mjs`
- Modify: `server/relay.mjs` (route plus `geniusKey` in `/api/health`), `server/.env.example`, `README.md`

**Interfaces:**
- `GET /api/lyrics/search?q=` returns `{ results: [{ title, artist, image, geniusId, durationS }], reason?: 'no-key' }`.
  - `q` must have `exactKey(q)` non-empty and at most 200 characters; otherwise 400.
  - Genius failure: 502.
- Health becomes `{ ok, youtubeKey, geniusKey }`.

- [ ] **Step 1: Failing tests** with a fake fetch for `https://api.genius.com/search` and Deezer:
  - The Authorization header is `Bearer <token>`.
  - Hits are mapped from `result.title` and `result.primary_artist.name`.
  - A hit with no Deezer track match is dropped (the "Great Expectations" / "Charles Dickens" case).
  - Artists matching `/genius/i` are dropped without a Deezer call.
  - At most 10 results.
  - `image` = Deezer cover, `durationS` from Deezer.
  - Same `q` within 24 h makes no Genius call.
  - No token: `{ results: [], reason: 'no-key' }` and no fetch.
  - `q` over 200 characters: 400.
  - Health reports `geniusKey`.
- [ ] **Step 2: Run** `npm run test:relay`. Expected: FAIL.
- [ ] **Step 3: Implement** `createLyricsSearch({ fetch, token, deezer, now })` in `server/genius.mjs`. Call `deezer.findTrack` for up to 15 hits in parallel, then keep the first 10 confirmed. Add the route.
- [ ] **Step 4: Run** `npm run test:relay`. Expected: PASS.
- [ ] **Step 5: Docs.** Add `GENIUS_ACCESS_TOKEN=` to `server/.env.example`. Add a README section "Lyric search setup" with the genius.com/api-clients steps (create client, Generate Access Token).
- [ ] **Step 6: Commit** the listed files with message `feat(relay): lyric search through Genius, confirmed as real songs on Deezer`.

### Task 5: Lyrics tab and "Songs with these lyrics"

**Files:**
- Create: `src/app/core/api/lyrics-search-api.ts` (+ spec)
- Modify: `src/app/core/api/relay-status.ts` (`geniusReady`), `src/app/core/api/http-cache.interceptor.ts` (never cache `/api/lyrics`), `src/app/pages/search/search.ts`, `search.html`, `search.spec.ts`

**Interfaces:**
- `LyricsSearchApi.search(q: string): Observable<LyricHit[] | 'not-set-up' | 'error'>`, where `LyricHit = { title: string; artist: string; image: string | null; durationS: number }`.
- `RelayStatusService.geniusReady: Signal<boolean>`.

- [ ] **Step 1: Failing tests:**
  - `lyrics-search-api.spec.ts`: maps results; `reason: 'no-key'` → `'not-set-up'`; an HTTP error → `'error'`.
  - `http-cache.interceptor.spec.ts`: `/api/lyrics/search` is not cached.
  - `search.spec.ts`:
    - "dont want me" (3 words) makes no lyric request.
    - "left the party with a girl" (6 words) shows the section "Songs with these lyrics" under Songs, with each hit's title, artist and image.
    - The Lyrics tab shows the same hits for any query of 2 or more characters.
    - Clicking a hit calls `catalog.findSong(artist, title)` and `player.playTracks([song], 0)`.
    - A null result shows the toast "Couldn't find this song to play".
    - `'not-set-up'` shows "Lyric search isn't set up". `'error'` shows ErrorState with Retry, and the other sections still render.
    - A newer query replaces older lyric results.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Use a separate `lyrics` signal fed by its own `switchMap` from the debounced query, so a slow Genius never delays the main results.
- [ ] **Step 4: Run** the full app suite and `npx ng build`. Expected: all pass, build clean.
- [ ] **Step 5: Commit** the listed files with message `feat(search): find songs by a line of their lyrics`.

### Task 6: Manual check

- [ ] Restart the dev server.
- [ ] Search "calm down": the song is first, with one Rema copy.
- [ ] Search "wizkid": the real Wizkid with his photo; opening him shows his albums.
- [ ] Search "left the party with a girl she said she don't want me": lyric hits show, and tapping one plays it audio-only.
- [ ] The Independent tab lists Audius songs.
- [ ] Record the results in the final message.
