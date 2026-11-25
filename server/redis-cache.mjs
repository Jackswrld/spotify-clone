// The song → YouTube video memory in Upstash Redis, for Vercel (functions can't keep files).
// Uses Upstash's REST API directly, so no extra dependency. Same interface as createMatchCache,
// but async. Redis trouble never breaks playback: a failed read is a miss, a failed write is ignored.

const NO_MATCH_TTL_S = 7 * 24 * 60 * 60;
const PREFIX = 'ytmatch:';

/** @param {{ url: string, token: string, fetch: typeof fetch }} deps */
export function createRedisMatchCache({ url, token, fetch }) {
  async function command(args) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`redis ${res.status}`);
    const body = await res.json();
    if (body?.error) throw new Error(body.error);
    return body?.result ?? null;
  }

  return {
    async get(key) {
      try {
        const raw = await command(['GET', PREFIX + key]);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    async set(key, entry) {
      // "No match" is retried after 7 days (the file cache's rule); found videos are kept.
      const expiry = entry.videoId === null ? ['EX', NO_MATCH_TTL_S] : [];
      try {
        await command(['SET', PREFIX + key, JSON.stringify(entry), ...expiry]);
      } catch {
        // Losing the memory costs a search later, never the match.
      }
    },
    async delete(key) {
      try {
        await command(['DEL', PREFIX + key]);
      } catch {
        // Nothing to do: the next play re-checks anyway.
      }
    },
  };
}
