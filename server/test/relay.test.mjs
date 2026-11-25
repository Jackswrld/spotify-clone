import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch, startRelay } from './helpers.mjs';

const APPLE = 'https://rss.marketingtools.apple.com/';
const feed = { feed: { results: [{ id: '1', name: 'Song', artistName: 'Artist' }] } };

test('health reports whether a YouTube key is set', async () => {
  let relay = await startRelay({ fetch: fakeFetch({}), env: {} });
  assert.deepEqual(await (await relay.get('/api/health')).json(), { ok: true, youtubeKey: false, geniusKey: false });
  await relay.close();
  relay = await startRelay({ fetch: fakeFetch({}), env: { YOUTUBE_API_KEY: 'k' } });
  assert.deepEqual(await (await relay.get('/api/health')).json(), { ok: true, youtubeKey: true, geniusKey: false });
  await relay.close();
});

test('charts proxies the Apple feed and caches for an hour', async () => {
  let now = 1_000_000;
  const fetch = fakeFetch({ [APPLE]: () => ({ body: feed }) });
  const relay = await startRelay({ fetch, env: {}, now: () => now });
  const first = await relay.get('/api/charts/us/songs/25');
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), feed);
  await relay.get('/api/charts/us/songs/25');
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0], 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/25/songs.json');
  now += 3_600_001;
  await relay.get('/api/charts/us/songs/25');
  assert.equal(fetch.calls.length, 2);
  await relay.close();
});

test('charts rejects unknown country, kind or limit with 400', async () => {
  const fetch = fakeFetch({ [APPLE]: () => ({ body: feed }) });
  const relay = await startRelay({ fetch, env: {} });
  for (const path of ['/api/charts/xx/songs/25', '/api/charts/us/videos/25', '/api/charts/us/songs/7']) {
    const res = await relay.get(path);
    assert.equal(res.status, 400, path);
    assert.deepEqual(await res.json(), { error: 'bad_request' });
  }
  assert.equal(fetch.calls.length, 0);
  await relay.close();
});

test('charts maps upstream failure to 502', async () => {
  const relay = await startRelay({ fetch: fakeFetch({ [APPLE]: () => ({ status: 503 }) }), env: {} });
  const res = await relay.get('/api/charts/us/albums/10');
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'upstream' });
  await relay.close();
});

test('CORS only for the dev origin', async () => {
  const relay = await startRelay({ fetch: fakeFetch({}), env: {} });
  const ok = await relay.get('/api/health', { Origin: 'http://localhost:4300' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:4300');
  const evil = await relay.get('/api/health', { Origin: 'http://evil.test' });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  await relay.close();
});

test('unknown route is 404', async () => {
  const relay = await startRelay({ fetch: fakeFetch({}), env: {} });
  assert.equal((await relay.get('/api/nope')).status, 404);
  await relay.close();
});

test('requests from other websites are refused before any upstream call', async () => {
  const fetch = fakeFetch({ [APPLE]: () => ({ body: feed }) });
  const relay = await startRelay({ fetch, env: { YOUTUBE_API_KEY: 'k' } });
  try {
  const match = '/api/youtube/match?artist=Rema&title=Calm%20Down';
  const evil = { origin: 'http://evil.test' };
  const crossSite = { 'sec-fetch-site': 'cross-site' };
  for (const headers of [evil, crossSite]) {
    assert.equal((await relay.get(match, headers)).status, 403);
    assert.equal((await relay.request(match, { method: 'DELETE', headers })).status, 403);
    assert.equal((await relay.get('/api/charts/us/songs/10', headers)).status, 403);
  }
  assert.equal(fetch.calls.length, 0);
  // The app itself (directly, or through the dev proxy with no Origin) still works.
  assert.equal((await relay.get('/api/charts/us/songs/10', { origin: 'http://localhost:4300' })).status, 200);
  assert.equal((await relay.get('/api/charts/us/songs/10', { 'sec-fetch-site': 'same-origin' })).status, 200);
  assert.equal((await relay.get('/api/health')).status, 200);
  } finally {
    await relay.close();
  }
});
