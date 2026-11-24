// The music relay: a tiny HTTP server the app reaches at /api/* (proxied by `ng serve`).
// It fetches feeds the browser can't, and keeps the YouTube key off the client.

import { createChartFetcher, isValidChart } from './charts.mjs';

const DEV_ORIGINS = ['http://localhost:4300'];

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
  void cacheFile; // used by the YouTube route

  return async function handle(req, res) {
    const origin = req.headers.origin;
    const url = new URL(req.url ?? '/', 'http://relay.local');
    const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

    try {
      if (req.method === 'OPTIONS') return send(res, 204, {}, origin);

      if (req.method === 'GET' && url.pathname === '/api/health') {
        return send(res, 200, { ok: true, youtubeKey: Boolean(env.YOUTUBE_API_KEY) }, origin);
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

      return send(res, 404, { error: 'not_found' }, origin);
    } catch {
      return send(res, 500, { error: 'internal' }, origin);
    }
  };
}
