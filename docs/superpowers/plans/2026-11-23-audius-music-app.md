# Audius Music App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static Spotify-style Angular clone into a working music app. It streams full tracks from Audius, shows real song and artist information, keeps a local library and local playlists, and works on desktop, tablet and phone.

**Architecture:** A single Angular 20 app with no backend. Data services call Audius, LRCLIB and Last.fm and convert their responses into the app's own models. Signal-based state services (`PlayerService`, `LibraryService`, `PanelStateService`, `LayoutService`) sit between the data and the components. One `HTMLAudioElement` owned by `PlayerService` survives route changes.

**Tech Stack:** Angular 20 (standalone, signals, `@if`/`@for`, `input()`/`output()`), `@angular/cdk@^20` (drag-drop), HttpClient with an in-memory cache interceptor, Karma/Jasmine, SCSS with CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-11-23-audius-music-app-design.md`. Read it before starting any task. This plan argues from it.

## Global Constraints

- Full-length playback only. Tracks that are gated, unstreamable, deleted, unlisted or unavailable never reach the UI.
- No fake data on any screen. All mock arrays in the current code are deleted.
- Only one `HTMLAudioElement` exists, owned by `PlayerService`, so playback survives navigation.
- Last.fm bio, tags and similar artists show only when the Audius artist `is_verified` and the names match exactly, ignoring case. Otherwise show nothing from Last.fm.
- Audius base URL is `https://api.audius.co/v1`. Every request sends `app_name`. Responses are wrapped in `{ data: ... }`. Note that `GET /playlists/{id}` returns an **array** of one playlist.
- Stream URL: `${audiusBaseUrl}/tracks/${id}/stream?app_name=${audiusAppName}`. Use it directly as `<audio src>`; it 302-redirects to the content node.
- Attribution: "Powered by Audius" in the sidebar/footer, a link to `https://audius.co${permalink}` on track/artist/playlist pages, "Lyrics from LRCLIB" under lyrics, and "Bio from Last.fm" under a Last.fm bio.
- Liked tracks, saved Audius playlists and artists, your own playlists, recently played, volume, mute, shuffle and repeat persist in `localStorage`. The queue and playback position do not.
- Breakpoints: phone `< 768px`, tablet `768–1023px`, desktop `≥ 1024px`. On phones, tap targets are at least 44px.
- Keyboard shortcuts: Space play/pause; Shift+←/→ previous/next; ←/→ seek 5 s; M mute; `/` focus search. They are ignored while typing in `input`, `textarea`, `select` or `[contenteditable]`.
- Angular style throughout: `@if`/`@for` (every `@for` has a `track`), `input()`/`output()`, `inject()`, signals. Don't write `standalone: true`. Use no `CommonModule` imports.
- Colours come only from CSS custom properties defined in `src/styles.scss` (Task 2). No raw hex values in component SCSS.
- Tests never call real APIs. Use `HttpTestingController` and the recorded fixtures from Task 1.
- Work on branch `feat/audius-music-app` and never commit to `main`.

## Review Focus

1. **Switching tracks quickly** (double-clicking next, clicking several rows fast). `audio.play()` rejects with `AbortError`, and that must not count as a stream error or trigger an auto-skip. Covered by a test in Task 3.
2. **Every track in the queue fails to stream** (network down). The player must stop after 3 consecutive errors, show the error message, and must not loop forever. Covered by a test in Task 3.
3. **`localStorage` is corrupt, full or blocked** (private mode). `LibraryService` and `PlayerService` start with defaults, never throw, and writes fail silently. Covered by tests in Tasks 3 and 8.
4. **Search typed fast** (responses return out of order). Only the latest query's results show. Covered by a test in Task 7.
5. **The track changes while its lyrics or Last.fm request is still in flight.** The old track's lyrics or bio must never appear under the new track. Covered by tests in Tasks 13 and 14.

---

## File Structure

```
src/
  environments/
    environment.ts                 committed; production values; lastFmApiKey ''
    environment.local.example.ts   committed template
    environment.local.ts           git-ignored; used by the development build
  styles.scss                      tokens (CSS custom properties), reset, base
  styles/_ui.scss                  shared mixins: icon-button, pill, section-header, card, follow-button
  app/
    app.ts / app.html / app.scss   shell grid; picks layout by LayoutService.mode()
    app.config.ts / app.routes.ts
    core/
      config.ts                    APP_CONFIG token + AppConfig type
      models.ts                    Track, Artist, Playlist, Artwork, UserPlaylist, LyricLine, Lyrics, ArtistInfo
      api/audius-mappers.ts        toTrack/toArtist/toPlaylist/isPlayable (pure)
      api/audius-api.ts            AudiusApi service
      api/http-cache.interceptor.ts
      api/lrc-parser.ts            parseLrc (pure)
      api/lyrics-api.ts            LyricsApi service
      api/lastfm-api.ts            LastFmApi service
      testing/fixtures.ts          recorded Audius/LRCLIB/Last.fm responses (trimmed)
    state/
      player.service.ts            queue + audio + Media Session
      library.service.ts           likes, saves, local playlists, recents
      panel-state.service.ts       right panel view (replaces the BehaviorSubject version)
      layout.service.ts            breakpoint mode signal
      shortcuts.service.ts         keyboard shortcuts
      safe-storage.ts              try/catch localStorage wrapper
    shared/
      utils/format.ts              formatTime, formatCount
      utils/gradient.ts            gradientFor(seed)
      utils/color.ts               darkenForText, rgbToCss
      utils/artwork-color.ts       ArtworkColorService (canvas sample + cache)
      cover/cover.ts               <app-cover> image or gradient fallback
      track-row/track-row.ts       playable row with like + menu
      media-card/media-card.ts     square card (track/playlist/artist)
      shelf/shelf.ts               titled horizontal row with its own arrows
      add-to-playlist/add-to-playlist.ts  menu (desktop) / bottom sheet (phone)
      state-views/skeleton.ts, state-views/error-state.ts
    layout/
      navbar/navbar.ts             back/forward, home, search box
      library-sidebar/library-sidebar.ts
      tab-bar/tab-bar.ts           phone bottom tabs
      player-bar/player-bar.ts     desktop/tablet full bar
      mini-player/mini-player.ts   phone
      now-playing-sheet/now-playing-sheet.ts  phone full-screen player
      right-panel/right-panel.ts, right-panel/now-playing-view.ts, right-panel/queue-view.ts
    pages/
      home/, search/, track/, artist/, playlist/, my-playlist/, library/, lyrics/
```

Deleted by the end: `src/app/home/`, `src/app/library/`, `src/app/navbar/`, `src/app/components/`, `src/app/services/panel-state.service.ts`, `plan-spotifyClone.prompt.prompt.md`.

Run tests with `npx ng test --watch=false --browsers=ChromeHeadless`. Add `--include=<spec path>` to run a single file.

---

### Task 1: Groundwork — config, models, Audius data layer

**Files:**
- Create: `src/environments/environment.ts`, `src/environments/environment.local.example.ts`, `src/environments/environment.local.ts`
- Create: `src/app/core/config.ts`, `src/app/core/models.ts`, `src/app/core/api/audius-mappers.ts`, `src/app/core/api/audius-api.ts`, `src/app/core/api/http-cache.interceptor.ts`, `src/app/core/testing/fixtures.ts`
- Test: `src/app/core/api/audius-mappers.spec.ts`, `src/app/core/api/audius-api.spec.ts`, `src/app/core/api/http-cache.interceptor.spec.ts`
- Modify: `.gitignore`, `angular.json` (development `fileReplacements`; `anyComponentStyle` budget to warning `6kB` / error `10kB`), `src/app/app.config.ts`, `package.json` (add `@angular/cdk@^20`)

