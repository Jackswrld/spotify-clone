# Design: Mainstream charts and full songs via the YouTube player

Date: 2026-11-23
Status: Draft, awaiting approval
Builds on: `2026-11-23-audius-music-app-design.md` (the app as merged on `main`)

## Intent

The app plays full songs today, but only Audius's independent catalog. The user wants the
**latest mainstream music**: what's charting now, the artists behind it, and the ability to
press play and hear the whole song.

The user looked at mp3paw. mp3paw searches YouTube, rips the audio and re-encodes it as MP3,
which is unlicensed and against YouTube's terms. This design gets the same result legitimately:

- **What's hot:** Apple's free chart feed and Last.fm.
- **Facts about songs and artists:** Apple's free song-search service (iTunes Search) and
  Last.fm.
- **Full-length playback:** YouTube's official embedded player, which YouTube allows any
  website to use for free under its rules.

Audius stays as the second catalog for independent music, which can still play in the
background.

## Goals

1. Home leads with the real current charts: top songs and top albums, by country, plus a
   global top songs list.
2. Search covers mainstream music as well as Audius.
3. Pressing play on a mainstream song plays the full official song through the YouTube player.
   It joins the same queue, with the same controls, as Audius songs.
4. Mainstream song, artist and album pages:
   - Song pages: artwork, release date, genre, album, lyrics, artist bio.
   - Artist pages: latest releases newest first, top songs, similar artists.
   - Album pages: track list.
5. Likes and your own playlists can hold songs from both catalogs.

## Non-goals

- Downloads, MP3 files, or taking audio out of YouTube in any way.
- Background or lock-screen playback of YouTube songs (YouTube's rules forbid it; see
  Constraints). Audius songs keep working in the background.
- Deezer, unless the user's Deezer developer application is approved (see Approaches).
- Spotify.
- User accounts. The library stays in the browser.
- Hosting the app online. The relay server described below runs on the user's computer for
  now; hosting is a later step.

## Anti-goals (failure even if it technically works)

- Any hidden, tiny or audio-only YouTube playback, or any overlay covering the YouTube player.
  This breaks YouTube's rules and can get the API key banned.
- Playing the wrong recording (a cover, a live version, or a fan upload) as if it were the
  song. If we aren't confident it's the right video, we say so instead of guessing.
- Using up the YouTube search allowance for the day on browsing. The search must only run when
  someone actually presses play on a song with no known video.
- Keeping a copy of any provider's catalog. We cache responses briefly, but we don't build our
  own database from them.

## Constraints (research, Nov 2026)

| Source | What we use | Key | Limits | Works straight from the browser? |
|---|---|---|---|---|
| Apple chart feed (`rss.marketingtools.apple.com/api/v2/{country}/music/most-played/{n}/{songs\|albums}.json`) | Top songs and albums per country (title, artist, Apple IDs, genres, release date, 100px art) | none | No new-releases feed exists (it returns 404/502). Allowed for promoting the music, so link to Apple Music. | **No** (needs the relay) |
| iTunes Search / Lookup (`itunes.apple.com/search`, `/lookup`) | Song, album and artist metadata; an artist's albums or songs newest first (`sort=recent`); larger art by rewriting `100x100bb` → `600x600bb` | none | About 20 calls a minute. Promotional-use terms: show a "Listen on Apple Music" link. **Never use its 30-second previews** (only allowed next to a store badge, not for listening). | Yes |
| Last.fm | Global top tracks and artists (`chart.getTopTracks`), country charts (`geo.getTopTracks`), artist bio and tags, similar artists | free key (already supported) | Non-commercial | Yes |
| YouTube Data API v3 | Find the video for a song (`search.list`); check it can be embedded (`videos.list`) | free key, **kept on the relay** | **100 searches a day** (separate bucket); 10,000 units a day for everything else (`videos.list` costs 1) | Yes, but the key must not be in the browser |
| YouTube IFrame Player API | Full-length playback | none | Player at least **200×200 px** and visible on the page the user is viewing; no overlays on it; no background or hidden player; don't separate audio from video; ads stay; send the `Referer` header | Yes |
| LRCLIB | Lyrics (already integrated) | none | Covers mainstream music far better than Audius | Yes |

