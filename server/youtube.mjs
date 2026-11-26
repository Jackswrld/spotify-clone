// Finds the official YouTube video for a song, using the YouTube Data API (key stays here, never in
// the browser). Matches are cached on disk so the free 100 searches a day stretch across listeners.

import fs from 'node:fs';
import path from 'node:path';

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const NO_MATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_SCORE = 3;
/** Bumped when matching gets better, so older "no match" notes are searched again. */
const MATCH_RULES = 2;
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

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** YouTube's search snippets are HTML-encoded ("Choosin&#39; Texas", "Simon &amp; Garfunkel"). */
export function decodeHtml(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** "PT1H2M3S" → 3723. */
export function parseIsoDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso ?? ''));
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** "A Class & Pureojuice" → the whole credit plus each artist in it (normalised). */
function creditedArtists(artist) {
  const parts = String(artist ?? '').split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bfeaturing)\s+/i);
  return [...new Set([normalise(artist), ...parts.map(normalise)])].filter(Boolean);
}

/** The plain second search: no "official audio", no bracketed parts or feat. credits. */
function plainQuery(artist, title) {
  const t = withoutFeat(title).replace(/\s*[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return `${artist} ${t}`;
}

/**
 * Confidence that a video is the song. ≥ 3 counts as a match.
 * @param {{ title: string, channelTitle: string, durationS: number }} c
 * @param {{ artist: string, title: string, durationS: number }} song
 */
export function score(c, song) {
  let s = 0;
  const videoTitle = decodeHtml(c.title);
  const channel = normalise(decodeHtml(c.channelTitle));
  // VEVO channels write the name as one word ("EllaLangleyVEVO"), so also compare without spaces.
  const squash = (x) => x.replace(/ /g, '');
  const isChannelOf = (artist) =>
    artist && (channel === `${artist} topic` || channel.includes(artist) || squash(channel).includes(squash(artist)));
  // A collaboration ("A Class & Pureojuice") is often uploaded by just one of the artists.
  if (creditedArtists(song.artist).some(isChannelOf)) s += 3;

  const songTitle = normalise(song.title);
  const video = normalise(videoTitle);
  const videoWords = new Set(video.split(' '));
  // Same words in another order counts too ("Kenpachi Zaraki" vs "ZARAKI KENPACHI").
  if (songTitle && (video.includes(songTitle) || songTitle.split(' ').every((w) => videoWords.has(w)))) s += 2;

  const rawTitle = videoTitle.toLowerCase();
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

/** YouTube's allowance resets at midnight Pacific time. Returns that moment (ms) after `t`. */
export function nextPacificMidnight(t) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const parts = (x) => Object.fromEntries(fmt.formatToParts(x).map((p) => [p.type, Number(p.value)]));
  const today = parts(t);
  const guess = Date.UTC(today.year, today.month - 1, today.day + 1, 8); // midnight in winter (UTC-8)
  return guess - parts(guess).hour * 3600_000; // in summer (UTC-7) that is 1am: step back an hour
}

async function getJson(fetch, url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // The daily allowance: older answers are 403 "quotaExceeded", newer ones 429 RESOURCE_EXHAUSTED.
    if (res.status === 429 || (res.status === 403 && /quotaExceeded|dailyLimitExceeded/.test(text))) {
      throw new QuotaError('quota');
    }
    throw new Error(`youtube ${res.status}`);
  }
  return res.json();
}

/** Searches once and returns the best-scoring playable video, or null. */
async function bestVideo({ fetch, key }, q, musicOnly, song) {
  const { durationS } = song;
  const search = await getJson(
    fetch,
    `${SEARCH_URL}?part=snippet&type=video&videoEmbeddable=true${musicOnly ? '&videoCategoryId=10' : ''}&maxResults=5` +
      `&q=${encodeURIComponent(q)}&key=${encodeURIComponent(key)}`,
  );
  const items = (search.items ?? []).filter((i) => i?.id?.videoId);
  if (!items.length) return null;
  const ids = items.map((i) => i.id.videoId).join(',');
  const details = await getJson(fetch, `${VIDEOS_URL}?part=contentDetails,status&id=${ids}&key=${encodeURIComponent(key)}`);
  const byId = new Map((details.items ?? []).map((d) => [d.id, d]));
  let best = null;
  for (const item of items) {
    const d = byId.get(item.id.videoId);
    if (!d || d.status?.embeddable !== true) continue;
    const videoS = parseIsoDuration(d.contentDetails?.duration);
    if (!videoS || videoS >= MAX_VIDEO_S) continue;
    if (durationS > 0 && Math.abs(videoS - durationS) > DURATION_WINDOW_S) continue;
    const candidate = {
      title: decodeHtml(item.snippet?.title),
      channelTitle: decodeHtml(item.snippet?.channelTitle),
      durationS: videoS,
    };
    const s = score(candidate, song);
    if (s >= MIN_SCORE && (!best || s > best.confidence)) {
      best = { videoId: item.id.videoId, title: candidate.title, channel: candidate.channelTitle, confidence: s };
    }
  }
  return best;
}

/**
 * @returns {Promise<{ videoId: string, title: string, channel: string, confidence: number }
 *   | { videoId: null, reason: 'no-match' | 'quota' | 'no-key' }>}
 */
export async function matchSong({ fetch, key, cache, now, quota }, { artist, title, durationS = 0 }) {
  const cacheKey = songKey(artist, title);
  const cached = await cache.get(cacheKey, now());
  // "No match" notes from before the plainer second search are not trusted: search again.
  const hit = cached && (cached.videoId || cached.rules === MATCH_RULES) ? cached : undefined;
  if (hit) {
    return hit.videoId
      ? { videoId: hit.videoId, title: hit.title, channel: hit.channel, confidence: hit.confidence }
      : { videoId: null, reason: 'no-match' };
  }
  if (!key) return { videoId: null, reason: 'no-key' };
  // Allowance used up: don't ask YouTube again (each refusal is wasted) until it resets.
  if (quota && now() < quota.until) return { videoId: null, reason: 'quota' };

  try {
    // Most songs are found as "official audio" in YouTube's Music category. Uploads outside it
    // (or titled differently) need a plainer search; that costs a second search, only on a miss.
    let best = await bestVideo({ fetch, key }, `${artist} ${title} official audio`, true, { artist, title, durationS });
    if (!best) best = await bestVideo({ fetch, key }, plainQuery(artist, title), false, { artist, title, durationS });
    await cache.set(cacheKey, best ? { ...best, at: now() } : { videoId: null, at: now(), rules: MATCH_RULES });
    return best ?? { videoId: null, reason: 'no-match' };
  } catch (err) {
    if (err instanceof QuotaError) {
      if (quota) quota.until = nextPacificMidnight(now());
      return { videoId: null, reason: 'quota' };
    }
    throw err;
  }
}
