import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler } from '../create-handler.mjs';

const REDIS = 'https://fake.upstash.io';

async function serve(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { get: (p, headers = {}) => fetch(base + p, { headers }), close: () => new Promise((r) => server.close(r)) };
}

/** YouTube + a fake Upstash; records Redis commands. */
function upstream() {
  const redis = new Map();
  const commands = [];
  const fn = async (url, init) => {
    const u = String(url);
    if (u === REDIS) {
      const [cmd, key, value] = JSON.parse(init.body);
      commands.push(cmd);
      if (cmd === 'SET') redis.set(key, value);
      return new Response(JSON.stringify({ result: cmd === 'GET' ? (redis.get(key) ?? null) : 'OK' }));
    }
    if (u.startsWith('https://www.googleapis.com/youtube/v3/search')) {
      return new Response(JSON.stringify({ items: [{ id: { videoId: 'ok1' }, snippet: { title: 'Calm Down', channelTitle: 'Rema - Topic' } }] }));
    }
    if (u.startsWith('https://www.googleapis.com/youtube/v3/videos')) {
      return new Response(JSON.stringify({ items: [{ id: 'ok1', contentDetails: { duration: 'PT4M' }, status: { embeddable: true } }] }));
    }
    return new Response('{}', { status: 404 });
  };
  return { fetch: fn, redis, commands };
}

test('with the Upstash settings Vercel provides, matches are remembered in Redis', async () => {
  const up = upstream();
  const env = { YOUTUBE_API_KEY: 'k', KV_REST_API_URL: REDIS, KV_REST_API_TOKEN: 't' };
  const relay = await serve(createHandler({ env, fetch: up.fetch }));
  try {
    const res = await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down&duration=239');
    assert.equal((await res.json()).videoId, 'ok1');
    assert.ok(up.redis.has('ytmatch:rema|calm down'));
  } finally {
    await relay.close();
  }
});

test('the UPSTASH_REDIS_REST_* names work too', async () => {
  const up = upstream();
  const env = { YOUTUBE_API_KEY: 'k', UPSTASH_REDIS_REST_URL: REDIS, UPSTASH_REDIS_REST_TOKEN: 't' };
  const relay = await serve(createHandler({ env, fetch: up.fetch }));
  try {
    await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down');
    assert.ok(up.commands.includes('SET'));
  } finally {
    await relay.close();
  }
});

test('without Redis it still works (memory only) and never touches Redis', async () => {
  const up = upstream();
  const relay = await serve(createHandler({ env: { YOUTUBE_API_KEY: 'k' }, fetch: up.fetch }));
  try {
    const res = await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down');
    assert.equal((await res.json()).videoId, 'ok1');
    assert.equal(up.commands.length, 0);
  } finally {
    await relay.close();
  }
});

test('the Vercel function file answers /api/health', async () => {
  const mod = await import('../../api/[...path].mjs');
  const relay = await serve(mod.default);
  try {
    const res = await relay.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  } finally {
    await relay.close();
  }
});

test('vercel.json: pages fall back to index.html, but /api/* always reaches the function', async () => {
  const fs = await import('node:fs');
  const config = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.outputDirectory, 'dist/spotify-clone/browser');
  const fallback = config.rewrites.find((r) => r.destination === '/index.html');
  const re = new RegExp(`^${fallback.source}$`);
  for (const page of ['/home', '/search', '/catalog-artist/309335750']) assert.ok(re.test(page), page);
  for (const api of ['/api/health', '/api/charts/us/songs/25']) assert.ok(!re.test(api), api);
});
