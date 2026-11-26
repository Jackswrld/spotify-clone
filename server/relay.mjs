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

/**
 * Websites allowed to use the relay: the local dev app, the Vercel site (Vercel sets these
 * variables on every deployment), and any extra ALLOWED_ORIGINS (comma-separated).
 */
export function allowedOrigins(env) {
  const vercel = [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .filter(Boolean)
    .map((host) => `https://${host}`);
  const extra = String(env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...DEV_ORIGINS, ...vercel, ...extra];
}

/** The visitor's address: on Vercel every request arrives through its proxy (x-forwarded-for). */
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || 'unknown';
}

function send(res, status, body, origin, allowed = DEV_ORIGINS) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (origin && allowed.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

/**
 * @param {{ fetch: typeof fetch, env: Record<string, string|undefined>, now?: () => number, cacheFile?: string, cache?: object }} deps
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void}
 */
export function createRelay({ fetch, env, now = Date.now, cacheFile, cache }) {
  const allowed = allowedOrigins(env);
  const fetchChart = createChartFetcher({ fetch, now });
  const matchCache = cache ?? createMatchCache(cacheFile);
  /** When YouTube's daily allowance is used up: { until: reset time (ms) }. */
  const quota = { until: 0 };
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
      if ((origin && !allowed.includes(origin)) || req.headers['sec-fetch-site'] === 'cross-site') {
        return send(res, 403, { error: 'forbidden' }, undefined, allowed);
      }
      if (req.method === 'OPTIONS') return send(res, 204, {}, origin, allowed);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return send(res, 200, { ok: true, youtubeKey: Boolean(env.YOUTUBE_API_KEY), geniusKey: Boolean(env.GENIUS_ACCESS_TOKEN) }, origin, allowed);
      }

      if (req.method === 'GET' && parts[0] === 'api' && parts[1] === 'charts' && parts.length === 5) {
        const [, , country, kind, limitText] = parts;
        const limit = Number(limitText);
        if (!isValidChart(country, kind, limit)) return send(res, 400, { error: 'bad_request' }, origin, allowed);
        try {
          return send(res, 200, await fetchChart(country, kind, limit), origin, allowed);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin, allowed);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/youtube/match') {
        if (rateLimited(clientIp(req))) return send(res, 429, { error: 'rate_limited' }, origin, allowed);
        const artist = (url.searchParams.get('artist') ?? '').trim();
        const title = (url.searchParams.get('title') ?? '').trim();
        // Names with no letters or digits would all share one cache entry: refuse them.
        if (!exactKey(artist) || !exactKey(title) || artist.length > 200 || title.length > 300) {
          return send(res, 400, { error: 'bad_request' }, origin, allowed);
        }
        const durationS = Math.max(0, Math.round(Number(url.searchParams.get('duration')) || 0));
        try {
          const result = await matchSong(
            { fetch, key: env.YOUTUBE_API_KEY ?? '', cache: matchCache, now, quota },
            { artist, title, durationS },
          );
          return send(res, 200, result, origin, allowed);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin, allowed);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/lyrics/search') {
        if (rateLimited(clientIp(req), 'lyrics')) return send(res, 429, { error: 'rate_limited' }, origin, allowed);
        const q = (url.searchParams.get('q') ?? '').trim();
        if (!exactKey(q) || q.length > 200) return send(res, 400, { error: 'bad_request' }, origin, allowed);
        try {
          return send(res, 200, await searchLyrics(q), origin, allowed);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin, allowed);
        }
      }

      if (req.method === 'GET' && url.pathname === '/api/artist-photo') {
        if (rateLimited(clientIp(req), 'photo')) return send(res, 429, { error: 'rate_limited' }, origin, allowed);
        const name = (url.searchParams.get('name') ?? '').trim();
        if (!exactKey(name) || name.length > 200) return send(res, 400, { error: 'bad_request' }, origin, allowed);
        try {
          return send(res, 200, await deezer.artistPhoto(name), origin, allowed);
        } catch {
          return send(res, 502, { error: 'upstream' }, origin, allowed);
        }
      }

      if (req.method === 'DELETE' && url.pathname === '/api/youtube/match') {
        // The app reports a matched video was removed or blocked from embedding.
        const artist = (url.searchParams.get('artist') ?? '').trim();
        const title = (url.searchParams.get('title') ?? '').trim();
        if (!artist || !title) return send(res, 400, { error: 'bad_request' }, origin, allowed);
        await matchCache.delete(songKey(artist, title));
        return send(res, 200, { ok: true }, origin, allowed);
      }

      return send(res, 404, { error: 'not_found' }, origin, allowed);
    } catch {
      return send(res, 500, { error: 'internal' }, origin, allowed);
    }
  };
}
