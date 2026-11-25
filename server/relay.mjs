// The music relay: a tiny HTTP server the app reaches at /api/* (proxied by `ng serve`).
// It fetches feeds the browser can't, and keeps the YouTube key off the client.

import { createChartFetcher, isValidChart } from './charts.mjs';
import { createDeezer } from './deezer.mjs';
import { createLyricsSearch } from './genius.mjs';
import { createMatchCache, exactKey, matchSong, songKey } from './youtube.mjs';

const DEV_ORIGINS = ['http://localhost:4300', 'http://127.0.0.1:4300'];
const MATCH_LIMIT_PER_MINUTE = 30;
/** One search looks up to 10 artist photos; Deezer allows far more. */
const LIMITS = { match: MATCH_LIMIT_PER_MINUTE, photo: 120, lyrics: MATCH_LIMIT_PER_MINUTE };

function send(res, status, body, origin) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin && DEV_ORIGINS.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

/**
 * @param {{ fetch: typeof fetch, env: Record<string, string|undefined>, now?: () => number, cacheFile?: string }} deps
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRelay({ fetch, env, now = Date.now, cacheFile }) {
  const fetchChart = createChartFetcher({ fetch, now });
  const matchCache = createMatchCache(cacheFile);
  const deezer = createDeezer({ fetch, now });
  const searchLyrics = createLyricsSearch({ fetch, token: env.GENIUS_ACCESS_TOKEN ?? '', now, deezer });
  /** route|ip → { windowStart, count } */
  const rate = new Map();

  function rateLimited(ip, route = 'match') {
    const key = `${route}|${ip}`;
    const t = now();
    const entry = rate.get(key);
    if (!entry || t - entry.windowStart >= 60_000) {
      rate.set(key, { windowStart: t, count: 1 });
      return false;
    }
    entry.count++;
    return entry.count > (LIMITS[route] ?? MATCH_LIMIT_PER_MINUTE);
  }

  return async function handle(req, res) {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? '/', 'http://relay.local');
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    try {
      // Another website open in the browser must not spend the YouTube quota. Requests with no
      // Origin (the dev proxy, curl) are allowed; browsers always label cross-site ones.
      if ((origin && !DEV_ORIGINS.includes(origin)) || req.headers['sec-fetch-site'] === 'cross-site') {
        return send(res, 403, { error: 'forbidden' }, undefined);
      }
      if (req.method === 'OPTIONS') return send(res, 204, {}, origin);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return send(res, 200, { ok: true, youtubeKey: Boolean(env.YOUTUBE_API_KEY), geniusKey: Boolean(env.GENIUS_ACCESS_TOKEN) }, origin);
      }

      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'charts' && parts.length === 5) {
        const [, , country, kind, limitText] = parts;
        const limit = Number(limitText);
        if (!isValidChart(country, kind, limit)) return send(res, 400, { error: 'bad_request' }, origin);
        try {
          return send(res, 200, await fetchChart(country, kind, limit), origin);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/youtube/match') {
        if (rateLimited(req.socket.remoteAddress ?? 'unknown')) return send(res, 429, { error: 'rate_limited' }, origin);
        const artist = (url.searchParams.get('artist') ?? '').trim();
        const title = (url.searchParams.get('title') ?? '').trim();
        // Names with no letters or digits would all share one cache entry: refuse them.
        if (!exactKey(artist) || !exactKey(title) || artist.length > 200 || title.length > 300) {
          return send(res, 400, { error: 'bad_request' }, origin);
        }
        const durationS = Math.max(0, Math.round(Number(url.searchParams.get('duration')) || 0));
        try {
          const result = await matchSong(
            { fetch, key: env.YOUTUBE_API_KEY ?? '', cache: matchCache, now },
            { artist, title, durationS },
          );
          return send(res, 200, result, origin);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/lyrics/search') {
        if (rateLimited(req.socket.remoteAddress ?? 'unknown', 'lyrics')) return send(res, 429, { error: 'rate_limited' }, origin);
        const q = (url.searchParams.get('q') ?? '').trim();
        if (!exactKey(q) || q.length > 200) return send(res, 400, { error: 'bad_request' }, origin);
        try {
          return send(res, 200, await searchLyrics(q), origin);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/artist-photo') {
        if (rateLimited(req.socket.remoteAddress ?? 'unknown', 'photo')) return send(res, 429, { error: 'rate_limited' }, origin);
        const name = (url.searchParams.get('name') ?? '').trim();
        if (!exactKey(name) || name.length > 200) return send(res, 400, { error: 'bad_request' }, origin);
        try {
          return send(res, 200, await deezer.artistPhoto(name), origin);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin);
        }
      }

      if (req.method === 'DELETE' && url.pathname === '/api/youtube/match') {
        // The app reports a matched video was removed or blocked from embedding.
        const artist = (url.searchParams.get('artist') ?? '').trim();
        const title = (url.searchParams.get('title') ?? '').trim();
        if (!artist || !title) return send(res, 400, { error: 'bad_request' }, origin);
        await matchCache.delete(songKey(artist, title));
        return send(res, 200, { ok: true }, origin);
      }

      return send(res, 404, { error: 'not_found' }, origin);
    } catch {
      return send(res, 500, { error: 'internal' }, origin);
    }
  };
}