**Interfaces:**
- Produces:
  - `AppConfig { audiusBaseUrl: string; audiusAppName: string; audiusApiKey: string; lastFmApiKey: string; lrclibClient: string }` and `APP_CONFIG: InjectionToken<AppConfig>`, provided from `environment`.
  - `Artwork { small: string | null; medium: string | null; large: string | null }`, mapped from 150x150, 480x480 and 1000x1000.
  - `Track { id; title; artistId; artistName; artistHandle; artistVerified: boolean; duration: number; artwork: Artwork; genre: string|null; mood: string|null; tags: string[]; description: string|null; playCount; likeCount; repostCount; releaseDate: string|null; permalink: string }`
  - `Artist { id; name; handle; verified: boolean; followerCount; trackCount; playlistCount; bio: string|null; avatar: Artwork; coverPhoto: string|null; permalink: string }` (`permalink` = `'/' + handle`)
  - `Playlist { id; name; description: string|null; isAlbum: boolean; trackCount; artwork: Artwork; ownerId; ownerName; permalink }`
  - `UserPlaylist { id: string; name: string; tracks: Track[]; createdAt: number }`
  - `LyricLine { time: number; text: string }`, `Lyrics { plain: string; lines: LyricLine[]; instrumental: boolean }`
  - `ArtistInfo { bio: string | null; tags: string[]; url: string }`
  - `isPlayable(raw): boolean`, `toTrack(raw): Track`, `toArtist(raw): Artist`, `toPlaylist(raw): Playlist`
  - `AudiusApi` methods, each returning `Observable` with gated tracks already filtered out:
    - `trendingTracks(opts?: { genre?: string; time?: 'week'|'month'|'allTime'; limit?: number }): Observable<Track[]>` → `/tracks/trending`
    - `undergroundTrending(limit?: number): Observable<Track[]>` → `/tracks/trending/underground`
    - `trendingPlaylists(limit?: number): Observable<Playlist[]>` → `/playlists/trending`
    - `searchTracks(q: string, limit?: number): Observable<Track[]>`, `searchArtists(q, limit?): Observable<Artist[]>`, `searchPlaylists(q, limit?): Observable<Playlist[]>` → `/tracks/search`, `/users/search`, `/playlists/search` with `query=`
    - `track(id): Observable<Track>` → `/tracks/{id}`; it errors if the track is not playable
    - `artist(id): Observable<Artist>` → `/users/{id}`
    - `artistTracks(id, opts?: { sort?: 'plays'|'date'; limit?: number }): Observable<Track[]>` → `/users/{id}/tracks`
    - `artistPlaylists(id, limit?): Observable<Playlist[]>` → `/users/{id}/playlists`
    - `playlist(id): Observable<Playlist>` → `/playlists/{id}`, takes `data[0]`
    - `playlistTracks(id): Observable<Track[]>` → `/playlists/{id}/tracks`
    - `streamUrl(trackId: string): string`, built without a network call
  - `httpCacheInterceptor: HttpInterceptorFn`. It caches GET responses by full URL: 3 minutes for URLs containing `/trending`, 10 minutes for everything else. It never caches error responses.

- [ ] **Step 1: Create the branch and install CDK**

Run: `git switch -c feat/audius-music-app` then `npm install @angular/cdk@^20`
Expected: the branch is created and `package.json` lists `@angular/cdk`.

- [ ] **Step 2: Add environments and config**

`environment.ts` values: `audiusBaseUrl: 'https://api.audius.co/v1'`, `audiusAppName: 'audius-music-app-dev'`, `audiusApiKey: ''`, `lastFmApiKey: ''`, `lrclibClient: 'audius-music-app/0.1 (local dev)'`. `environment.local.example.ts` is identical, with a comment saying "copy to environment.local.ts and add your Last.fm key". Copy it to `environment.local.ts`. Add `/src/environments/environment.local.ts` to `.gitignore`. In `angular.json`, give `build.configurations.development` a `fileReplacements` entry that replaces `environment.ts` with `environment.local.ts`.

- [ ] **Step 3: Write recorded fixtures**

`fixtures.ts` exports `RAW_TRACK` (copy the shape of a real `/tracks/trending` item: `id`, `title`, `duration`, `genre`, `mood`, `tags: 'lofi,chill'`, `description`, `artwork` with the three sizes, `is_streamable: true`, `is_stream_gated: false`, `stream_conditions: null`, `is_delete: false`, `is_unlisted: false`, `is_available: true`, `permalink`, `play_count`, `favorite_count`, `repost_count`, `release_date`, and `user` with `id`, `name`, `handle`, `is_verified`, `follower_count`, `track_count`, `playlist_count`, `bio`, `profile_picture`, `cover_photo`). Also export `RAW_GATED_TRACK` (`is_stream_gated: true`, `stream_conditions: { usdc_purchase: {} }`), `RAW_USER` and `RAW_PLAYLIST` (with `playlist_name`, `is_album`, `track_count`, `artwork`, `user`).

- [ ] **Step 4: Write failing mapper tests** in `audius-mappers.spec.ts`

```ts
it('maps a raw track', () => {
  const t = toTrack(RAW_TRACK);
  expect(t.id).toBe(RAW_TRACK.id);
  expect(t.artistName).toBe(RAW_TRACK.user.name);
  expect(t.artwork.medium).toBe(RAW_TRACK.artwork['480x480']);
  expect(t.tags).toEqual(['lofi', 'chill']);
  expect(t.likeCount).toBe(RAW_TRACK.favorite_count);
});
it('maps null tags and missing artwork', () => {
  const t = toTrack({ ...RAW_TRACK, tags: null, artwork: null });
  expect(t.tags).toEqual([]);
  expect(t.artwork).toEqual({ small: null, medium: null, large: null });
});
it('isPlayable rejects gated, unstreamable, deleted, unlisted, unavailable', () => {
  expect(isPlayable(RAW_TRACK)).toBeTrue();
  expect(isPlayable(RAW_GATED_TRACK)).toBeFalse();
  for (const patch of [{ is_streamable: false }, { is_delete: true }, { is_unlisted: true }, { is_available: false }, { stream_conditions: {} }]) {
    expect(isPlayable({ ...RAW_TRACK, ...patch })).withContext(JSON.stringify(patch)).toBeFalse();
  }
});
it('maps artist permalink from handle', () => expect(toArtist(RAW_USER).permalink).toBe('/' + RAW_USER.handle));
```

- [ ] **Step 5: Run and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/api/audius-mappers.spec.ts`
Expected: FAIL, because the mapper functions don't exist yet.

- [ ] **Step 6: Implement the models and mappers.** Split `tags` on commas, trim each tag and drop empty ones.

- [ ] **Step 7: Write failing AudiusApi tests** using `provideHttpClient()` and `provideHttpClientTesting()`, with a test `APP_CONFIG`.

```ts
it('trendingTracks sends app_name and filters gated tracks', () => {
  let out: Track[] = [];
  api.trendingTracks({ genre: 'Electronic' }).subscribe(t => (out = t));
  const req = http.expectOne(r => r.url === `${BASE}/tracks/trending`);
  expect(req.request.params.get('app_name')).toBe('test-app');
  expect(req.request.params.get('genre')).toBe('Electronic');
  req.flush({ data: [RAW_TRACK, RAW_GATED_TRACK] });
  expect(out.length).toBe(1);
});
it('playlist() unwraps the one-element array', () => { /* flush { data: [RAW_PLAYLIST] } → name === RAW_PLAYLIST.playlist_name */ });
it('track() errors for a gated track', () => { /* flush { data: RAW_GATED_TRACK } → error callback called */ });
it('streamUrl builds without a request', () => {
  expect(api.streamUrl('abc')).toBe(`${BASE}/tracks/abc/stream?app_name=test-app`);
  http.expectNone(() => true);
});
it('adds api_key param only when configured', () => { /* config with audiusApiKey 'k' → params.get('api_key') === 'k' */ });
```

- [ ] **Step 8: Run and see them fail.** Run the same command with `--include=src/app/core/api/audius-api.spec.ts`. Expected: FAIL.

- [ ] **Step 9: Implement `AudiusApi`.** Use a private `get<T>(path, params)` helper that adds `app_name` and, when configured, `api_key`, then maps `res.data`. Filter with `isPlayable` before calling `toTrack`.

- [ ] **Step 10: Write the failing interceptor test.** Two identical GETs produce one backend request. After `jasmine.clock().mockDate()` is advanced by 3 min + 1 s, a `/trending` URL is fetched again, while a non-trending URL is still served from cache. An error response is not cached.

- [ ] **Step 11: Implement `httpCacheInterceptor`.** Use a module-level `Map<string, { expires: number; response: HttpResponse<unknown> }>` and export `clearHttpCache()` for tests. Register it in `app.config.ts` with `provideHttpClient(withInterceptors([httpCacheInterceptor]))`, and provide `APP_CONFIG` from `environment`.

- [ ] **Step 12: Run all three specs**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/**/*.spec.ts`
Expected: all pass.

