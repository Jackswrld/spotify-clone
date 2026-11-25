import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRedisMatchCache } from '../redis-cache.mjs';
import { matchSong } from '../youtube.mjs';
import { fakeFetch } from './helpers.mjs';

const URL_ = 'https://fake.upstash.io';

/** A tiny in-memory Upstash: answers POST [command, ...args] bodies; records them. */
function fakeUpstash({ failing = false } = {}) {
  const store = new Map();
  const commands = [];
  const fetch = async (url, init) => {
    if (String(url) !== URL_) return new Response('{}', { status: 404 });
    if (failing) return new Response('down', { status: 503 });
    assert.equal(init.headers.Authorization, 'Bearer secret');
    const [cmd, key, value, ...rest] = JSON.parse(init.body);
    commands.push([cmd, key, value, ...rest]);
    let result = null;
    if (cmd === 'GET') result = store.get(key) ?? null;
    if (cmd === 'SET') {
      store.set(key, value);
      result = 'OK';
    }
    if (cmd === 'DEL') result = store.delete(key) ? 1 : 0;
    return new Response(JSON.stringify({ result }), { status: 200 });
  };
  return { fetch, store, commands };
}

test('set then get returns the entry, stored under a prefixed key', async () => {
  const up = fakeUpstash();
  const cache = createRedisMatchCache({ url: URL_, token: 'secret', fetch: up.fetch });
  const entry = { videoId: 'v1', title: 't', channel: 'c', confidence: 5, at: 0 };
  await cache.set('rema|calm down', entry);
  assert.deepEqual(await cache.get('rema|calm down', 0), entry);
  assert.ok(up.store.has('ytmatch:rema|calm down'));
});

test('a no-match entry expires after 7 days in Redis; a found video does not expire', async () => {
  const up = fakeUpstash();
  const cache = createRedisMatchCache({ url: URL_, token: 'secret', fetch: up.fetch });
  await cache.set('a|none', { videoId: null, at: 0 });
  await cache.set('a|found', { videoId: 'v', at: 0 });
  const sets = up.commands.filter((c) => c[0] === 'SET');
  assert.deepEqual(sets[0].slice(3), ['EX', 604800]);
  assert.deepEqual(sets[1].slice(3), []);
});

test('delete removes the entry', async () => {
  const up = fakeUpstash();
  const cache = createRedisMatchCache({ url: URL_, token: 'secret', fetch: up.fetch });
  await cache.set('k', { videoId: 'v', at: 0 });
  await cache.delete('k');
  assert.equal(await cache.get('k', 0), undefined);
});

test('Redis down never breaks playback: a read is a miss, a write is ignored', async () => {
  const up = fakeUpstash({ failing: true });
  const cache = createRedisMatchCache({ url: URL_, token: 'secret', fetch: up.fetch });
  assert.equal(await cache.get('k', 0), undefined);
  await cache.set('k', { videoId: 'v', at: 0 });
  await cache.delete('k');
});

test('matchSong uses the Redis memory: the second play of a song makes no YouTube search', async () => {
  const up = fakeUpstash();
  const youtube = fakeFetch({
    'https://www.googleapis.com/youtube/v3/search': () => ({
      body: { items: [{ id: { videoId: 'ok1' }, snippet: { title: 'Calm Down', channelTitle: 'Rema - Topic' } }] },
    }),
    'https://www.googleapis.com/youtube/v3/videos': () => ({
      body: { items: [{ id: 'ok1', contentDetails: { duration: 'PT4M' }, status: { embeddable: true } }] },
    }),
  });
  const fetch = (url, init) => (String(url) === URL_ ? up.fetch(url, init) : youtube(url, init));
  const cache = createRedisMatchCache({ url: URL_, token: 'secret', fetch });
  const song = { artist: 'Rema', title: 'Calm Down', durationS: 239 };
  assert.equal((await matchSong({ fetch, key: 'k', cache, now: () => 0 }, song)).videoId, 'ok1');
  const searches = youtube.calls.length;
  assert.equal((await matchSong({ fetch, key: 'k', cache, now: () => 1 }, song)).videoId, 'ok1');
  assert.equal(youtube.calls.length, searches);
});