Consequences:

- **A small relay server is required.** The Apple chart feed can't be called from the browser,
  and the YouTube key must stay secret. The relay also holds the song→video cache, which
  stretches 100 searches a day across all listeners.
- **YouTube songs need a visible player.** The layout gains a "video dock" (below).
- **Deezer:** its terms (updated October 2026) grant access only to approved developers,
  allow audio only inside the Deezer widget, and forbid building a database from its content.
  It isn't used. It's an optional later step only if the user applies and is approved.

## Approaches considered

1. **Charts plus the YouTube player (chosen by the user).** Real current hits at full length,
   legally. In exchange: a visible player, YouTube ads, no lock-screen playback for these
   songs, and a 100-a-day search limit mitigated by caching.
2. **Charts only, keeping Audius for playback.** Simpler, but no full mainstream songs.
3. **mp3paw or other rip sites.** Rejected: unlicensed, against YouTube's terms, and unstable
   because the domains keep changing.

Within approach 1, the choice of metadata provider is mine: **Apple + iTunes + Last.fm instead
of Deezer**. Deezer has the richest free data, but its approval gate and its
no-database/no-copy terms conflict with likes and playlists stored in the browser.

## Architecture

### New: the relay (`server/`)

A small Node 20 server, with no framework beyond `node:http` (my call: no new dependencies,
easy to host later). It runs next to `ng serve`, and the Angular dev server forwards `/api/*`
to it through `proxy.conf.json`. `npm start` launches both.

| Route | Does |
|---|---|
| `GET /api/charts/:country/:kind/:limit` | Fetches the Apple chart feed (`kind` = `songs` or `albums`, `limit` 10/25/50/100) and returns it unchanged. Cached in memory for 1 hour. Country is a two-letter code, matched against a list of allowed codes. |
| `GET /api/youtube/match?artist=&title=&duration=` | Returns `{ videoId, title, channel, confidence }` or `{ videoId: null, reason }`. See matching below. |
| `GET /api/health` | `{ ok: true, youtubeKey: boolean }`, so the app can tell whether YouTube playback is set up. |

- Configuration comes from `server/.env`, which is git-ignored, with a committed
  `server/.env.example`. Settings: `YOUTUBE_API_KEY` and `PORT` (default `4400`).
- The relay accepts requests only from the dev origin, limits each IP to 30 match requests a
  minute, and never forwards arbitrary URLs.

**Finding the right video (`/api/youtube/match`).**

1. **Check the cache first.** The cache key is `normalise(artist) + '|' + normalise(title)`,
   where normalise means lower case, accents removed, "feat. …" and bracketed parts removed,
   and spaces collapsed.
   - Cache hit: return it.
   - The cache is a JSON file `server/data/youtube-cache.json` (git-ignored). It only holds
     key → `videoId` pairs, not catalog data.
2. **Search YouTube.** `search.list` with `part=snippet`, `type=video`, `videoEmbeddable=true`,
   `videoCategoryId=10` (Music), `maxResults=5`, and `q = "<artist> <title> official audio"`.
3. **Check embedding and length.** `videos.list` with `part=contentDetails,status` for the 5
   IDs. Keep only videos that can be embedded, with a duration within ±15 s of the song (when
   the duration is known) and under 15 minutes.
4. **Score.**
   - +3 if the channel is the artist's official "Topic" channel (`<Artist> - Topic`) or
     contains the artist name.
   - +2 if the title contains the song title.
   - −3 if the title contains "cover", "live", "remix", "sped up", "slowed", "8d", "karaoke"
     or "lyrics" (unless the song title itself contains that word).
   - +1 for each second of closeness inside the ±15 s window, scaled to at most +2.
   - **Below 3: no match.**
5. **Cache the result,** including "no match" for 7 days, so the same miss doesn't burn
   searches.
