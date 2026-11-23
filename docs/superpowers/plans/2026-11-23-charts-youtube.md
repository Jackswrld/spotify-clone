# Charts + YouTube Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mainstream music to the app. Home shows real current charts (Apple, Last.fm). Search and pages cover mainstream songs, artists and albums (iTunes Search, Last.fm). Pressing play plays the full official song through YouTube's official embedded player, which is always visible. A small local relay server keeps the YouTube key secret and caches song→video matches.

**Architecture:**
- A plain Node 22 ESM relay in `server/` (no dependencies). It serves `/api/charts`, `/api/youtube/match` and `/api/health`, and the Angular dev server forwards `/api/*` to it.
- In the app, `PlayerService` keeps the queue logic and delegates sound to one of two engines behind an `Engine` interface: `AudioEngine` (today's `<audio>` code) and `YouTubeEngine` (a `YT.Player`).
- A single fixed-position `VideoDock` holds the YouTube iframe. It follows whichever "video slot" is on screen, or floats in a corner.

**Tech Stack:** Angular 20 (signals, `input()`/`output()`, `@if`/`@for`), RxJS, Karma/Jasmine, Node 22 `node:http` + `node --test`, YouTube IFrame Player API, YouTube Data API v3, iTunes Search API, Apple marketing RSS, Last.fm.

**Spec:** `docs/superpowers/specs/2026-11-23-charts-youtube-design.md`. Read it, including "Calls made after review", before any task. It builds on `docs/superpowers/specs/2026-11-23-audius-music-app-design.md` and the code on `main`.

## Global Constraints

- Never extract, download or separate YouTube audio. Never hide, shrink below **200×200 px**, overlay or background-play the YouTube player. Keep YouTube branding and ads untouched.
- The YouTube player must not be playing unless it is visible. Visible means all of these:
  - `document.visibilityState === 'visible'`;
  - the dock element is at least 200×200;
  - the phone floating card hasn't been closed.
  Otherwise it loads paused and shows the toast `Tap play to keep listening — this song plays via YouTube`. A blocked autoplay is a pause, never an error.
- The YouTube API key lives only in `server/.env` (git-ignored). Nothing under `src/` contains it.
- `search.list` runs only when a catalog song becomes current, there's no cached match, and the relay is asked. No look-ahead. Browsing never calls YouTube.
- Matching rejects low-confidence videos (score < 3). A "no match" result is cached for 7 days; a quota result is never cached.
- Never use iTunes or Apple 30-second previews.
- Never use Deezer.
- Only resolved catalog items (with an Apple ID) can be liked, added to playlists, saved or followed.
- **Catalog IDs:**
  - Tracks: `Track.id = 'apple:' + trackId` and `Track.appleId = String(trackId)`.
  - Artists: `Artist.id = 'apple:' + artistId`.
  - Albums: `Album.id = 'apple:' + collectionId`.
- Old saved items without `source` read as `source: 'audius'`.
- Routes: `/song/:appleId`, `/album/:appleId` and `/catalog-artist/:appleId`. Existing Audius routes are unchanged.
- **Attribution:**
  - `Charts from Apple Music` on chart shelves.
  - `Listen on Apple Music` (link) on catalog pages.
  - `Plays via YouTube` plus a link to the video on the song page once a match is known.
  - Existing LRCLIB, Last.fm and Audius credits stay.
- **Exact toast texts:**
  - `Couldn't find "<title>" on YouTube.`
  - `YouTube's daily search limit is used up; try again tomorrow.`
  - `Can't reach the music server.`
  - `Couldn't find this on Apple Music`
- Relay port `4400`; dev app port `4300` (4200 is used by another local process).
- Colours only via the CSS custom properties in `src/styles.scss`. Angular conventions as on `main`: no `CommonModule`, no `standalone: true`, every `@for` has a `track`.
- Tests never call real APIs: Karma uses `HttpTestingController` and fakes, the relay uses an injected fake `fetch`.
- Work on branch `feat/charts-youtube` and never commit to `main`.

## Review Focus

1. **The tab is hidden while an Audius song ends and the next song is a YouTube song.** It must load paused with the toast, and must not start playing off screen. Covered by a test in Task 5.
2. **The relay is down or misconfigured** (not running, no key). Charts show Retry, catalog songs show a disabled play button or the "Can't reach the music server." toast, and Audius keeps working. Covered by tests in Tasks 4 and 6.
3. **The same song played twice.** The second play must not hit `search.list` (served from the relay cache), and a "no match" must not be retried for 7 days. Covered by a test in Task 4.
4. **Switching engines quickly** (next from Audius to YouTube and back, fast). The engine that's being left must be paused and unloaded, and its late events must be ignored, so a stale `ended`/`error` from the old engine can't skip the new song. Covered by a test in Task 5.
5. **Old saved data from before this change** (likes, playlists, recents and followed artists without `source`). It must read as Audius and keep working; catalog links must not break Audius ones. Covered by a test in Task 2.

---

## File Structure

```
server/
  index.mjs                 starts http server on PORT (reads server/.env via process.loadEnvFile)
  relay.mjs                 createRelay({ fetch, env, now, cacheFile }) → (req, res) handler; routing, CORS, rate limit
  charts.mjs                Apple chart fetch + 1 h memory cache + country allow-list
  youtube.mjs               normalise(), score(), matchSong(), JSON-file cache
  .env.example              YOUTUBE_API_KEY= / PORT=4400
  test/charts.test.mjs, test/youtube.test.mjs, test/relay.test.mjs
scripts/dev.mjs             spawns relay + ng serve, forwards Ctrl+C
proxy.conf.json             /api → http://localhost:4400
src/app/
  core/models.ts            + TrackSource, source/appleId fields, Album
  core/links.ts             trackLink, artistLink, playlistLink (source-aware)
  core/api/catalog-api.ts   iTunes Search/Lookup → models
  core/api/charts-api.ts    relay charts → models
  core/api/youtube-match-api.ts
  core/api/relay-status.ts  RelayStatusService (health)
  state/engines/engine.ts   Engine interface + EngineEvent
  state/engines/audio-engine.ts
  state/engines/youtube-engine.ts
  state/engines/youtube-loader.ts   loads iframe_api once
  state/video-dock.service.ts       slot registration + visibility
  layout/video-dock/video-dock.ts   the single fixed iframe host (+ floating card)
  shared/video-slot/video-slot.ts   placeholder that a page puts where the video should appear
  shared/country-picker/country-picker.ts
  pages/song/, pages/album/, pages/catalog-artist/
```

Run tests:
- App: `npx ng test --watch=false --browsers=ChromeHeadless` (add `--include=<path>` to narrow).
- Relay: `node --test server/test/`.

---

### Task 1: Relay server (charts + health), dev proxy, one start command

**Files:**
- Create: `server/index.mjs`, `server/relay.mjs`, `server/charts.mjs`, `server/.env.example`, `server/test/charts.test.mjs`, `server/test/relay.test.mjs`, `scripts/dev.mjs`, `proxy.conf.json`
- Modify:
  - `package.json` scripts: `"start": "node scripts/dev.mjs"`, `"relay": "node server/index.mjs"`, `"test:relay": "node --test server/test/"`, `"ng:serve": "ng serve --port 4300"`.
  - `angular.json` (`serve.options.proxyConfig: "proxy.conf.json"`).
  - `.gitignore` (`/server/.env`, `/server/data/`).
  - `.claude/launch.json` (git-ignored; point it at `npm start`).

**Interfaces:**
- Produces:
  - `createRelay({ fetch, env, now = Date.now, cacheFile }): (req, res) => void`.
  - Routes:
    - `GET /api/health` → `{ ok: true, youtubeKey: boolean }`.
    - `GET /api/charts/:country/:kind/:limit` → the Apple feed JSON unchanged.
      - `kind ∈ {songs, albums}`, `limit ∈ {10, 25, 50, 100}`, `country ∈ ALLOWED_COUNTRIES`.
      - Anything else → `400 { error: 'bad_request' }`.
      - Upstream failure → `502 { error: 'upstream' }`.
    - Unknown routes → `404`.
  - CORS: `Access-Control-Allow-Origin` echoes the request origin only for `http://localhost:4300`.
  - `charts.mjs`:
    - `ALLOWED_COUNTRIES`: an array of 30 ISO codes including `us gb ng gh za ke ca au de fr jp br in mx es it nl se kr ie nz ph sg ae tr pl pt be dk no`.
    - `fetchChart({ fetch, now }, country, kind, limit)`, with a 1-hour memory cache keyed by its arguments.

- [ ] **Step 1: Create the branch** with `git switch -c feat/charts-youtube`.

- [ ] **Step 2: Write failing relay tests** (`node:test` + `node:assert/strict`). Each test builds the handler with a fake `fetch` and calls it through `http.createServer(handler).listen(0)`:

```js
test('health reports whether a YouTube key is set', async () => { /* env {} → youtubeKey:false; env {YOUTUBE_API_KEY:'k'} → true */ });
test('charts proxies the Apple feed and caches for an hour', async () => {
  // fake fetch returns {feed:{results:[...]}} and counts calls
  // GET /api/charts/us/songs/25 twice → 1 upstream call, upstream URL
  //   === 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/songs.json'
  // advance now by 3600_001 ms → second upstream call
});
test('charts rejects unknown country, kind or limit with 400', ...); // /api/charts/xx/songs/25, /api/charts/us/videos/25, /api/charts/us/songs/7
test('charts maps upstream failure to 502', ...);
test('CORS only for the dev origin', ...); // Origin http://localhost:4300 echoed; Origin http://evil.test → no ACAO header
test('unknown route is 404', ...);
```

- [ ] **Step 3: Run them and see them fail**

Run: `node --test server/test/`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement** `charts.mjs`, `relay.mjs` and `index.mjs`.
  - `index.mjs` calls `process.loadEnvFile('server/.env')` inside try/catch (the file is optional), then `http.createServer(createRelay({ fetch: globalThis.fetch, env: process.env, cacheFile: 'server/data/youtube-cache.json' })).listen(env.PORT ?? 4400)`, and logs `relay on :4400 (YouTube key: yes/no)`.
  - `scripts/dev.mjs` spawns `node server/index.mjs` and `npx ng serve --port 4300` with `stdio: 'inherit'` and `shell: true` on win32, and kills both on exit or SIGINT.
  - `proxy.conf.json`: `{ "/api": { "target": "http://localhost:4400", "secure": false } }`.

- [ ] **Step 5: Run the relay tests.** Run `node --test server/test/`. Expected: pass.

- [ ] **Step 6: Check by hand**

Run `npm start`, then in another shell `curl http://localhost:4300/api/charts/us/songs/10`.
Expected: Apple JSON with 10 results, coming through the Angular proxy. Also check `curl http://localhost:4300/api/health`.

- [ ] **Step 7: Commit** with `git commit -m "feat(relay): charts and health routes, dev proxy, single start command"`. Check that `server/.env` is not staged.

---

### Task 2: Models, source-aware links, CatalogApi, ChartsApi, reading old data

**Files:**
- Modify:
  - `src/app/core/models.ts`.
  - `src/app/core/api/audius-mappers.ts`: set `source: 'audius'`, `appleId: null`.
  - `src/app/state/safe-storage.ts`: `getArray` gets an optional `upgrade` callback.
  - `src/app/state/library.service.ts` and `src/app/state/player.service.ts`: read through `upgradeSource`.
  - `src/app/core/testing/make-track.ts`: add `source: 'audius'`, `appleId: null`.
  - Every file listed by `grep -rln "'/track'\|'/artist'" src/app` (12 files): use the link helpers.
- Create: `src/app/core/links.ts`, `src/app/core/api/catalog-api.ts`, `src/app/core/api/charts-api.ts`, `src/app/core/testing/catalog-fixtures.ts`
- Test: `src/app/core/links.spec.ts`, `src/app/core/api/catalog-api.spec.ts`, `src/app/core/api/charts-api.spec.ts`, plus additions to `library.service.spec.ts` and `player.service.spec.ts`

**Interfaces:**
- Produces:
  - `type TrackSource = 'audius' | 'catalog'`.
  - `Track` gains `source: TrackSource` and `appleId: string | null`, plus optional `albumId: string | null` and `albumName: string | null`.
  - `Artist` gains `source: TrackSource`. `Playlist` gains `source: 'audius'`.
  - `Album { id: string; appleId: string; name: string; artistName: string; artistId: string; artwork: Artwork; releaseDate: string | null; trackCount: number; genre: string | null; appleUrl: string }`.
  - `Track` and `Artist` also gain an optional `appleUrl: string | null`.
  - `upgradeSource<T extends { source?: TrackSource }>(item: T): T & { source: TrackSource }` turns a missing `source` into `'audius'`.
  - Link helpers in `links.ts`:
    - `trackLink(t: Track): unknown[]` → `['/song', t.appleId]` for catalog songs, otherwise `['/track', t.id]`.
    - `artistLink(t: Track | Artist): unknown[]` → `['/catalog-artist', id without 'apple:']` for catalog, otherwise `['/artist', id]`.
    - `albumLink(a: Album): unknown[]`.
  - `CatalogApi` (root). It uses `https://itunes.apple.com` with `country` from a `CATALOG_COUNTRY` signal (default `'us'`; Task 7 wires it to the picker).
    - Search, each with `media=music`:
      - `searchSongs(q, limit=20)` (`entity=song`).
      - `searchArtists(q, limit=10)` (`entity=musicArtist`).
      - `searchAlbums(q, limit=10)` (`entity=album`).
    - `song(appleId): Observable<Track>` (`/lookup?id=`).
    - `album(appleId): Observable<{ album: Album; tracks: Track[] }>` (`/lookup?id=&entity=song`; result 0 is the collection).
    - `artist(appleId): Observable<Artist>`.
    - `artistAlbums(appleId, limit=20): Observable<Album[]>` (`entity=album&sort=recent`; drop result 0, sort by `releaseDate` descending).
    - `artistTopSongs(appleId, limit=10): Observable<Track[]>` (`entity=song`).
    - `findSong(artist, title): Observable<Track | null>`: the exact-match rule from spec call 2.
    - `findArtist(name): Observable<Artist | null>`: exact name, ignoring case.
  - Artwork: `artworkUrl100` → `small` = 100, `medium` = the same URL with `100x100bb` replaced by `300x300bb`, `large` = `600x600bb`.
  - Duration is `trackTimeMillis / 1000`. If it's missing, the duration is 0.
  - `ChartsApi` (root):
    - `topSongs(country, limit=25): Observable<Track[]>` (relay `/api/charts/:c/songs/:n`). Maps `id` → `appleId`, `artworkUrl100`, `releaseDate`, `genres[0].name` and `url` → `appleUrl`, with `duration: 0`.
    - `topAlbums(country, limit=25): Observable<Album[]>`.

- [ ] **Step 1: Write failing tests**

```ts
// links.spec.ts
it('routes catalog and audius items differently', () => {
  expect(trackLink(makeTrack('1'))).toEqual(['/track', '1']);
  expect(trackLink(makeTrack('apple:55', { source: 'catalog', appleId: '55' }))).toEqual(['/song', '55']);
  expect(artistLink(makeTrack('x', { source: 'catalog', artistId: 'apple:9' }))).toEqual(['/catalog-artist', '9']);
});
// catalog-api.spec.ts (HttpTestingController, fixtures recorded from real responses)
it('searchSongs maps iTunes results to catalog tracks with 600px art and seconds');
it('album() splits the collection from its tracks');
it('artistAlbums drops the artist row and sorts newest first');
it('findSong picks the exact artist+title match ignoring case and "feat." and returns null otherwise');
it('uses the country signal in requests');
// charts-api.spec.ts
it('topSongs calls the relay and maps the Apple feed'); // expectOne('/api/charts/us/songs/25')
// library.service.spec.ts / player.service.spec.ts  (Review Focus 5)
it('reads saved items without source as audius', () => {
  localStorage.setItem('library.liked', JSON.stringify([{ ...makeTrack('1'), source: undefined }]));
  expect(fresh().likedTracks()[0].source).toBe('audius');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/**/*.spec.ts --include=src/app/state/library.service.spec.ts --include=src/app/state/player.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the models, links, both APIs and the upgrade-on-read. Then replace every hard-coded `['/track', …]` / `['/artist', …]` in the 12 files with the link helpers. Audius-only pages (the Audius artist and playlist pages) may keep their own links.

- [ ] **Step 4: Run the full app suite.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: everything passes, including the 203 existing tests.

- [ ] **Step 5: Commit** with `git commit -m "feat: catalog models, source-aware links, iTunes and chart clients"`

---

### Task 3: Engine interface and AudioEngine (refactor, no behaviour change)

**Files:**
- Create: `src/app/state/engines/engine.ts`, `src/app/state/engines/audio-engine.ts`
- Modify: `src/app/state/player.service.ts`
- Test: `src/app/state/engines/audio-engine.spec.ts`; the existing `player.service.spec.ts` must stay green **unchanged**

**Interfaces:**
- Produces:

```ts
export type EngineEvent =
  | { type: 'playing' } | { type: 'paused' } | { type: 'waiting' } | { type: 'canplay' }
  | { type: 'time'; time: number; duration: number }
  | { type: 'ended' }
  | { type: 'error'; kind: 'stream' | 'no-match' | 'quota' | 'offline' }
  | { type: 'blocked' };                       // autoplay refused: treat as paused, never an error
export interface Engine {
  readonly source: TrackSource;
  readonly events: Observable<EngineEvent>;
  load(track: Track, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  unload(): void;                              // stop, release media, emit nothing afterwards
  hasFailed(): boolean;                        // replaces the audio.error check in toggle()
}
```

- `AudioEngine` takes an `HTMLAudioElement` and a `streamUrl(id)` function in its constructor and maps the element's events onto `EngineEvent`. Its `play()` handles the promise rejections:
  - `AbortError` → nothing.
  - `NotAllowedError` → `blocked`.
  - Anything else → `paused`.
- `PlayerService` keeps `protected createAudio()`, and builds `new AudioEngine(this.createAudio(), id => api.streamUrl(id))` in its constructor, so the existing `TestPlayer` override keeps working.
- New: `protected engineFor(source: TrackSource): Engine` returns the audio engine for now. Task 5 adds YouTube.
- Every engine event is handled with a **generation guard**: `PlayerService` increments `loadGeneration` in `load()`, and subscribes per load with `takeWhile(() => gen === this.loadGeneration)`.

- [ ] **Step 1: Write failing `audio-engine.spec.ts`**, using the `FakeAudio` from `player.service.spec.ts`, moved into `src/app/state/testing/fake-audio.ts` and imported by both specs:

```ts
it('maps element events to engine events');            // playing/pause/waiting/canplay/timeupdate/ended/error
it('NotAllowedError from play() emits blocked, AbortError emits nothing');
it('unload pauses, clears src and emits nothing afterwards');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/state/engines/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `AudioEngine`, and move `PlayerService` onto it. `blocked` → `isPlaying=false` with no message (same as today's `NotAllowedError`).

- [ ] **Step 4: Run the full app suite.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`
Expected: all pass, with `player.service.spec.ts` untouched except for the moved `FakeAudio` import.

- [ ] **Step 5: Commit** with `git commit -m "refactor: playback behind an Engine interface (AudioEngine)"`

---

### Task 4: Relay YouTube matching, YouTubeMatchApi, RelayStatusService

**Files:**
- Create: `server/youtube.mjs`, `server/test/youtube.test.mjs`, `src/app/core/api/youtube-match-api.ts`, `src/app/core/api/relay-status.ts`
- Modify: `server/relay.mjs` (route + rate limit)
- Test: `server/test/youtube.test.mjs`, `server/test/relay.test.mjs` (additions), `src/app/core/api/youtube-match-api.spec.ts`, `src/app/core/api/relay-status.spec.ts`

**Interfaces:**
- Produces (relay):
  - `normalise(s): string`: lower case, NFD with accents removed, `\s*[\(\[].*?[\)\]]` removed, ` (feat|ft)\.? .*$` removed, non-alphanumerics → space, spaces collapsed, trimmed.
  - `score(candidate: { title, channelTitle, durationS }, song: { artist, title, durationS })`: the scoring rule from the spec, character for character.
    - Penalty words: `cover live remix sped up slowed 8d karaoke lyrics`. There's no penalty if the normalised song title contains that word.
  - `matchSong({ fetch, key, cache, now }, { artist, title, durationS })` → `{ videoId, title, channel, confidence }` or `{ videoId: null, reason: 'no-match' | 'quota' | 'no-key' }`.
  - Cache: `{ [normalise(artist)+'|'+normalise(title)]: { videoId: string | null, at: number } }`. A `null` entry expires after 7 days. The file is written with `fs.writeFileSync` after each change, and loaded at start (a missing or corrupt file means an empty cache).
  - Route `GET /api/youtube/match?artist=&title=&duration=`:
    - Missing artist or title → 400.
    - More than 30 requests a minute per IP → `429 { error: 'rate_limited' }`.
    - `no-key` → `200 { videoId: null, reason: 'no-key' }`.
  - YouTube URLs:
    - `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=5&q=<artist title official audio>&key=`
    - `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status&id=<ids>&key=`
    - Parse the ISO-8601 duration (`PT3M21S`) in `youtube.mjs`.
    - Keep only `status.embeddable === true`, with duration < 900 s and within ±15 s when the song's duration is above 0.
  - A `403` with `reason quotaExceeded` (either call) → `{ videoId: null, reason: 'quota' }`, not cached.
- Produces (app):
  - `YouTubeMatchApi.match(track: Track): Observable<MatchResult>`, where `type MatchResult = { videoId: string; title: string; channel: string } | { videoId: null; reason: 'no-match' | 'quota' | 'no-key' | 'offline' }`.
    - An HTTP status of 0 or 5xx → `{ videoId: null, reason: 'offline' }`.
    - Results are cached in memory by `track.id` for the session.
  - `RelayStatusService`: `status: Signal<'unknown' | 'ok' | 'down'>` and `youtubeReady: Signal<boolean>`, filled from `/api/health` at app start and on `recheck()`.

- [ ] **Step 1: Write failing relay tests**

```js
test('normalise strips accents, brackets and feat', () => {
  assert.equal(normalise('Béyoncé'), 'beyonce');
  assert.equal(normalise('Calm Down (feat. Selena Gomez) [Remix]'), 'calm down');
});
test('official Topic channel beats a cover', () => {
  const song = { artist: 'Rema', title: 'Calm Down', durationS: 239 };
  assert.ok(score({ title: 'Calm Down', channelTitle: 'Rema - Topic', durationS: 240 }, song) >= 3);
  assert.ok(score({ title: 'Calm Down (cover)', channelTitle: 'Some Singer', durationS: 238 }, song) < 3);
});
test('a song whose title contains "Live" is not penalised for it');
test('duration outside ±15 s is filtered out');
test('second request for the same song uses the cache (no search call)'); // Review Focus 3
test('no-match is cached for 7 days, then searched again');
test('quotaExceeded returns reason quota and is not cached');
test('missing key returns no-key without calling YouTube');
test('match route rate-limits after 30 requests a minute');
```

- [ ] **Step 2: Write failing app tests** (`youtube-match-api.spec.ts`, `relay-status.spec.ts`):

```ts
it('calls /api/youtube/match with artist, cleaned title and rounded duration');
it('maps network failure to reason offline');                              // Review Focus 2
it('caches the result per track id for the session');
it('RelayStatusService reports down when /api/health fails and youtubeReady from the body');
```

- [ ] **Step 3: Run both suites and see them fail.**

Run: `node --test server/test/` and `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/api/*.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Implement.** `YouTubeMatchApi` sends the title through the existing `lyricsTitle(track)` (move it to `src/app/core/title.ts` and keep re-exporting it from `lyrics.service.ts`).

- [ ] **Step 5: Run both suites.** Same commands. Expected: pass.

- [ ] **Step 6: Commit** with `git commit -m "feat: YouTube match route with cache and quota handling; app match and relay-status clients"`

---

### Task 5: YouTubeEngine, video dock service, engine switching in PlayerService

**Files:**
- Create: `src/app/state/engines/youtube-loader.ts`, `src/app/state/engines/youtube-engine.ts`, `src/app/state/video-dock.service.ts`, `src/app/state/testing/fake-yt.ts`
- Modify: `src/app/state/player.service.ts`
- Test: `src/app/state/engines/youtube-engine.spec.ts`, `src/app/state/video-dock.service.spec.ts`, additions to `player.service.spec.ts`

**Interfaces:**
- Consumes: `Engine`/`EngineEvent` (Task 3), `YouTubeMatchApi` (Task 4), `CatalogApi.song` (duration lookup, Task 2).
- Produces:
  - `loadYouTubeApi(): Promise<typeof YT>`. It injects `https://www.youtube.com/iframe_api` once and resolves on `onYouTubeIframeAPIReady`. It goes behind an injection token `YT_LOADER` so tests can supply a fake.
  - `VideoDockService` (root):
    - `host: HTMLElement`: a single `<div>` created once and appended to `document.body`; the YT iframe lives inside it.
    - `registerSlot(el: HTMLElement, priority: number): () => void`. The highest-priority slot that is connected and at least 200×200 is "active".
    - `activeRect: Signal<DOMRect | null>`.
    - `floatingClosed: WritableSignal<boolean>`.
    - `canShow: Signal<boolean>` = page visible && (active slot ‖ floating card allowed && !floatingClosed).
    - `visibilityState`: from `document.visibilitychange`, injected via the `DOCUMENT` token so tests can fake it.
  - `YouTubeEngine implements Engine` (`source = 'catalog'`):
    - `load(track, autoplay)`:
      1. If the duration is 0 and there's an `appleId`, run `CatalogApi.song` once.
      2. Run `YouTubeMatchApi.match`.
      3. On `videoId`: `player.loadVideoById` if autoplay, else `cueVideoById`.
      4. On `null`: emit `error` with kind `no-match` | `quota` | `offline` (`no-key` → `offline`).
    - It polls `getCurrentTime()`/`getDuration()` every 250 ms only while in the PLAYING state.
    - State mapping: PLAYING → `playing`, PAUSED → `paused`, BUFFERING → `waiting`, ENDED → `ended`, CUED → `paused`.
    - Player `onError`:
      - 100, 101, 150 → `error` with kind `stream`, plus a call to the relay to drop the cached match. The relay gets `DELETE /api/youtube/match?artist=&title=`; add that route and a test for it in this task.
      - 2, 5 → `stream`.
    - If `playVideo()` doesn't reach PLAYING within 1500 ms after a user-less start → `blocked`.
  - `PlayerService` changes:
    - `protected createYouTubeEngine(): Engine` (overridable in tests).
    - `load()` picks `engineFor(track.source)`, calls `unload()` on the other engine, bumps `loadGeneration`, and calls `engine.load(track, autoplay)`.
    - **Autoplay rule:** if `track.source === 'catalog' && !dock.canShow()`, then autoplay is false, `isPlaying` is false, and the toast text is set through a new `notice: Signal<string | null>`. This is separate from `error`, so it doesn't count toward the cap.
    - **Error mapping:**
      - `no-match` → the error message `Couldn't find "<title>" on YouTube.`, counted, then skip.
      - `quota` → the `YouTube's daily search limit is used up; try again tomorrow.` message, then `stop()` (no skip, not counted).
      - `offline` → the `Can't reach the music server.` message, then `stop()`.
    - `toggle()` uses `engine.hasFailed()` instead of `audio.error`.
    - Media Session handlers stay. `play` respects `dock.canShow()` for catalog songs.
    - **Resume rule** (spec call 1): `PlayerService` keeps `wantsPlay`, which is true after a user `toggle()` / `playTracks()` / `playAt()` and false after a user pause.
      - When `dock.canShow()` turns false while a catalog song is playing, it pauses. The page being hidden counts.
      - When `canShow()` turns true again and `wantsPlay` is still true, it resumes.
      - Test: `it('pauses when the page hides and resumes on return only if the user still wanted it playing')`.

- [ ] **Step 1: Write failing tests**, using `FakeYTPlayer` in `fake-yt.ts`. It records calls, exposes `fireState(n)` and `fireError(code)`, and has controllable `getCurrentTime`.

```ts
// youtube-engine.spec.ts
it('cues instead of loading when autoplay is false');
it('maps player states and polls time only while playing');
it('error 150 emits stream error and asks the relay to forget the match');
it('no match / quota / offline become the matching error kinds');
it('looks up duration via CatalogApi when the track has none');
// video-dock.service.spec.ts
it('active slot is the highest priority slot at least 200x200');
it('canShow is false when the page is hidden or the floating card is closed with no slot');
// player.service.spec.ts (FakeEngine for both sources via createYouTubeEngine override)
it('switches engines by source and unloads the other one');
it('ignores late events from the previous engine after a switch');          // Review Focus 4
it('loads a catalog song paused with a notice when the dock cannot show');   // Review Focus 1
it('quota stops without skipping; no-match skips and counts toward the cap');
it('blocked is a pause, not an error');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/state/**/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Add the relay DELETE route and its test, then run `node --test server/test/`.

- [ ] **Step 4: Run the full app suite and the relay suite.** Expected: all pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: YouTube engine, video dock visibility, engine switching"`

---

### Task 6: Video dock UI across layouts

**Files:**
- Create: `src/app/layout/video-dock/video-dock.ts`, `src/app/shared/video-slot/video-slot.ts`
- Modify: `src/app/app.ts`/`app.html` (render `<app-video-dock />` once), `src/app/layout/right-panel/now-playing-view.html` (slot instead of the cover when the current song is catalog), `src/app/layout/now-playing-sheet/now-playing-sheet.html` (same), `src/app/app.ts` (show `player.notice()` through `ToastService`), `src/app/layout/player-bar/player-bar.html` (disable play for catalog songs when `!relayStatus.youtubeReady()`, with the tooltip `YouTube playback isn't set up`)
- Test: `src/app/layout/video-dock/video-dock.spec.ts`, `src/app/shared/video-slot/video-slot.spec.ts`

**Interfaces:**
- `<app-video-slot [priority]="number">` is an empty box (`aspect-ratio: 1; min-width: 200px`). It calls `registerSlot` on init and unregisters on destroy. Priorities: right panel = 2, phone sheet = 3.
- `<app-video-dock>`:
  - Hidden (`display: none`, player paused by `PlayerService`) unless the current song is catalog.
  - With an active slot: the host is fixed-positioned exactly over the slot's rect, updated with a `ResizeObserver`, on `scroll` (capture) and on `resize`.
  - With no slot:
    - Desktop/tablet: a floating card, 240×240, bottom-right above the player bar, with two buttons **outside** the video area (in a 32px header strip above it): "Open now playing" and "Move to other corner" (cycles corners).
    - Phone: a 200×200 card above the mini player, with a header strip holding a close button. Close sets `floatingClosed` and pauses.
  - Nothing is ever placed over the iframe area.
  - Opening the phone sheet or the panel resets `floatingClosed` to false.

- [ ] **Step 1: Write failing tests**

```ts
it('positions the host over the active slot rect');
it('shows the floating card when no slot is active and never sizes it below 200x200');
it('phone close button pauses and hides the card');
it('header buttons are outside the video area (no element overlaps the iframe rect)');
it('hides entirely while an audius song is current');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/layout/video-dock/*.spec.ts --include=src/app/shared/video-slot/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** and wire the dock into the app.

- [ ] **Step 4: Run the full suite.** Expected: pass.

- [ ] **Step 5: Manual check (needs a real key in `server/.env`)**

Run `npm start`, then open `/song/<appleId>` for any song from `curl localhost:4300/api/charts/us/songs/10` (Home charts arrive in Task 7).
- Without a key: the play button is disabled with the tooltip `YouTube playback isn't set up`.
- With a key at 1280px: pressing play shows the video in the panel, closing the panel moves it to the floating card, and nothing covers the player.
- At 375px: the card is above the mini player and × pauses.

Write down what you checked.

- [ ] **Step 6: Commit** with `git commit -m "feat: video dock in panel, sheet and floating card"`

---

### Task 7: Home charts with country picker; Search across both catalogs

**Files:**
- Create: `src/app/shared/country-picker/country-picker.ts`
- Modify: `src/app/pages/home/home.ts|html|scss`, `src/app/core/api/lastfm-api.ts` (`topTracks`), `src/app/pages/search/search.ts|html`, `src/app/core/api/catalog-api.ts` (`CATALOG_COUNTRY` fed by the picker)
- Test: `src/app/shared/country-picker/country-picker.spec.ts`, additions to `home.spec.ts`, `search.spec.ts`, `lastfm-api.spec.ts`

**Interfaces:**
- `CountryService` (root, in `country-picker.ts`):
  - `country: Signal<string>`: from `localStorage['catalog.country']`, else the region from `navigator.language` if it's in the allowed list, else `'us'`.
  - `set(c)`.
  - The `CATALOG_COUNTRY` token resolves to `country`.
  - The picker is a `<select>` labelled "Country", with names from `new Intl.DisplayNames([navigator.language], { type: 'region' })`.
- `LastFmApi.topTracks(limit = 25): Observable<{ name: string; artist: string; image: string | null }[]>` (`method=chart.gettoptracks`). Returns `[]` with no key.
- Home order:
  1. Greeting and fact.
  2. Country picker.
  3. Quick tiles (top 6 chart songs, plus Liked songs as today).
  4. "Top songs in <Country>" (Apple 25, subtitle `Charts from Apple Music`).
  5. "Top albums in <Country>" (Apple 25).
  6. "Global top songs" (Last.fm, only when it has entries; clicking resolves through `CatalogApi.findSong` per spec call 2, and shows `Couldn't find this on Apple Music` on null).
  7. A heading "Independent on Audius" with the existing genre chips and Audius shelves, then Recently played.
- Search:
  - Songs gets the tabs `All` | `Audius`. "All" = iTunes songs then Audius songs, de-duplicated by `normalise(artist)+'|'+normalise(title)` (copy `normalise` into `src/app/core/title.ts`).
  - Artists: iTunes then Audius.
  - Albums: iTunes.
  - Playlists: Audius.
  - The error state appears only if **every** request fails.
  - Top result: an exact-name artist from either catalog (iTunes first), else the first song.

- [ ] **Step 1: Write failing tests**

```ts
it('country defaults from navigator.language region when allowed, else us, and persists');
it('home requests charts for the selected country and re-requests on change');
it('global shelf hidden without Last.fm entries; clicking resolves via findSong and plays');
it('global shelf click with no Apple match shows the toast and does nothing');
it('search All merges catalog then audius songs without duplicates');
it('search error only when every request fails');
it('lastfm topTracks maps names and returns [] without a key');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/home/*.spec.ts --include=src/app/pages/search/*.spec.ts --include=src/app/shared/country-picker/*.spec.ts --include=src/app/core/api/lastfm-api.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the full suite.** Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: chart shelves with country picker and two-catalog search"`

---

### Task 8: Catalog song and album pages

**Files:**
- Create: `src/app/pages/song/song.ts|html|scss`, `src/app/pages/album/album.ts|html|scss`
- Modify: `src/app/app.routes.ts`, `src/app/state/library.service.ts` (saved albums)
- Test: `src/app/pages/song/song.spec.ts`, `src/app/pages/album/album.spec.ts`, additions to `library.service.spec.ts`

**Interfaces:**
- `LibraryService` gains `savedAlbums: Signal<Album[]>` (key `library.savedAlbums`, read through `getArray`), `isAlbumSaved(id)` and `toggleAlbumSave(a: Album)`.
- Song page (`/song/:appleId`):
  - Layout and partials reused from the Audius track page.
  - Header: artwork (large), `Song`, title, the artist (`artistLink`), the album link, year, genre, length.
  - Actions: play/pause (plays `[song, ...moreByArtist]`), like, menu, `Listen on Apple Music` (`appleUrl`).
  - Sections:
    - Lyrics: the existing live or static logic.
    - About the artist: Last.fm via `LastfmAbout` with the catalog rule below.
    - More by the artist: `artistTopSongs` without this song.
    - The note `Plays via YouTube` with a link `https://www.youtube.com/watch?v=<id>`, shown once `YouTubeMatchApi` has a cached result for this song. Use only that cache; the page must not trigger a search.
  - Errors: a 404 or empty lookup → `This song isn't available.`; network → Retry.
- Album page (`/album/:appleId`): header (art, `Album`/`Single`, name, artist link, year, track count), play, shuffle-play, Save (`toggleAlbumSave`), `Listen on Apple Music`, and the track rows.
- The `LastfmAbout` / `ArtistEnrichmentService.infoFor(artist)` rule: when `artist.source === 'catalog'`, skip the `verified` check and keep the exact-name check. Add a test.

- [ ] **Step 1: Write failing tests**

```ts
it('song page shows header fields, Apple link and plays [song, ...more]');
it('song page shows "Plays via YouTube" only when a cached match exists and never triggers matching');
it('song page network error shows Retry; missing song shows not available');
it('album page lists tracks, save toggles savedAlbums, shuffle-play enables shuffle');
it('enrichment skips the verified rule for catalog artists but keeps exact name');
it('savedAlbums persists and ignores malformed entries');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/song/*.spec.ts --include=src/app/pages/album/*.spec.ts --include=src/app/state/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** and add the routes.

- [ ] **Step 4: Run the full suite.** Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: catalog song and album pages, saved albums"`

---

### Task 9: Catalog artist page, library entries, panel and sheet support

**Files:**
- Create: `src/app/pages/catalog-artist/catalog-artist.ts|html|scss`
- Modify: `src/app/app.routes.ts`, `src/app/shared/library-list/library-list.ts` (catalog artists and saved albums), `src/app/layout/right-panel/now-playing-view.ts|html` (catalog artist card + more by), `src/app/shared/lastfm-about/lastfm-about.ts` (similar-artist cards resolve through `CatalogApi.findArtist` on click)
- Test: `src/app/pages/catalog-artist/catalog-artist.spec.ts`, additions to `library-sidebar.spec.ts` and `now-playing-view.spec.ts`

**Interfaces:**
- Catalog artist page (`/catalog-artist/:appleId`):
  - Header: Last.fm image if available, else the newest album art, plus the name.
  - Play (top songs) and Follow (`toggleArtistSave` with `source: 'catalog'`).
  - "Latest releases": an album shelf from `artistAlbums`, newest first, with the release date as subtitle.
  - "Top songs" (10 rows).
  - "About" and "Fans also like" via `LastfmAbout [showSimilar]=true`. Clicking a similar artist runs `findArtist`; on a hit, navigate to `/catalog-artist/<id>`; on null, show the `Couldn't find this on Apple Music` toast.
  - `Listen on Apple Music`.
- Library list items:
  - Catalog artists link to `/catalog-artist/:id`.
  - Saved albums appear under "Playlists" with the subtitle `Album • <artist>` and link to `/album/:id`.
- Now playing view: for catalog songs, the artist card comes from `CatalogApi.artist` (no follower count, so the line is hidden) plus Last.fm, and "More by" comes from `artistTopSongs`.

- [ ] **Step 1: Write failing tests**

```ts
it('catalog artist page shows latest releases newest first and top songs');
it('follow saves a catalog artist that the library links to /catalog-artist/:id');
it('similar artist click resolves via findArtist and navigates, or toasts on miss');
it('library list shows saved albums under Playlists with "Album • artist"');
it('now playing view uses catalog sources for a catalog song');
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/catalog-artist/*.spec.ts --include=src/app/layout/**/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** and add the route.

- [ ] **Step 4: Run the full suite.** Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: catalog artist page, library entries, now-playing catalog support"`

---

### Task 10: Status messages, attribution, README, full check

**Files:**
- Modify: `src/app/layout/library-sidebar/library-sidebar.ts` (footer text from `RelayStatusService`), `README.md`, `server/.env.example`
- Test: addition to `library-sidebar.spec.ts`

**Behaviour:**
- Sidebar footer: `Powered by Audius · Mainstream songs play via YouTube`. When `!youtubeReady()` it reads `YouTube playback isn't set up`, linking to the README section `#youtube-setup`.
- Chart shelves: if the relay status is `down`, the error message reads `Can't reach the music server.` with Retry, which calls `relayStatus.recheck()` and then the shelf's retry.
- README:
  - A "YouTube setup" section (`#youtube-setup`): Google Cloud project → enable YouTube Data API v3 → create an API key → restrict it to the YouTube Data API → put it in `server/.env` → restart `npm start`.
  - The limit maths: about 100 new songs a day; repeat plays are free.
  - What doesn't work: lock-screen playback of YouTube songs, and no downloads.
  - Credits: Apple Music charts, iTunes Search, YouTube.

- [ ] **Step 1: Write a failing test** for the footer text in both states. Run `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/layout/library-sidebar/*.spec.ts`. Expected: FAIL.

- [ ] **Step 2: Implement**, then run the full app suite, `node --test server/test/` and `npx ng build`. Expected: all pass, and the build has no errors or warnings.

- [ ] **Step 3: Manual check** with `npm start` at 1280px and 375px (use your own browser tab, not the user's):
  1. Home shows top songs and albums for the country, and changing the country reloads them.
  2. Play a chart song: the video shows in the panel, it plays, and the time and seek bar work.
  3. Press Next to reach an Audius song: the dock hides and the audio plays.
  4. Play the same chart song again: the relay log shows a cache hit and no search.
  5. Song, album and artist pages load. Follow an artist and save an album, then reload: both are in Your Library.
  6. At 375px: the floating card sits above the mini player, × pauses, and the sheet shows the video in place of the art.
  7. Stop the relay: charts show `Can't reach the music server.`, Audius songs still play, and a catalog song shows the toast.

  Write down each result. Anything not checkable (for example, no key available) gets written down as such.

- [ ] **Step 4: Commit** with `git commit -m "docs: YouTube setup, status messages and attribution"`