- [ ] **Step 13: Commit.** `git add -A src/environments src/app/core src/app/app.config.ts angular.json package.json package-lock.json .gitignore` then `git commit -m "feat: Audius data layer, models and config"`. Check that `environment.local.ts` is **not** staged.

---

### Task 2: App shell, design tokens and responsive layout

**Files:**
- Modify: `src/styles.scss`, `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`, `src/app/app.routes.ts`, `src/app/app.spec.ts`, `angular.json` (`stylePreprocessorOptions.includePaths: ["src/styles"]`)
- Create: `src/styles/_ui.scss`, `src/app/state/layout.service.ts`, `src/app/state/panel-state.service.ts`, `src/app/layout/tab-bar/tab-bar.ts|html|scss`
- Move and refactor: `src/app/navbar/*` → `src/app/layout/navbar/navbar.ts|html|scss`
- Delete: `src/app/services/panel-state.service.ts`
- Test: `src/app/state/layout.service.spec.ts`, `src/app/state/panel-state.service.spec.ts`, `src/app/app.spec.ts`

**Interfaces:**
- Produces:
  - `LayoutService.mode: Signal<'phone'|'tablet'|'desktop'>`, from `matchMedia('(max-width: 767.98px)')` and `('(max-width: 1023.98px)')`. It updates on `change` events.
  - `PanelStateService.view: Signal<'now-playing'|'queue'|null>`, with `open(view: 'now-playing'|'queue')`, `close()` and `toggle(view)`. `toggle` closes the panel when that view is already open, and otherwise opens it. Initial value: `'now-playing'` on desktop, `null` otherwise. The constructor reads `LayoutService.mode()` once.
  - CSS tokens in `:root`: `--bg: #121212`, `--surface-1: #181818`, `--surface-2: #282828`, `--surface-3: #3e3e3e`, `--text: #fff`, `--text-muted: #b3b3b3`, `--accent: #1db954`, `--accent-hover: #1ed760`, `--danger: #f15e6c`, `--radius-s: 4px`, `--radius-m: 8px`, `--radius-l: 12px`, `--player-h: 90px`, `--tabbar-h: 56px`, `--mini-h: 64px`, `--tap: 44px`.
  - `_ui.scss` mixins: `icon-button($size: 32px)`, `pill($active: false)`, `section-header`, `card`, `follow-button`.
  - Shell regions with stable class names that later tasks place components into: `.shell-nav`, `.shell-sidebar`, `.shell-main` (holds `<router-outlet>`), `.shell-panel`, `.shell-player`, `.shell-tabbar`.
  - Routes, with each page lazy-loaded via `loadComponent`. Until their tasks land, each route points to a placeholder `EmptyPage` component in `app.routes.ts`, replaced later: `''` → redirect to `home`; `home`, `search`, `track/:id`, `artist/:id`, `playlist/:id`, `my-playlist/:id`, `library`, `lyrics`; `**` → redirect to `home`.

- [ ] **Step 1: Write failing tests**

```ts
// layout.service.spec.ts: stub window.matchMedia
it('reports phone below 768px', () => { stubWidth(375); expect(TestBed.inject(LayoutService).mode()).toBe('phone'); });
it('reports tablet at 800px and desktop at 1280px', ...);
it('updates when the media query changes', () => { /* fire the stub's change listener → mode changes */ });
// panel-state.service.spec.ts
it('toggle closes the same view and switches to another', () => {
  s.open('now-playing'); s.toggle('queue'); expect(s.view()).toBe('queue');
  s.toggle('queue'); expect(s.view()).toBeNull();
});
it('starts open on desktop, closed on phone', ...);
// app.spec.ts (replaces the stale test)
it('renders nav, main and player regions', () => {
  /* provideRouter([]), provideHttpClient(), provideHttpClientTesting(); query .shell-nav, .shell-main, .shell-player */
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/state/*.spec.ts --include=src/app/app.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the services, tokens, mixins and shell grid**
  - Desktop grid: `grid-template: "nav nav nav" auto "sidebar main panel" 1fr "player player player" var(--player-h) / auto 1fr auto`, height `100dvh`, gap 8px.
  - Tablet: same areas. The panel is `position: fixed` (right drawer, `top` under the nav, `bottom: var(--player-h)`) and is shown only when `view() !== null`.
  - Phone: `"nav" auto "main" 1fr "mini" var(--mini-h) "tabbar" var(--tabbar-h)`. The sidebar and panel are not rendered.
  - Render regions with `@if (layout.mode() === ...)`, not only CSS, so phone never builds the sidebar.
  - Refactor the navbar: real `<button type="button">` elements for Home, Back and Forward; back and forward use `Location.back()`/`forward()`.
  - The search input navigates to `/search?q=<value>` on input, debounced 300 ms, with `replaceUrl: true`.
  - The search input has `id="global-search"` (used by shortcuts in Task 15).
  - The tab bar has three `routerLink`s (Home `/home`, Search `/search`, Your Library `/library`) with `routerLinkActive`.
  - On phone the navbar shows only the app name and back button. The search box is hidden, because the Search tab has its own input (Task 7).
  - Keep the Font Awesome and DM Sans `<link>`s in `index.html`.

- [ ] **Step 4: Run the tests and the build**

Run the test command from Step 2, then `npx ng build`.
Expected: tests pass, and the build has no errors.

- [ ] **Step 5: Commit** with `git commit -m "feat: responsive app shell, tokens, layout and panel state"`

---

### Task 3: PlayerService (queue, audio, Media Session, persistence)

**Files:**
- Create: `src/app/state/player.service.ts`, `src/app/state/safe-storage.ts`, `src/app/shared/utils/format.ts`
- Test: `src/app/state/player.service.spec.ts`, `src/app/shared/utils/format.spec.ts`

**Interfaces:**
- Consumes: `Track`, `AudiusApi.streamUrl` (Task 1).
- Produces:
  - `safeStorage.get<T>(key: string, fallback: T): T` and `safeStorage.set(key: string, value: unknown): void`. Both wrap `JSON.parse` and `localStorage` access in try/catch. `get` returns `fallback` on any error.
  - `formatTime(seconds: number): string` (`0` → `'0:00'`, `61.9` → `'1:01'`, `3725` → `'1:02:05'`, `NaN`/negative → `'0:00'`), and `formatCount(n: number): string` (`999` → `'999'`, `1500` → `'1.5K'`, `2_300_000` → `'2.3M'`).
  - `PlayerService`, `providedIn: 'root'`:
    - signals (readonly): `queue: Signal<Track[]>`, `index: Signal<number>` (-1 when empty), `current: Signal<Track | null>`, `isPlaying`, `isBuffering`, `time`, `duration`, `volume` (0–1), `muted`, `shuffle: Signal<boolean>`, `repeat: Signal<'off'|'all'|'one'>`, `error: Signal<string | null>`, and `upNext: Signal<Track[]>` (the queue after `index`, in play order)
    - methods: `playTracks(tracks: Track[], startIndex = 0): void`, `playNext(track: Track): void`, `addToQueue(track: Track): void`, `toggle(): void`, `next(): void`, `previous(): void`, `seek(seconds: number): void`, `setVolume(v: number): void`, `toggleMute(): void`, `toggleShuffle(): void`, `cycleRepeat(): void` (off → all → one → off), `removeFromQueue(queueIndex: number): void`, `moveInQueue(from: number, to: number): void`, `clearQueue(): void` (keeps the current track), and `recentlyPlayed: Signal<Track[]>` (most recent first, unique by id, at most 20, persisted)
    - storage keys: `player.settings` → `{ volume, muted, shuffle, repeat }`, and `player.recent` → `Track[]`
  - The audio element is created via a protected `createAudio(): HTMLAudioElement` factory, so tests can substitute a fake.

**Behaviour the tests pin:**
- `previous()`: if `time() > 3`, it seeks to 0. Otherwise it goes to `index - 1`. At index 0 it seeks to 0.
- `next()` at the end of the queue: if repeat is `'all'`, it wraps to 0. Otherwise it stops (`isPlaying` false), the index stays on the last track, and the time resets to 0.
- `ended` event: repeat `'one'` → replay the same track; otherwise `next()`.
- Shuffle: turning it on keeps the current track at its position and randomises only the tracks after it. Turning it off restores the original order of the remaining tracks, with the current track still current. Use an injectable `RANDOM = new InjectionToken<() => number>('RANDOM', { factory: () => Math.random })` so tests are deterministic.
- `error` event on the audio: set `error` to `'Couldn't play "<title>". Skipping.'`, then call `next()`. After 3 consecutive errors without a successful `playing` event, stop and set `error` to `'Playback failed. Check your connection.'`. A `playing` event resets the counter and clears `error`.
- A rejected `audio.play()` promise whose `name === 'AbortError'` is ignored (no error, no skip). `NotAllowedError` sets `isPlaying` false with no error message.
- `moveInQueue` and `removeFromQueue` keep the same track current: `index` is adjusted. Removing the current track plays the next one.
- Media Session (guarded by `'mediaSession' in navigator`): on track change, set `metadata` (title, artist, artwork with the 150 and 480 sizes). Register `play`, `pause`, `previoustrack`, `nexttrack` and `seekto` handlers. Call `setPositionState` on `loadedmetadata` and on seek.