6. **When the daily search allowance is used up** (YouTube returns 403 `quotaExceeded`):
   return `{ videoId: null, reason: 'quota' }`, and don't cache it.

### The app (Angular)

**Models.**

- `Track` gains `source: 'audius' | 'catalog'` and `appleId: string | null`.
- `Artist` and `Playlist` gain `source` too.
- A new `Album` model (id, name, artist, artwork, release date, track count).
- `Track.id` for catalog songs is `apple:<appleId>`, so it can never collide with Audius IDs.
  Stored Audius items get `source: 'audius'` added when they're read, so existing likes and
  playlists keep working.

**New data services.**

- `ChartsApi`: the relay's chart routes.
- `CatalogApi`: iTunes Search and Lookup.
  - Search songs, artists and albums.
  - An artist's albums newest first, and their top songs.
  - An album's songs.
  - A single song.
  - Converts the responses into the app's models, swapping the 100px art for 600px.
- `LastFmApi` gains `topTracks(country?)`.
- `YouTubeMatchApi`: the relay's match route.

**Playback: one queue, two engines.** `PlayerService` keeps the queue, shuffle, repeat and
recently played exactly as they are. Producing sound moves behind an `Engine` interface:

```
interface Engine {
  load(track: Track): void;     // starts playing
  play(): void; pause(): void; seek(s: number): void;
  setVolume(v: number): void; setMuted(m: boolean): void;
  // reports back: playing, paused, waiting, timeupdate(time, duration), ended, error(kind)
}
```

- `AudioEngine`: today's `HTMLAudioElement` code, moved here unchanged.
- `YouTubeEngine`: owns one `YT.Player`. It loads the IFrame API script once, polls
  `getCurrentTime()` every 250 ms while playing, and maps player states and errors.
  - Errors 101 and 150 (not embeddable) count as a stream error, so the existing skip logic
    applies.
  - Before loading, it asks `YouTubeMatchApi` for the video. "No match" becomes an error whose
    message reads "Couldn't find '<title>' on YouTube." It's counted like any other error, so
    the 3-error cap still applies. "Quota" reads "YouTube's daily search limit is used up; try
    again tomorrow." and stops playback without skipping through the whole queue.
- When the source changes, the player pauses and unloads the other engine.

The Media Session controls still work for YouTube songs while the tab is visible. On a phone
with the screen off, YouTube playback stops, and the README says so.

**The video dock: where the YouTube player is visible.** There is one player element for the
whole app. Moving an iframe in the page reloads it, so it isn't moved: it stays in one fixed
spot, and its position and size follow the place where it should appear.

| Layout | Where the player is while a YouTube song is current |
|---|---|
| Desktop, right panel open on Now playing | Replaces the cover art at the top of the panel: full panel width, square, at least 288×288 |
| Desktop or tablet, panel closed or on Queue | A floating card, 240×240, bottom-right above the player bar. It can be dragged to another corner, and has a button to open the Now playing panel. |
| Phone, full-screen player open | Replaces the large cover art (square, full width) |
| Phone, full-screen player closed | A floating 200×200 card above the mini player, with a close (×) button that **pauses** playback |

- When an Audius song is current, the player element is hidden and paused.
- Nothing is ever drawn on top of the player.
- The player is never smaller than 200×200.
- Pages that show a big cover for the current song (the lyrics page, for instance) show the
  dock beside it instead.

**Pages and screens.**

- **Home:**
  - Country picker (default from `navigator.language`, otherwise `us`; saved in the browser).
  - "Top songs in <Country>" (Apple, 25).
  - "Top albums in <Country>" (Apple, 25).
  - "Global top songs" (Last.fm, only when a key is set).
  - The existing Audius shelves after these, under the heading "Independent on Audius".
  - The genre chips apply only to the Audius shelves; they're labelled that way.
  - Quick-play tiles use the top 6 chart songs.
- **Search:**
  - Top result.
  - "Songs" with two tabs: All, Audius.
    - "All" lists the iTunes results first, then Audius, de-duplicated by normalised
      artist + title.
  - Artists and Albums use iTunes; Playlists use Audius.
  - Searching never calls YouTube.
