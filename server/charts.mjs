// Apple Music "most played" charts. Apple's feed doesn't allow browser calls, so the relay fetches it.

export const ALLOWED_COUNTRIES = [
  'us', 'gb', 'ng', 'gh', 'za', 'ke', 'ca', 'au', 'de', 'fr',
  'jp', 'br', 'in', 'mx', 'es', 'it', 'nl', 'se', 'kr', 'ie',
  'nz', 'ph', 'sg', 'ae', 'tr', 'pl', 'pt', 'be', 'dk', 'no',
];
export const ALLOWED_KINDS = ['songs', 'albums'];
export const ALLOWED_LIMITS = [10, 25, 50, 100];

const TTL_MS = 60 * 60 * 1000;

export function isValidChart(country, kind, limit) {
  return ALLOWED_COUNTRIES.includes(country) && ALLOWED_KINDS.includes(kind) && ALLOWED_LIMITS.includes(limit);
}

/** Fetches a chart, caching each (country, kind, limit) for an hour. Throws on upstream failure. */
export function createChartFetcher({ fetch, now }) {
  const cache = new Map();
  return async function fetchChart(country, kind, limit) {
    const key = `${country}/${kind}/${limit}`;
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.body;
    const url = `https://rss.marketingtools.apple.com/api/v2/${country}/music/most-played/${limit}/${kind}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const body = await res.json();
    cache.set(key, { body, expires: now() + TTL_MS });
    return body;
  };
}