- [ ] **Step 1: Write failing tests** for `format.ts`, using the exact values above.

- [ ] **Step 2: Write failing PlayerService tests** with a `FakeAudio` class (fields `src`, `currentTime`, `duration`, `volume`, `muted`, `paused`; `play()` returning a controllable promise; `pause()`; and `dispatch(type)` to fire events). Provide it via a subclass that overrides `createAudio()`. Required tests:

```ts
it('playTracks sets queue, index and src');
it('previous restarts when more than 3s in');
it('previous goes back when 3s or less in');
it('next at end stops when repeat off, wraps when repeat all');
it('ended with repeat one replays the same track');
it('shuffle keeps current track and restores order when turned off');
it('error skips to next and sets message');
it('stops after 3 consecutive errors with "Playback failed. Check your connection."');
it('AbortError from play() is ignored');                       // Review Focus 1
it('moveInQueue keeps current track current');
it('removeFromQueue of current plays the next track');
it('persists volume/shuffle/repeat and restores them in a new instance');
it('starts with defaults when localStorage holds invalid JSON');  // Review Focus 3
it('starts with defaults when localStorage throws');              // Review Focus 3 (spyOn(Storage.prototype,'getItem').and.throwError('x'))
it('recentlyPlayed is unique, newest first, capped at 20');
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/state/player.service.spec.ts --include=src/app/shared/utils/format.spec.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `safe-storage.ts`, `format.ts` and `PlayerService`.** Keep two arrays: `originalQueue` and the play-order `queue`. Clamp volume to 0–1.

- [ ] **Step 5: Run the tests**

Same command. Expected: all pass.

- [ ] **Step 6: Commit** with `git commit -m "feat: PlayerService with queue, shuffle, repeat, errors and Media Session"`

---

### Task 4: Player UI — player bar, mini player, phone Now playing sheet (Milestone 1: music plays)

**Files:**
- Create: `src/app/state/toast.service.ts`, `src/app/shared/toast/toast.ts`, `src/app/layout/player-bar/player-bar.ts|html|scss`, `src/app/layout/mini-player/mini-player.ts|html|scss`, `src/app/layout/now-playing-sheet/now-playing-sheet.ts|html|scss`, `src/app/shared/utils/gradient.ts`, `src/app/shared/cover/cover.ts|html|scss`
- Modify: `src/app/app.html`, `src/app/app.ts`, and `src/app/pages/home` (temporary: see Step 4)
- Delete: `src/app/components/now-playing-bar/`
- Test: `src/app/layout/player-bar/player-bar.spec.ts`, `src/app/shared/utils/gradient.spec.ts`, `src/app/shared/cover/cover.spec.ts`

**Interfaces:**
- Consumes: `PlayerService` (Task 3), `PanelStateService`, `LayoutService` (Task 2).
- Produces:
  - `gradientFor(seed: string): string`. It is deterministic: the same seed always gives the same `linear-gradient(135deg, hsl(h1 60% 35%), hsl(h2 70% 55%))`, with `h1` taken from a string hash mod 360 and `h2 = (h1 + 40) % 360`.
  - `<app-cover [src]="string|null" [seed]="string" [alt]="string" [round]="boolean">`. It shows `<img loading="lazy">`. When `src` is null or the image fires `error`, it falls back to a `div` with `gradientFor(seed)`.
  - The phone sheet's open state is `sheetOpen = signal(false)` on `App`. Opening it uses `<app-mini-player (open)="sheetOpen.set(true)">`, and the sheet is `<app-now-playing-sheet [open]="sheetOpen()" (close)="sheetOpen.set(false)">`.
  - `ToastService` (`src/app/state/toast.service.ts`, root): `message: Signal<string | null>` and `show(text: string, ms = 4000): void`, where a new message replaces the current one. A single `<app-toast>` is rendered in `app.html`, above the player bar or mini player. `PlayerService.error()` changes are piped to `show` from `App` via an `effect`.

**Behaviour:**
- **Player bar** (desktop/tablet):
  - Left: the cover and title (`routerLink` `/track/:id`), the artist (`routerLink` `/artist/:artistId`), and a like button (wired in Task 8; render it disabled until then).
  - Centre: shuffle, previous, play/pause, next and repeat. The play/pause `aria-label` is `'Pause'` when playing and `'Play'` otherwise. Repeat uses `aria-pressed`, and in `'one'` mode shows a small "1" badge. A spinner shows on the play button while `isBuffering()`.
  - Seek slider: while dragging, it shows the drag value and calls `seek` only on `change`.
  - Right: lyrics (`routerLink` `/lyrics`), a queue button (`panel.toggle('queue')`), a now-playing panel button (`panel.toggle('now-playing')`), mute and volume.
  - When `current()` is null, show an empty bar with the text "Pick something to play".
  - The `error()` text appears through `ToastService`.
- **Mini player** (phone): cover, title and artist, a play/pause button of at least 44px, and a 2px progress line along its top edge. Tapping anywhere except play/pause emits `open`.
- **Now playing sheet** (phone): fixed full-screen. It has a top bar with a collapse chevron, the large cover, title, artist and like button, the seek slider with times, the five transport controls (play at least 64px), and a row of buttons for lyrics, queue (navigates to the queue view in Task 11; until then hidden) and share (`navigator.share` if available, else copies `https://audius.co${permalink}`). The background uses the artwork colour from Task 15; until then it uses `var(--surface-2)`.
- **Temporary Milestone 1 hook:** the existing home route temporarily renders the first 20 `trendingTracks()` as plain buttons that call `playTracks(list, i)`. Task 6 replaces this.

- [ ] **Step 1: Write failing tests**

```ts
// gradient.spec.ts
it('is deterministic and differs by seed', () => {
  expect(gradientFor('abc')).toBe(gradientFor('abc'));
  expect(gradientFor('abc')).not.toBe(gradientFor('abd'));
  expect(gradientFor('abc')).toMatch(/^linear-gradient\(135deg, hsl\(/);
});
// cover.spec.ts
it('falls back to a gradient when src is null');
it('falls back to a gradient after an img error event');
// player-bar.spec.ts (PlayerService stubbed with writable signals and jasmine spies)
it('shows "Pick something to play" when nothing is loaded');
it('play button label reflects state');   // 'Play' → set isPlaying true → 'Pause'
it('clicking next calls player.next()');
it('seek slider only calls seek on change, not on input');
it('queue button toggles the queue panel');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/layout/player-bar/*.spec.ts --include=src/app/shared/**/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the components** and place them in the shell: the player bar in `.shell-player` (desktop/tablet), the mini player above the tab bar and the sheet overlay (phone). Delete the old `now-playing-bar` folder.

- [ ] **Step 4: Add the temporary home trending list** (see Behaviour).

- [ ] **Step 5: Run the tests and the build**

Run the Step 2 command and `npx ng build`. Expected: pass.

- [ ] **Step 6: Manual Milestone 1 check**

Run `npm start` and open `http://localhost:4200`.
- At 1280px: click a track. Audio plays, and the bar shows the title and time.
- Next, previous, seek, volume, shuffle and repeat all work.
- Pressing the keyboard media keys or the OS media overlay controls playback.
- At 375px: the mini player appears, and tapping it opens the sheet.
Expected: all of the above work. Write down anything that fails, and fix it before committing.

- [ ] **Step 7: Commit** with `git commit -m "feat: player bar, mini player and phone now-playing sheet (music plays)"`

---

### Task 5: Shared content components