- **Catalog song page** (`/song/:appleId`): the same layout as the Audius track page.
  - Header: artwork, title, artist, album link, release year, genre, length.
  - Actions: play, like, add to playlist, and a "Listen on Apple Music" link.
  - Lyrics.
  - About the artist (Last.fm bio).
  - More by the artist (iTunes top songs).
  - A small "Plays via YouTube" note, linking to the video on youtube.com once it's matched.
- **Catalog artist page** (`/catalog-artist/:appleId`): header (Last.fm image if there is one,
  otherwise the newest album's art), Play (top songs), Follow, "Latest releases" (albums,
  newest first, with dates), "Top songs" (10), "About" (Last.fm), "Fans also like" (Last.fm
  similar artists that can be found on iTunes).
  - **The Audius "verified + exact name" rule doesn't apply here.** Apple's artist IDs are
    authoritative, so Last.fm data is matched by exact name only.
- **Album page** (`/album/:appleId`): header, track list, play, shuffle, and a link to Apple
  Music.
- **Right panel and phone sheet:**
  - Show the dock in place of the art for YouTube songs.
  - For catalog songs: the "About the artist" card uses Last.fm and iTunes; "More by this
    artist" uses iTunes.
- **Settings note (sidebar footer):** "Mainstream songs play via YouTube". If the relay
  reports no YouTube key, it reads "YouTube playback isn't set up", with a link to the README
  section.

**Attribution.**

- "Charts from Apple Music" on chart shelves.
- "Listen on Apple Music" on catalog pages.
- YouTube branding stays inside the player, untouched.
- "Lyrics from LRCLIB" and "Bio from Last.fm" stay as they are.

## Error handling summary

| Situation | What the user sees |
|---|---|
| Relay not running | Chart shelves show the usual error with Retry; catalog search still works (iTunes works without the relay); playing a catalog song shows "Can't reach the music server". |
| No YouTube key set | Catalog songs show a disabled play button with the tooltip "YouTube playback isn't set up"; Audius songs work. |
| No confident video match | Toast "Couldn't find '<title>' on YouTube." and skip to the next song (3-error cap applies). |
| Daily search limit used up | Toast "YouTube's daily search limit is used up; try again tomorrow." Playback stops. Already-matched songs keep playing (cached). |
| Video blocked from embedding or removed (101/150/100) | Remove the cached match, show the "Couldn't find" toast, and skip. |
| iTunes rate limit (HTTP 429/403) | Section error with Retry; responses are cached for 10 minutes by the existing interceptor. |

## Testing

