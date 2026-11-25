// Builds the relay for a hosting environment. On Vercel the song → video memory lives in Upstash
// Redis (its integration sets KV_REST_API_URL / KV_REST_API_TOKEN); without it, memory only.

import { createRedisMatchCache } from './redis-cache.mjs';
import { createRelay } from './relay.mjs';

/** @param {{ env: Record<string, string|undefined>, fetch: typeof fetch, cacheFile?: string }} deps */
export function createHandler({ env, fetch, cacheFile }) {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  const cache = url && token ? createRedisMatchCache({ url, token, fetch }) : undefined;
  return createRelay({ fetch, env, cacheFile, cache });
}
