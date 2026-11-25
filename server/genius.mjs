// Lyric search: Genius finds songs whose lyrics contain the words; Deezer confirms each hit is a
// real song (Genius also hosts books, poems and translation pages) and supplies its cover.
// The token stays here, never in the browser.

import { createDeezer } from './deezer.mjs';
import { exactKey } from './youtube.mjs';

const GENIUS_SEARCH = 'https://api.genius.com/search';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 10;
const MAX_CHECKED = 15;

/**
 * @param {{ fetch: typeof fetch, token: string, now: () => number, deezer?: ReturnType<typeof createDeezer> }} deps
 * @returns {(q: string) => Promise<{ results: Array<{ title: string, artist: string, image: string|null, geniusId: number, durationS: number }>, reason?: 'no-key' }>}
 */
export function createLyricsSearch({ fetch, token, now, deezer = createDeezer({ fetch, now }) }) {
  const cache = new Map();

  return async function search(q) {
    if (!token) return { results: [], reason: 'no-key' };
    const key = exactKey(q);
    const hit = cache.get(key);
    if (hit && now() - hit.at <= TTL_MS) return hit.value;

    const res = await fetch(`${GENIUS_SEARCH}?q=${encodeURIComponent(q.trim())}&per_page=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`genius ${res.status}`);
    const body = await res.json();

    const candidates = (body?.response?.hits ?? [])
      .filter((h) => h?.type === 'song' && h.result?.title && h.result?.primary_artist?.name)
      .map((h) => ({ title: h.result.title, artist: h.result.primary_artist.name, geniusId: h.result.id }))
      .filter((c) => !/genius/i.test(c.artist))
      .slice(0, MAX_CHECKED);

    // A Deezer failure is not "not a real song": never cache it, and if every check failed,
    // fail the search so the app offers Retry instead of "no songs".
    let failures = 0;
    const confirmed = await Promise.all(
      candidates.map(async (c) => {
        const track = await deezer.findTrack(c.artist, c.title).catch(() => {
          failures++;
          return null;
        });
        return track ? { ...c, image: track.cover, durationS: track.durationS } : null;
      }),
    );
    if (candidates.length && failures === candidates.length) throw new Error('deezer unavailable');
    const results = confirmed
      .filter(Boolean)
      .slice(0, MAX_RESULTS)
      .map(({ title, artist, image, geniusId, durationS }) => ({ title, artist, image, geniusId, durationS }));
    const value = { results };
    if (failures === 0) cache.set(key, { at: now(), value });
    return value;
  };
}