**Files:**
- Create: `src/app/shared/track-row/track-row.ts|html|scss`, `src/app/shared/media-card/media-card.ts|html|scss`, `src/app/shared/shelf/shelf.ts|html|scss`, `src/app/shared/state-views/skeleton.ts`, `src/app/shared/state-views/error-state.ts`
- Test: `src/app/shared/track-row/track-row.spec.ts`, `src/app/shared/shelf/shelf.spec.ts`

**Interfaces:**
- Consumes: `Track`, `Playlist`, `Artist`, `<app-cover>`, `formatTime`, `PlayerService.current`/`isPlaying`.
- Produces:
  - `<app-track-row [track] [index]="number" [showArtwork]="boolean" [showAlbumArtist]="boolean" (play)="void">`. It is a `<div role="row">` containing a `<button>` for the main play target, the number (replaced by an equaliser icon when it is the current track and playing), the cover, the title (green when current), the artist link, the duration, a like button, and a `⋯` button that emits `menu: output<{ track: Track; anchor: HTMLElement }>()`. Task 9 wires the like button and menu.
  - `<app-media-card [title] [subtitle] [image]="string|null" [seed] [round]="boolean" [link]="any[]" (play)>`. It is a `<a [routerLink]>` card with a separate hover play `<button>` (always visible on touch devices via `@media (hover: none)`). The play button `stopPropagation`s.
  - `<app-shelf [title] [subtitle]="string|null" [loading]="boolean" [error]="string|null" (retry)>` with content projection. Each shelf has its own ← → buttons that scroll **its own** row by 80% of its width (this fixes the old bug). The buttons are hidden on phone (`LayoutService`). While `loading`, it shows 6 skeleton cards. When `error` is set, it shows `<app-error-state>` with a Retry button. The parent passes `count: input.required<number>()`, which is the number of items. The shelf renders nothing when `!loading && !error && count === 0`.
  - `<app-skeleton [shape]="'card'|'row'|'text'" [count]="number">`.
  - `<app-error-state [message] (retry)>`.

- [ ] **Step 1: Write failing tests**

```ts
it('track-row marks the current track and shows equaliser while playing');
it('track-row emits play when the row button is clicked, menu with anchor when ⋯ clicked');
it('shelf arrows scroll only their own row', () => { /* two shelves; spy on each row's scrollBy; click the 2nd shelf's → arrow; only the 2nd spy called */ });
it('shelf shows skeletons when loading and error-state with retry when error');
it('shelf renders nothing when count is 0 and not loading');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/shared/track-row/*.spec.ts --include=src/app/shared/shelf/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the components** using the `_ui.scss` mixins.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: shared track row, media card, shelf, skeleton and error views"`

---

### Task 6: Home page

**Files:**
- Create: `src/app/pages/home/home.ts|html|scss`, `src/app/pages/home/fun-facts.ts`
- Delete: `src/app/home/` (the old page and its mock data)
- Test: `src/app/pages/home/home.spec.ts`

**Interfaces:**
- Consumes: `AudiusApi.trendingTracks`/`undergroundTrending`/`trendingPlaylists`, `PlayerService.playTracks`/`recentlyPlayed`, `Shelf`, `MediaCard`, `TrackRow`.
- Produces: `HomePage`, routed at `home`.

**Behaviour:**
- Greeting: keep the time-of-day rules from the old `home.ts` (5–11 morning, 12–16 afternoon, 17–20 evening, otherwise night) and a random fact. Move the facts to `fun-facts.ts` as `export const FUN_FACTS: readonly string[]`, with duplicates removed and the double space fixed.
- Genre chips: `All`, `Electronic`, `Hip-Hop/Rap`, `Lo-Fi`, `Pop`, `R&B/Soul`, `Alternative`, `House`, `Ambient`. These are the exact Audius genre values. Selecting a chip re-queries only the "Trending this week" shelf with `genre`. `All` sends no genre.
- Shelves, in order:
  1. Quick-play grid: the first 6 of "Trending this week" as compact tiles. On phone it has 2 columns.
  2. "Trending this week": `trendingTracks({ genre, time: 'week', limit: 20 })`, shown as media cards. Clicking play calls `playTracks(list, i)`.
  3. "Trending playlists": `trendingPlaylists(12)`. Clicking a card goes to `/playlist/:id`; the play button loads `playlistTracks(id)` and then calls `playTracks`.
  4. "Underground trending": `undergroundTrending(20)`.
  5. "Recently played": from `recentlyPlayed()`, hidden when empty.
- Each shelf has its own loading and error state and Retry. Use `toSignal` with `catchError` → `{ status: 'error' }` and a retry trigger `signal(0)` per shelf.
- Remove the temporary Task 4 list.

- [ ] **Step 1: Write failing tests**

```ts
it('requests trending with the selected genre and none for All');
it('play on a trending card calls playTracks with the shelf list and index');
it('a failing shelf shows Retry and retry re-requests only that shelf');
it('hides Recently played when empty');
it('FUN_FACTS has no duplicates', () => expect(new Set(FUN_FACTS).size).toBe(FUN_FACTS.length));
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/home/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, wire the lazy route, and delete `src/app/home/`.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: home page with real Audius shelves and genre chips"`

---

### Task 7: Search page

**Files:**
- Create: `src/app/pages/search/search.ts|html|scss`
- Test: `src/app/pages/search/search.spec.ts`

**Interfaces:**
- Consumes: `AudiusApi.searchTracks`/`searchArtists`/`searchPlaylists`, `ActivatedRoute` query param `q` (written by the navbar input from Task 2), `TrackRow`, `MediaCard`.
- Produces: `SearchPage` at `search`. On phone, the page shows its own search input (the navbar search box is hidden on phone) bound to the same `q` param.

**Behaviour:**
- Empty `q`: show a grid of browse tiles, one per genre chip from Task 6 plus moods (`Chill`, `Energizing`, `Romantic`, `Fiery`, `Melancholy`). Each tile has a colour from `gradientFor(name)`. Clicking a tile sets `q` to the name.
- With `q` (trimmed, length ≥ 2):
  - Run the three searches in parallel with `forkJoin`, each with `catchError(() => of([]))`. Chain through `switchMap` from the debounced `q` stream, so older responses are dropped (Review Focus 4).
  - Layout: "Top result" (first artist if its name matches `q` ignoring case, else first track), then "Songs" (first 10 track rows; clicking plays the song list from that index), "Artists" (round cards to `/artist/:id`) and "Playlists".
  - If all three are empty, show `No results for "<q>"`.
  - While loading, show skeleton rows.

- [ ] **Step 1: Write failing tests**

```ts
it('shows browse tiles when q is empty');
it('ignores queries shorter than 2 characters');
it('only renders results for the latest query', fakeAsync(() => {   // Review Focus 4
  setQ('ab'); tick(300); setQ('abc'); tick(300);
  // flush 'abc' responses first, then the stale 'ab' responses
  // expect rendered song titles to be from 'abc' only
}));
it('Top result prefers an exact-name artist');
it('shows the no-results message when everything is empty');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/search/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** Debounce 300 ms inside the page as well, because route params can change without the navbar (for example from browser history).

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: search page with browse tiles and grouped results"`

---

### Task 8: LibraryService (likes, saves, local playlists)

**Files:**
- Create: `src/app/state/library.service.ts`
- Test: `src/app/state/library.service.spec.ts`

**Interfaces:**
- Consumes: `safeStorage` (Task 3), `Track`, `Playlist`, `Artist`, `UserPlaylist`.
- Produces `LibraryService`:
  - signals: `likedTracks: Signal<Track[]>` (newest first), `savedPlaylists: Signal<Playlist[]>`, `savedArtists: Signal<Artist[]>`, `myPlaylists: Signal<UserPlaylist[]>`
  - `isLiked(id: string): boolean`, `toggleLike(track: Track): void`
  - `isPlaylistSaved(id)`, `togglePlaylistSave(p: Playlist)`, `isArtistSaved(id)`, `toggleArtistSave(a: Artist)`
  - `createPlaylist(name?: string): UserPlaylist`. The default name is `My Playlist #<n>`, where n = the count + 1. The id is `crypto.randomUUID()`.
  - `renamePlaylist(id, name)`. It trims the name, ignores an empty one, and limits it to 100 characters.
  - `deletePlaylist(id)`
  - `addToPlaylist(id, track): 'added' | 'duplicate'`. It refuses a duplicate track id.
  - `removeFromPlaylist(id, trackIndex)`, `moveInPlaylist(id, from, to)`
  - `playlistById(id): Signal<UserPlaylist | undefined>`, as a computed signal
  - storage keys: `library.liked`, `library.savedPlaylists`, `library.savedArtists`, `library.myPlaylists`. Each is written when its signal changes.

