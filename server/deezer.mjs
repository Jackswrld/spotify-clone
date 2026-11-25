// Deezer's public API (no key): real artist photos and fan counts, and a check that a song
// exists. Deezer sends no CORS header for browsers, so the app reaches it through here.

import { exactKey } from './youtube.mjs';

const BASE = 'https://api.deezer.com';
const TTL_MS = 24 * 60 * 60 * 1000;

/** @param {{ fetch: typeof fetch, now: () => number }} deps */
export function createDeezer({ fetch, now }) {
  /** key → { at, value } */
  const cache = new Map();

  async function cached(key, load) {
    const hit = cache.get(key);
    if (hit && now() - hit.at <= TTL_MS) return hit.value;
    const value = await load();
    cache.set(key, { at: now(), value });
    return value;
  }

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`deezer ${res.status}`);
    const body = await res.json();
    if (body?.error) throw new Error('deezer error');
    return body;
  }

  return {
    /** The exact-name artist with the most fans (namesakes and near names never win). */
    artistPhoto(name) {
      const key = exactKey(name);
      return cached(`artist|${key}`, async () => {
        const body = await getJson(`${BASE}/search/artist?q=${encodeURIComponent(name)}&limit=10`);
        const best = (body.data ?? [])
          .filter((a) => exactKey(a.name) === key)
          .sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
        return best ? { image: best.picture_xl ?? null, fans: best.nb_fan ?? 0 } : { image: null, fans: 0 };
      });
    },

    /** The song by exactly this artist and title, or null (e.g. a book chapter on Genius). */
    findTrack(artist, title) {
      return cached(`track|${exactKey(artist)}|${exactKey(title)}`, async () => {
        // Plain search: Deezer's strict artist:"…" track:"…" form misses real songs. The exact-name
        // check below keeps out covers, audiobooks and near titles.
        const body = await getJson(`${BASE}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=10`);
        const hit = (body.data ?? []).find(
          (t) => exactKey(t.artist?.name) === exactKey(artist) && exactKey(t.title) === exactKey(title),
        );
        return hit ? { cover: hit.album?.cover_xl ?? null, durationS: hit.duration ?? 0 } : null;
      });
    },
  };
}