- **Relay** (Node's built-in test runner, `node --test`):
  - Normalising titles.
  - Scoring (official channel beats a cover; ±15 s window; a song title containing "live"
    isn't penalised).
  - Reading and writing the cache, and the 7-day expiry of "no match".
  - Quota handling (not cached).
  - Rejecting a country not on the allowed list.
  - The rate limit.
  - The YouTube HTTP calls are replaced by a fake fetch; tests never call real APIs.
- **App** (Karma, as today):
  - `CatalogApi` and `ChartsApi` converting responses into models (recorded sample responses).
  - Old saved likes without `source` reading as Audius.
  - `PlayerService`, using fake engines:
    - Switching engines when the source changes.
    - Errors from both engines feed the same skip and 3-error logic.
    - "Quota" stops instead of skipping.
  - `YouTubeEngine` with a fake `YT.Player`: state mapping, the time polling stops when
    paused, and errors 101/150 become "not embeddable".
  - Dock placement chosen correctly for each layout and panel state, and never under 200 px.
  - Search de-duplication.
  - Home country picker saved.
- **Manual checks** at 1280 and 375 px:
  - A top-chart song plays with the video visible.
  - Next goes to an Audius song and the dock hides.
  - Reloading keeps likes from both catalogs.
  - The phone floating card closes and pauses.
  - A second play of the same song makes no new search (check the relay log).

## Calls made after review (mine, for the user to check)

1. **Moving to a YouTube song when the player can't be seen.** This covers a hidden tab, a
   phone with the screen off, and a phone floating card closed with ×.
   - **What happens:** the player **pauses and waits**. It loads the song (so the dock is
     ready) but doesn't start it, shows the toast "Tap play to keep listening — this song
     plays via YouTube", and sets `isPlaying` to false. Pressing play (or the tab becoming
     visible again **if** the user had pressed play since) starts it.
   - **Blocked autoplay:** if the browser blocks an automatic start, that is treated the same
     way: paused, not an error. It never counts toward the 3-error cap.
   - **Result:** the YouTube player is never playing while off screen.
   - **How visibility is decided:** `document.visibilityState === 'visible'`, the dock's
     element at least 200×200, and the phone card not closed.
2. **Last.fm entries have no Apple ID.**
   - **Shelves don't need lookups up front.** The "Global top songs" shelf and "Fans also
     like" show Last.fm's own name and image straight away, with no iTunes calls on load.
   - **One lookup on click.** Clicking or pressing play on one runs a single iTunes search
     (`term = artist + title`, `entity=song`, `limit=5`), picks the result with exactly the
     same artist and title (ignoring case and "feat." parts), and then behaves like any
     catalog song. Artists go the same way to `/catalog-artist/:appleId`.
   - **No match:** if nothing matches exactly, show the toast "Couldn't find this on Apple
     Music" and do nothing else.
   - **What gets saved:** only resolved catalog items (with an Apple ID) can be liked, added
     to playlists or followed. There are no `appleId: null` tracks.
3. **Songs from the Apple chart have no length.** Before matching a video, `YouTubeEngine`
   does one iTunes `lookup?id=<appleId>` to get `trackTimeMillis` if the duration is missing,
   and caches it. If the lookup fails, matching runs without the ±15 s check, but the score
   still needs at least 3.
4. **Library storage.**
   - **Followed artists:** catalog artists go in the same `library.savedArtists` list with
     `source: 'catalog'`, and open `/catalog-artist/:appleId`.
   - **Albums:** album pages get a Save button. Saved albums go in a new `library.savedAlbums`
     key and appear in the library list under the Playlists chip, labelled "Album • <artist>",
     opening `/album/:appleId`.
   - **Old data:** older saved items without `source` read as Audius.
5. **The search allowance and moving to the next song.** Moving on automatically or skipping
   counts as pressing play: a match is looked up only when a song becomes current. There's no
   looking ahead to the next song (it would spend searches on songs that may never play). The
   cache makes repeat plays free. The README states the rough maths: about 100 new songs a day
   across everyone using this relay.

## Left to the builder

- The exact HTML and CSS of the dock and its drag-to-corner behaviour.
- The list of allowed countries for the chart routes (at least the countries Apple publishes;
  a 30-country list is fine).
- Whether `npm start` uses `concurrently` or a small Node script to run both processes. Prefer
  no new dependency.
- Country names shown in the picker (use `Intl.DisplayNames`).

## Setup the user will need

- A free **YouTube Data API key**. In Google Cloud Console: create a project → enable
  "YouTube Data API v3" → Credentials → API key. Put it in `server/.env`. The README gets
  step-by-step instructions. Without it, everything except YouTube playback works.
- Optional, already supported: a Last.fm key, which also turns on the global chart and the
  catalog artist bios.

## Build order (for the plan)

1. Relay: chart route, health route, dev proxy, `npm start` running both.
2. Models plus `CatalogApi` and `ChartsApi`; reading old saved data without `source`.
3. Move playback behind the engine interface: `AudioEngine`, with no change in behaviour (all
   existing tests stay green).
4. Relay: YouTube match route with the cache, then `YouTubeEngine` and `YouTubeMatchApi`.
5. Video dock across all layouts.
6. Home charts and country picker; Search with both catalogs.
7. Catalog song, artist and album pages; panel and sheet support for catalog songs.
8. Error states, attribution, README, manual check.