- [ ] **Step 1: Write failing tests**

```ts
it('toggleLike adds newest-first and removes');
it('createPlaylist names sequentially: "My Playlist #1", "My Playlist #2"');
it('addToPlaylist returns duplicate for the same track id');
it('renamePlaylist ignores blank names and trims to 100 chars');
it('moveInPlaylist and removeFromPlaylist reorder correctly');
it('persists and restores across instances');
it('starts empty when stored JSON is corrupt');                  // Review Focus 3
it('keeps working in memory when setItem throws (quota)');       // Review Focus 3
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/state/library.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: LibraryService with likes, saves and local playlists"`

---

### Task 9: Track actions — like and "Add to playlist" menu

**Files:**
- Create: `src/app/shared/add-to-playlist/add-to-playlist.ts|html|scss`, `src/app/shared/add-to-playlist/track-menu.service.ts`
- Modify: `track-row`, `player-bar`, `now-playing-sheet` (wire the like buttons and menus)
- Test: `src/app/shared/add-to-playlist/add-to-playlist.spec.ts`

**Interfaces:**
- Consumes: `LibraryService`, `PlayerService.playNext`/`addToQueue`, `LayoutService`.
- Produces:
  - `TrackMenuService.open(track: Track, anchor: HTMLElement | null): void` and `close()`, with `state: Signal<{ track: Track; anchor: HTMLElement | null } | null>`. A single `<app-track-menu>` instance is rendered once in `app.html`.
  - Menu items, in order: "Play next", "Add to queue", "Add to playlist ▸" (a sub-list of `myPlaylists()` plus "New playlist"), "Like"/"Remove from Liked songs", "Go to artist", and "Open on Audius" (`https://audius.co${permalink}`, `target="_blank" rel="noopener"`).
  - Desktop/tablet: a popover positioned at `anchor.getBoundingClientRect()`, flipped to stay inside the viewport, closed by Escape or an outside click, with focus returned to the anchor. Phone: a bottom sheet with a backdrop.
  - "New playlist" calls `createPlaylist()` then `addToPlaylist`. Toasts use `ToastService.show` from Task 4: `Added to <name>`, or `Already in <name>` for a duplicate.

- [ ] **Step 1: Write failing tests**

```ts
it('lists my playlists and adds the track to the chosen one with a toast');
it('New playlist creates one and adds the track');
it('duplicate add shows "Already in <name>"');
it('Escape closes and returns focus to the anchor');
it('renders as a bottom sheet on phone');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/shared/add-to-playlist/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, then wire the like buttons (`LibraryService.toggleLike`, `aria-pressed`) and the `⋯` buttons in the track row, player bar and sheet.

- [ ] **Step 4: Run the full test suite.** Run: `npx ng test --watch=false --browsers=ChromeHeadless`. Expected: all pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: like button and add-to-playlist menu"`

---

### Task 10: Track, artist and Audius playlist pages

**Files:**
- Create: `src/app/pages/track/track.ts|html|scss`, `src/app/pages/artist/artist.ts|html|scss`, `src/app/pages/playlist/playlist.ts|html|scss`, `src/app/pages/_page-header.scss` (the shared tinted header used by all three, imported via `@use`)
- Test: `src/app/pages/track/track.spec.ts`, `src/app/pages/artist/artist.spec.ts`, `src/app/pages/playlist/playlist.spec.ts`

**Interfaces:**
- Consumes: `AudiusApi.track`/`artist`/`artistTracks`/`artistPlaylists`/`playlist`/`playlistTracks`, `PlayerService`, `LibraryService`, `TrackMenuService`, `TrackRow`, `Shelf`, `MediaCard`, `formatCount`.
- Produces: `TrackPage`, `ArtistPage`, `PlaylistPage`. Each exposes a protected `headerColor: Signal<string>`, which defaults to `'var(--surface-2)'` and which Task 15 replaces with the artwork colour. Task 13 and Task 14 add sections to `TrackPage` and `ArtistPage` at `<!-- lyrics-slot -->` and `<!-- lastfm-slot -->` markers left in the templates.

**Behaviour:**
- **Track page:**
  - Header: cover, "Song" label, title, artist link, and a line with `formatCount(playCount) plays · <year> · <m:ss>`.
  - Action row: a big play button (plays `[track, ...moreByArtist]` from 0, or pauses if this track is current and playing), like, add-to-playlist (`⋯`), and an "Open on Audius" link.
  - Sections:
    - Description, hidden when null.
    - Tag pills: genre, mood and tags.
    - Stats: likes and reposts.
    - `<!-- lyrics-slot -->`.
    - "About the artist": an Audius profile card with avatar, name, verified tick, followers and bio, plus `<!-- lastfm-slot -->`.
    - "More by <artist>": `artistTracks(artistId, { sort: 'plays', limit: 10 })` excluding this track, shown as track rows.
  - If `track(id)` errors, show `<app-error-state message="This track isn't available.">` with a link home.
- **Artist page:**
  - Header: round avatar or cover photo, verified tick, name, and `formatCount(followerCount) followers`.
  - Actions: "Play" (popular tracks) and a "Follow"/"Following" toggle (`toggleArtistSave`).
  - Sections: "Popular" (top 10 by plays, track rows), "Playlists" (shelf, hidden if empty), "About" (bio), `<!-- lastfm-slot -->`.
- **Playlist page:**
  - Header: cover, "Playlist"/"Album" label, name, owner link, and `<n> songs`.
  - Actions: play, shuffle-play (turns shuffle on, then plays), save (`togglePlaylistSave`), "Open on Audius".
  - The track list uses track rows. The current track is highlighted by the track row itself.
- All three pages: reload data when the route `:id` changes (use `toSignal` over `paramMap` with `switchMap`), and scroll `.shell-main` to the top.

- [ ] **Step 1: Write failing tests**

```ts
it('track page shows title, plays and year from the fixture');
it('track page play button plays [track, ...moreByArtist] and pauses when current');
it('track page shows the unavailable message when the API errors');
it('track page reloads when the route id changes');
it('artist page Follow toggles savedArtists');
it('playlist page shuffle-play enables shuffle then plays');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/pages/track/*.spec.ts --include=src/app/pages/artist/*.spec.ts --include=src/app/pages/playlist/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the three pages and their lazy routes.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: track, artist and playlist pages"`

---

### Task 11: Your Library — sidebar, library page, my-playlist page

**Files:**
- Create: `src/app/layout/library-sidebar/library-sidebar.ts|html|scss`, `src/app/pages/library/library.ts|html|scss`, `src/app/pages/my-playlist/my-playlist.ts|html|scss`
- Delete: `src/app/library/`
- Test: `src/app/layout/library-sidebar/library-sidebar.spec.ts`, `src/app/pages/my-playlist/my-playlist.spec.ts`

**Interfaces:**
- Consumes: `LibraryService`, `PlayerService`, `LayoutService`, `TrackRow`, `CdkDropList` and `CdkDrag` from `@angular/cdk/drag-drop`. The drop handler calls `LibraryService.moveInPlaylist(id, event.previousIndex, event.currentIndex)`.
- Produces: `LibrarySidebar`, `LibraryPage` at `library`, and `MyPlaylistPage` at `my-playlist/:id`.

**Behaviour:**
- **Sidebar** (desktop/tablet):
  - Header: "Your Library", a "Create" button, and a collapse toggle. The collapse state (`'collapsed'|'normal'|'expanded'`) persists in `library.sidebar`, and tablet defaults to `collapsed`.
  - Chips: `All`, `Playlists`, `Artists`, `Liked songs`. Clicking the active chip returns to `All`; this fixes the old bug.
  - Items:
    - "Liked songs" first, with a fixed gradient cover and `<n> songs`, linking to `/library?view=liked`.
    - Your playlists, linking to `/my-playlist/:id`.
    - Saved Audius playlists, linking to `/playlist/:id`.
    - Saved artists (round), linking to `/artist/:id`.
  - When everything is empty, show "Create your first playlist" with a Create button, and "Find something to play" linking to `/search`.
  - Footer: "Powered by Audius", linking to `https://audius.co`.
  - "Create" calls `createPlaylist()` and navigates to `/my-playlist/<id>`.
