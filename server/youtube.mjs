// Finds the official YouTube video for a song, using the YouTube Data API (key stays here, never in
// the browser). Matches are cached on disk so the free 100 searches a day stretch across listeners.

import fs from 'node:fs';
import path from 'node:path';

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const NO_MATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SCORE = 3;
const DURATION_WINDOW_S = 15;
const MAX_VIDEO_S = 15 * 60;
/** Combining accents used by Latin letters (é → e). Other scripts' marks are kept (ド stays ド). */
const LATIN_ACCENTS = /[\u0300-\u036f]/g;

const PENALTY_WORDS = ['cover', 'live', 'remix', 'sped up', 'slowed', '8d', 'karaoke', 'lyrics'];

/** Lower case, Latin accents removed, anything that isn't a letter or digit (any script) → one space. */
function base(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(LATIN_ACCENTS, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Removes "(feat. X)", "[ft. X]" and trailing "feat. X" credits. */
function withoutFeat(s) {
  return String(s ?? '')
    .replace(/[([](?:feat|ft|featuring)\.?\s[^)\]]*[)\]]/gi, '')
    .replace(/\s(?:feat|ft|featuring)\.?\s.*$/i, '');
}

/** Same rules as the app's core/title.ts normalise(): loose — drops every bracketed part (for scoring). */
export function normalise(s) {
  return base(withoutFeat(s).replace(/\s*[([][^)\]]*[)\]]/g, ''));
}

/** Strict: only "feat." credits, case and accents are ignored — "(Remix)" or "(Live)" stays part of it. */
export function exactKey(s) {
  return base(withoutFeat(s));
}

/** "PT1H2M3S" → 3723. */
export function parseIsoDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Confidence that a video is the song. ≥ 3 counts as a match.
 * @param {{ title: string, channelTitle: string, durationS: number }} c
 * @param {{ artist: string, title: string, durationS: number }} song
 */
export function score(c, song) {
  let s = 0;
  const artist = normalise(song.artist);
  const channel = normalise(c.channelTitle);
  if (artist && (channel === `${artist} topic` || channel.includes(artist))) s += 3;

  const songTitle = normalise(song.title);
  if (songTitle && normalise(c.title).includes(songTitle)) s += 2;

  const rawTitle = String(c.title ?? '').toLowerCase();
  const songWords = String(song.title ?? '').toLowerCase();
  const penalised = PENALTY_WORDS.some(
    (w) => new RegExp(`\\b${w}\\b`).test(rawTitle) && !new RegExp(`\\b${w}\\b`).test(songWords),
  );
  if (penalised) s -= 3;

  if (song.durationS > 0 && c.durationS > 0) {
    const diff = Math.abs(song.durationS - c.durationS);
    if (diff <= DURATION_WINDOW_S) s += (2 * (DURATION_WINDOW_S - diff)) / DURATION_WINDOW_S;
  }
  return s;
}

/** song key → { videoId|null, title, channel, at }, persisted as JSON. Corrupt or missing file = empty. */
export function createMatchCache(file) {
  let data = {};
  try {
    if (file && fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
    }
  } catch {
    data = {};
  }
  const save = () => {
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
    } catch {
      // A read-only disk only loses the cache, not the match.
    }
  };
  return {
    get(key, now) {
      const entry = data[key];
      if (!entry) return undefined;
      if (entry.videoId === null && now - entry.at > NO_MATCH_TTL_MS) return undefined;
      return entry;
    },
    set(key, entry) {
      data[key] = entry;
      save();
    },
    delete(key) {
      delete data[key];
      save();
    },
  };
}

/** Cache key: a remix or live version is a different recording from the original. */
export const songKey = (artist, title) => `${exactKey(artist)}|${exactKey(title)}`;

class QuotaError extends Error {}

async function getJson(fetch, url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403 && text.includes('quotaExceeded')) throw new QuotaError('quota');
    throw new Error(`youtube ${res.status}`);
  }
  return res.json();
}

/**
 * @returns {Promise<{ videoId: string, title: string, channel: string, confidence: number }
 *   | { videoId: null, reason: 'no-match' | 'quota' | 'no-key' }>}
 */
export async function matchSong({ fetch, key, cache, now }, { artist, title, durationS = 0 }) {
  const cacheKey = songKey(artist, title);
  const hit = cache.get(cacheKey, now());
  if (hit) {
    return hit.videoId
      ? { videoId: hit.videoId, title: hit.title, channel: hit.channel, confidence: hit.confidence }
      : { videoId: null, reason: 'no-match' };
  }
  if (!key) return { videoId: null, reason: 'no-key' };

  try {
    const q = `${artist} ${title} official audio`;
    const search = await getJson(
      fetch,
      `${SEARCH_URL}?part=snippet&type=video&videoEmbeddable=true&videoCategoryId=10&maxResults=5` +
        `&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`,
    );
    const items = (search.items ?? []).filter((i) => i?.id?.videoId);
    let best = null;
    if (items.length) {
      const ids = items.map((i) => i.id.videoId).join(',');
      const details = await getJson(
        fetch,
        `${VIDEOS_URL}?part=contentDetails,status&id=${ids}&key=${encodeURIComponent(key)}`,
      );
      const byId = new Map((details.items ?? []).map((d) => [d.id, d]));
      for (const item of items) {
        const d = byId.get(item.id.videoId);
        if (!d || d.status?.embeddable !== true) continue;
        const videoS = parseIsoDuration(d.contentDetails?.duration);
        if (!videoS || videoS >= MAX_VIDEO_S) continue;
        if (durationS > 0 && Math.abs(videoS - durationS) > DURATION_WINDOW_S) continue;
        const candidate = { title: item.snippet?.title ?? '', channelTitle: item.snippet?.channelTitle ?? '', durationS: videoS };
        const s = score(candidate, { artist, title, durationS });
        if (s >= MIN_SCORE && (!best || s > best.confidence)) {
          best = { videoId: item.id.videoId, title: candidate.title, channel: candidate.channelTitle, confidence: s };
        }
      }
    }
    cache.set(cacheKey, best ? { ...best, at: now() } : { videoId: null, at: now() });
    return best ?? { videoId: null, reason: 'no-match' };
  } catch (err) {
    if (err instanceof QuotaError) return { videoId: null, reason: 'quota' };
    throw err;
  }
}
