# Search fixes, real artists, lyric search — design

Date: 2026-11-25 · Builds on branch `feat/audio-only`.

## Why

Search makes the app feel broken. The same song shows up two or three times. Searching an
artist shows strangers with the same name (from Audius) and no photos. Searching a song title
shows random artists. The user also wants to find a song from a line of its lyrics they remember.

## Goals

1. **One copy of each song.** Apple lists a song once for each release it appears on (single,
   album, deluxe). Search, artist pages and album lists show it once.
2. **Real artists with real photos.** Artist results are the actual mainstream artist, with
   their photo. No Audius namesakes, and no Apple namesakes nobody listens to ("Wiz Kid",
   "Wizkid T").
3. **A song title finds the song.** Searching "Calm Down" puts the song first, not an artist.
4. **Lyric search, matching the words.** Typing a line you remember ("left the party with a
   girl that said she doesn't want me") lists songs whose lyrics contain roughly those words.
   Tapping one plays the song.
5. **Audius stays, in the background.** It has no daily limit and is free and legal, so it
   keeps the app useful when YouTube's 100 lookups a day run out. But it stops mixing into
   mainstream results.

## Non-goals and anti-goals

- No "similar meaning" lyric search (user chose matching words).
- No showing full lyrics from Genius (LRCLIB stays the lyrics source).
- Never show an artist page for the wrong person. Showing nothing is better than a namesake.
- Never spend YouTube lookups during search.

## Approaches considered

- **Lyric search:** Genius search through our music server (chosen). The free token stays in
  `server/.env`, like the YouTube key. Alternatives: Musixmatch (no free plan, from $49 a month);
  LRCLIB (its search covers titles, artists and albums, not lyric text: tested, 0 results);
  Exa or another meaning-based search (a paid key, looser results, and the user chose
  matching words).
- **Artist photos:** Deezer's public API (chosen: free, no key, works from the browser, returns
  the photo and fan count). The alternative, scraping Apple Music artist pages, is fragile.
- **Audius:** remove it entirely, or keep it in the background (chosen, see goal 5).

## Design

**Duplicates.** One shared helper, `dedupeSongs(tracks)`, in `core/`. Key = `exactKey(artist
lead) | exactKey(title)`. "Artist lead" = the part before " & ", ",", " feat." or " x ", so "Rema &
Selena Gomez" and "Rema" collapse. Keep the first copy, but prefer a "- Single" release or the
plain album over "Deluxe", "Ultra" and similar editions. "(Remix)" and "(Live)" stay separate
songs because `exactKey` keeps brackets. Used in search, catalog artist top songs, chart lists
and "more by".

**Artists.**
- New `ArtistPhotoApi` (Deezer `search/artist`, cached for the session) with
  `photoFor(name)`. It picks the Deezer artist whose name matches exactly (`exactKey`) and, among
  those, the one with the most fans. That returns `{ image, fans }` or null.
- Catalog artist cards, the catalog artist page header and the now-playing artist get the
  photo, falling back to today's newest-release art.
- Search artist results: Apple artists only. Each is checked against Deezer. Drop artists
  with no exact-name Deezer match or fewer than 1,000 fans, unless that leaves no artists at
  all. Sort by fans. Show at most 6.
- Audius artists are removed from the search artist row, the top result and "Fans also like" for
  catalog artists.

**Top result.**
1. An artist whose name exactly matches the query.
2. Otherwise the first song whose title matches the query exactly (`exactKey`).
3. Otherwise the first song.

Never an Audius artist.

**Lyric search.**
- Relay: `GET /api/lyrics/search?q=` calls `https://api.genius.com/search` with
  `GENIUS_ACCESS_TOKEN` from `server/.env`. It returns
  `[{ title, artist, image, geniusId }]` (top 10), with the same cross-site check and a rate limit
  of 30 a minute per IP. It caches results for 24 h in memory. Without a token it answers
  `{ results: [], reason: 'no-key' }`; on upstream failure, 502.
- App: the search page gets a third song tab, **Lyrics**. When the query has 4 or more words,
  a "Songs with these lyrics" section also appears automatically under Songs.
- Tapping a result resolves it on Apple (`findSong(artist, title)`) and plays it. If Apple
  doesn't have it, it shows a toast: "Couldn't find this song to play".
- Without a token, the Lyrics tab says lyric search isn't set up and points to the README.
  `.env.example` and the README get a Genius section.

**Audius in the background.**
- Search song results show Apple songs only. An **Independent** tab (renamed from "Audius")
  shows Audius songs and playlists.
- On Home, the "Independent on Audius" heading becomes "Independent artists".
- The sidebar credit "Powered by Audius" stays as small text (attribution).
- Audius track and artist pages keep working.

## Constraints

- TDD as before; relay tests stay at `node --test`.
- No secrets in git (the token goes only in `server/.env`).
- Explicit-path commits on a branch, never on `main`.

## Left to the builder

- Exact UI copy and spacing in the Lyrics tab.
- Deezer request debouncing.
- The exact edition-preference regex.