- **Library page** (used mainly on phone): the same list and chips at full width with a Create button. `?view=liked` shows Liked songs as a track list with Play.
- **My-playlist page:**
  - Header: cover (first track's artwork or `gradientFor(id)`), and a name you can click to edit. Enter or blur saves; Escape cancels.
  - Actions: play, shuffle-play, and delete (confirm with `window.confirm('Delete "<name>"?')`, then navigate to `/library`).
  - Track rows sit in a `cdkDropList`. Dropping calls `moveInPlaylist`. Each row's menu also gets a "Remove from this playlist" item via an optional `extraMenuItems` input on `TrackRow`; add this input in this task.
  - When the playlist is empty, show "Search for songs to add" with a link to `/search`.
  - An unknown id shows "Playlist not found".
- **Home "Liked songs" shortcut** (from the spec's home shelves): when `likedTracks().length > 0`, the first tile of the Home quick-play grid is "Liked songs", linking to `/library?view=liked`. Modify `src/app/pages/home/home.ts|html` and add a test for it to `home.spec.ts`.

- [ ] **Step 1: Write failing tests**

```ts
it('sidebar chips: clicking the active chip returns to All');
it('sidebar Create makes a playlist and navigates to it');
it('sidebar shows the empty state when the library is empty');
it('my-playlist rename: Enter saves, Escape cancels, blank ignored');
it('my-playlist drop calls moveInPlaylist(from, to)');
it('my-playlist shows not found for unknown id');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/layout/library-sidebar/*.spec.ts --include=src/app/pages/my-playlist/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, place the sidebar in `.shell-sidebar`, and delete `src/app/library/`.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: library sidebar, library page and editable local playlists"`

---

### Task 12: Right panel — Now playing and Queue views

**Files:**
- Create: `src/app/layout/right-panel/right-panel.ts|html|scss`, `src/app/layout/right-panel/now-playing-view.ts|html|scss`, `src/app/layout/right-panel/queue-view.ts|html|scss`
- Modify: `now-playing-sheet` (the queue button opens `QueueView` full-screen on phone)
- Delete: `src/app/components/` (the old `now-playing-panel` and its children)
- Test: `src/app/layout/right-panel/queue-view.spec.ts`, `src/app/layout/right-panel/now-playing-view.spec.ts`

**Interfaces:**
- Consumes: `PanelStateService`, `PlayerService`, `AudiusApi.artist`/`artistTracks`, `LibraryService`, `TrackRow`, `CdkDropList`.
- Produces:
  - `<app-right-panel>`, which shows `NowPlayingView` or `QueueView` based on `view()`. It has a header with the view title and a close button (`panel.close()`).
  - `NowPlayingView` has a `<!-- lyrics-preview-slot -->` marker for Task 13 and a `<!-- lastfm-slot -->` marker for Task 14.

**Behaviour:**
- **Now playing view:**
  - Large cover, title (link), artist (link), like button, and a share button.
  - "About the artist" card: an Audius avatar, name, followers, the first 200 characters of the bio, and a Follow button.
  - Tag pills: genre, mood and tags. These replace the old fake "Credits".
  - "Next in queue": the first item of `upNext()` with an "Open queue" link (`panel.open('queue')`).
  - "More by this artist": 5 rows.
  - Nothing loaded: "Play something to see it here".
  - Artist data loads via `toSignal` over `current()?.artistId`, with `switchMap`.
- **Queue view:**
  - "Now playing" shows the current row.
  - "Next up" is a `cdkDropList` of `upNext()` rows. Dropping maps the view index to a queue index (`player.index() + 1 + i`) and calls `moveInQueue`. Each row has a remove button that calls `removeFromQueue`.
  - A "Clear queue" button calls `clearQueue()`.
  - Clicking a row plays it by calling `playTracks(queue(), thatIndex)` and keeps the queue.
  - When there's nothing next, show "Your queue is empty".

- [ ] **Step 1: Write failing tests**

```ts
it('queue view maps drop indices to queue indices (offset by current index + 1)');
it('queue view remove calls removeFromQueue with the queue index');
it('queue view shows empty message when upNext is empty');
it('now playing view shows placeholder when nothing is loaded');
it('now playing view loads the artist for the current track and swaps when the track changes');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/layout/right-panel/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, place the panel in `.shell-panel`, and delete `src/app/components/`.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: right panel with real now-playing data and reorderable queue"`

---

### Task 13: Lyrics — LRCLIB, panel preview and full-screen view

**Files:**
- Create: `src/app/core/api/lrc-parser.ts`, `src/app/core/api/lyrics-api.ts`, `src/app/state/lyrics.service.ts`, `src/app/pages/lyrics/lyrics.ts|html|scss`
- Modify: `now-playing-view` (lyrics-preview-slot), `track` page (lyrics-slot)
- Test: `src/app/core/api/lrc-parser.spec.ts`, `src/app/core/api/lyrics-api.spec.ts`, `src/app/state/lyrics.service.spec.ts`, `src/app/pages/lyrics/lyrics.spec.ts`

**Interfaces:**
- Consumes: `APP_CONFIG.lrclibClient`, `PlayerService.current`/`time`/`seek`, `Lyrics`, `LyricLine`.
- Produces:
  - `parseLrc(lrc: string): LyricLine[]`. It handles `[mm:ss.xx]`, `[mm:ss]` and several timestamps on one line (`[00:10.00][00:20.00]text` produces two lines). It skips metadata tags such as `[ar:...]`, and returns the lines sorted by time.
  - `LyricsApi.get(artist: string, title: string, durationSec: number): Observable<Lyrics | null>`. It calls `GET https://lrclib.net/api/get` with params `artist_name`, `track_name` and `duration` (rounded), and the header `Lrclib-Client: <lrclibClient>`. A 404 returns `null`. A 429 waits `Retry-After` seconds × (1 + random 0–0.3), then retries once; if it fails again, it returns `null`.
  - `LyricsService` (root):
    - `lyrics: Signal<{ trackId: string; status: 'loading'|'ready'|'none'|'error'; data: Lyrics | null }>`, which follows `PlayerService.current()` via `switchMap`
    - `activeIndex: Signal<number>`: the last line whose `time <= player.time() + 0.25`, or -1
    - `fetchFor(track: Track): Observable<Lyrics | null>`, used by the track page for tracks that aren't playing
  - `LyricsPage` at `lyrics`.

**Behaviour:**
- **Full-screen lyrics:**
  - The background is the artwork colour (Task 15), with a fallback of `var(--surface-2)`.
  - The active line is 28px bold in full white. Other lines are 22px at 50% opacity. On phone, the sizes are 22px and 18px.
  - It scrolls the active line to the vertical centre (`scrollIntoView({ block: 'center', behavior: 'smooth' })`). Automatic scrolling pauses for 3 s after the user scrolls by hand.
  - Clicking a line calls `seek(line.time)`. Each line is a `<button>`.
  - Without synced lines but with plain text, show the plain text with no highlight. With nothing, show "No lyrics found for this song". When instrumental, show "♪ Instrumental".
  - Footer: "Lyrics from LRCLIB" (linked).
- **Panel preview:** the 3 lines around the active one, with a "Show lyrics" link to `/lyrics`. Hidden when the status is `none`.
- **Track page section:** for the current track, the synced view (compact, 8 lines tall). Otherwise, plain lyrics from `fetchFor`.

- [ ] **Step 1: Write failing tests**

```ts
// lrc-parser
it('parses mm:ss.xx and mm:ss', () => expect(parseLrc('[00:35.66] Look at the stars\n[01:02]Next')).toEqual([{ time: 35.66, text: 'Look at the stars' }, { time: 62, text: 'Next' }]));
it('expands multiple timestamps on one line and sorts');
it('ignores metadata tags and blank input');
// lyrics-api
it('sends params and Lrclib-Client header; maps syncedLyrics/plainLyrics/instrumental');
it('returns null on 404');
it('retries once after Retry-After on 429', fakeAsync(...));
// lyrics.service
it('activeIndex follows player time');
it('drops a stale response when the track changes mid-request');   // Review Focus 5
// lyrics page
it('clicking a line seeks to its time');
it('shows the instrumental and not-found states');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/api/lrc-parser.spec.ts --include=src/app/core/api/lyrics-api.spec.ts --include=src/app/state/lyrics.service.spec.ts --include=src/app/pages/lyrics/*.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, and fill the two slot markers.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: synced lyrics from LRCLIB with panel preview and full-screen view"`

---

### Task 14: Last.fm enrichment with the verified-artist rule

**Files:**
- Create: `src/app/core/api/lastfm-api.ts`, `src/app/state/artist-enrichment.service.ts`, `src/app/shared/lastfm-about/lastfm-about.ts|html|scss`
- Modify: `track` page, `artist` page, and `now-playing-view` (fill each `<!-- lastfm-slot -->`)
- Test: `src/app/core/api/lastfm-api.spec.ts`, `src/app/state/artist-enrichment.service.spec.ts`

**Interfaces:**
- Consumes: `APP_CONFIG.lastFmApiKey`, `AudiusApi.searchArtists`, `Artist`, `ArtistInfo`.
- Produces:
  - `LastFmApi.artistInfo(name: string): Observable<ArtistInfo | null>` uses `method=artist.getinfo&autocorrect=0&format=json`. The bio is `artist.bio.summary` with the trailing `<a href="https://www.last.fm/...">Read more on Last.fm</a>` removed, HTML tags stripped, and trimmed; an empty bio becomes `null`. Tags come from `artist.tags.tag[].name` (at most 5). `url` is `artist.url`.
  - `LastFmApi.similar(name: string, limit = 10): Observable<string[]>` uses `method=artist.getsimilar`.
  - Both return `null`/`[]` without making a request when `lastFmApiKey` is empty, and on any error.
  - `ArtistEnrichmentService`:
    - `infoFor(artist: Artist): Observable<ArtistInfo | null>` returns `null` unless `artist.verified`, and also returns `null` unless the Last.fm response's `artist.name` equals `artist.name` ignoring case and trimmed.
    - `fansAlsoLike(artist: Artist): Observable<Artist[]>` returns `[]` unless `artist.verified`. For each similar name (in order, at most 10), it calls `searchArtists(name, 5)` and keeps the first result that is `verified` with a name exactly matching (ignoring case). Each search is sequential via `concatMap`, to stay polite to Audius's rate limit. It returns at most 6 artists.
  - `<app-lastfm-about [artist]="Artist">` renders the bio and tags with "Bio from Last.fm" (linked to `url`). On the artist page, it also shows a "Fans also like" shelf of round media cards. It renders nothing when there's no data.

- [ ] **Step 1: Write failing tests**

```ts
it('artistInfo strips the "Read more" link and HTML, caps tags at 5');
it('makes no request and returns null when no key is configured');
it('infoFor returns null for an unverified artist without calling Last.fm');
it('infoFor returns null when the Last.fm name differs');
it('fansAlsoLike keeps only verified exact-name Audius matches, max 6');
it('a stale enrichment response is dropped when the artist changes');   // Review Focus 5 (test at component level in lastfm-about via switchMap on the artist input)
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/core/api/lastfm-api.spec.ts --include=src/app/state/artist-enrichment.service.spec.ts --include=src/app/shared/lastfm-about/*.spec.ts`
Expected: FAIL. Add `src/app/shared/lastfm-about/lastfm-about.spec.ts` for the stale-response test.

- [ ] **Step 3: Implement**, and fill the slots.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: Last.fm bio, tags and similar artists for verified artists"`

---

### Task 15: Artwork colour and keyboard shortcuts

**Files:**
- Create: `src/app/shared/utils/color.ts`, `src/app/shared/utils/artwork-color.ts`, `src/app/state/shortcuts.service.ts`
- Modify: `track`, `artist`, `playlist`, `my-playlist` and `lyrics` pages, and `now-playing-sheet` (use the colour); `app.ts` (start shortcuts)
- Test: `src/app/shared/utils/color.spec.ts`, `src/app/state/shortcuts.service.spec.ts`

**Interfaces:**
- Produces:
  - `darkenForText(rgb: [number, number, number]): [number, number, number]`. It scales the colour down until the WCAG contrast ratio against `#ffffff` is ≥ 4.5, and returns it. `rgbToCss(rgb): string` returns `rgb(r g b)`.
  - `ArtworkColorService.colorFor(url: string | null): Promise<string>`:
    - It loads the image with `crossOrigin = 'anonymous'`, draws it at 16×16 on a canvas, and averages the pixels, skipping those with luminance > 0.9 or < 0.05.
    - It applies `darkenForText` and returns `rgbToCss`.
    - It caches by URL in a `Map`.
    - It returns `'var(--surface-2)'` for a null URL, a load error, or a tainted canvas (`getImageData` throws).
  - Pages set `headerColor` from `colorFor(track.artwork.medium)` (or avatar/playlist artwork). The header style is `background: linear-gradient(180deg, <color> 0%, var(--bg) 60%)`.
  - `ShortcutsService.start(): void` registers one `keydown` listener on `document`. The bindings are listed in Global Constraints. It ignores events from typing targets and events with Ctrl, Meta or Alt held. It calls `preventDefault` for handled keys only. Space is ignored when the target is a `button` (the browser already activates it), so the action doesn't fire twice. `/` focuses `#global-search` on desktop and tablet, and navigates to `/search` on phone.

- [ ] **Step 1: Write failing tests**

```ts
it('darkenForText yields contrast >= 4.5 against white', () => { /* for [255,255,0], [200,200,200], [10,10,10] check ratio(result) >= 4.5 */ });
it('darkenForText leaves an already-dark colour unchanged', () => expect(darkenForText([20, 20, 20])).toEqual([20, 20, 20]));
it('Space toggles, ArrowRight seeks +5, Shift+ArrowRight next, m mutes');
it('ignores keys while typing in an input, textarea or contenteditable');   // and Space on a focused button
it('ignores keys with ctrl/meta/alt');
it('/ focuses #global-search');
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include=src/app/shared/utils/color.spec.ts --include=src/app/state/shortcuts.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**, apply the colour to the pages and sheet, and call `start()` from `App`'s constructor.

- [ ] **Step 4: Run the tests.** Same command. Expected: pass.

- [ ] **Step 5: Commit** with `git commit -m "feat: artwork-tinted headers and keyboard shortcuts"`

---

### Task 16: Clean-up, full test run and manual check

**Files:**
- Delete: `plan-spotifyClone.prompt.prompt.md` and any leftover old folders (`src/app/home`, `src/app/library`, `src/app/navbar`, `src/app/components`, `src/app/services`)
- Modify: `README.md` (what the app is, `npm install`, copying `environment.local.example.ts` to `environment.local.ts`, getting an optional Last.fm key, `npm start`, `npm test`, and data credits: Audius, LRCLIB, Last.fm)
- Create: `.gitattributes` with `* text=auto eol=lf`

- [ ] **Step 1: Check that no mock data or old patterns are left**

Use Grep over `src/app` for each of these patterns: `\*ngIf|\*ngFor|CommonModule|standalone: true|@Input\(|@Output\(|BehaviorSubject|placehold\.co|unsplash`.
Then search component SCSS for raw hex values (`#[0-9a-fA-F]{3,6}`); the only allowed match is `src/styles.scss`.
Expected: no matches. Fix any you find.

- [ ] **Step 2: Run the full suite and a production build**

Run: `npx ng test --watch=false --browsers=ChromeHeadless`, then `npx ng build`.
Expected: all tests pass. The build has no errors and no budget errors; warnings are acceptable.

- [ ] **Step 3: Manual check at 1280px, 768px and 375px** using the browser pane with `npm start`

1. Search "lofi", play the 3rd song, skip, seek, and go back.
2. Open the song page and check its plays, tags and "More by".
3. Open lyrics on a song that has them (search a well-known title), click a line, and check that it seeks.
4. Queue: drag-reorder, remove an item, and clear.
5. Like a song, create a playlist, add two songs, rename it, reorder, reload the page, and check that everything persisted.
6. Phone: tab bar, mini player → sheet, menus open as bottom sheets, and tap targets are at least 44px.
7. Keyboard: Space, the arrow keys and `/`. Typing in search doesn't trigger shortcuts.
8. Turn the network off in devtools and press next. The error toast appears and playback stops after 3 tries.

Expected: everything passes. Fix anything that fails, writing the fix test-first where possible.

- [ ] **Step 4: Commit** with `git commit -m "chore: clean-up, README, line endings"`
