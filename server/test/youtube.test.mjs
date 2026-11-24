import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMatchCache, matchSong, normalise, parseIsoDuration, score } from '../youtube.mjs';
import { fakeFetch, startRelay } from './helpers.mjs';

const SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS = 'https://www.googleapis.com/youtube/v3/videos';
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ytcache-')), 'cache.json');

/** Fake YouTube: search returns these candidates; videos returns their details. */
function fakeYouTube(candidates, { quota = false } = {}) {
  return fakeFetch({
    [SEARCH]: () =>
      quota
        ? { status: 403, body: { error: { errors: [{ reason: 'quotaExceeded' }] } } }
        : { body: { items: candidates.map((c) => ({ id: { videoId: c.id }, snippet: { title: c.title, channelTitle: c.channel } })) } },
    [VIDEOS]: () => ({
      body: {
        items: candidates.map((c) => ({
          id: c.id,
          contentDetails: { duration: c.duration },
          status: { embeddable: c.embeddable !== false },
        })),
      },
    }),
  });
}

const SONG = { artist: 'Rema', title: 'Calm Down', durationS: 239 };
const OFFICIAL = { id: 'ok1', title: 'Calm Down', channel: 'Rema - Topic', duration: 'PT4M' };
const COVER = { id: 'cv1', title: 'Calm Down (cover)', channel: 'Some Singer', duration: 'PT3M58S' };

test('normalise strips accents, brackets and feat', () => {
  assert.equal(normalise('Béyoncé'), 'beyonce');
  assert.equal(normalise('Calm Down (feat. Selena Gomez) [Remix]'), 'calm down');
  assert.equal(normalise('Song ft. Someone'), 'song');
});

test('parseIsoDuration reads hours, minutes and seconds', () => {
  assert.equal(parseIsoDuration('PT3M21S'), 201);
  assert.equal(parseIsoDuration('PT1H2M'), 3720);
  assert.equal(parseIsoDuration('PT45S'), 45);
});

test('official Topic channel beats a cover', () => {
  assert.ok(score({ title: 'Calm Down', channelTitle: 'Rema - Topic', durationS: 240 }, SONG) >= 3);
  assert.ok(score({ title: 'Calm Down (cover)', channelTitle: 'Some Singer', durationS: 238 }, SONG) < 3);
});

test('a song whose title contains "Live" is not penalised for it', () => {
  const song = { artist: 'Oasis', title: 'Live Forever', durationS: 276 };
  assert.ok(score({ title: 'Live Forever (Remastered)', channelTitle: 'Oasis - Topic', durationS: 277 }, song) >= 3);
  assert.ok(score({ title: 'Wonderwall (Live)', channelTitle: 'Oasis', durationS: 276 }, { ...song, title: 'Wonderwall' }) < 5);
});

test('picks the best candidate and filters wrong lengths and non-embeddable videos', async () => {
  const long = { id: 'long', title: 'Calm Down', channel: 'Rema - Topic', duration: 'PT5M' }; // 60 s off
  const blocked = { ...OFFICIAL, id: 'blk', embeddable: false };
  const fetch = fakeYouTube([COVER, long, blocked, OFFICIAL]);
  const result = await matchSong({ fetch, key: 'k', cache: createMatchCache(tmpFile()), now: () => 0 }, SONG);
  assert.equal(result.videoId, 'ok1');
  assert.equal(result.channel, 'Rema - Topic');
  assert.ok(fetch.calls[0].includes('videoEmbeddable=true'));
  assert.ok(fetch.calls[0].includes('videoCategoryId=10'));
  assert.ok(decodeURIComponent(fetch.calls[0]).includes('Rema Calm Down official audio'));
});

test('second request for the same song uses the cache (no search call)', async () => {
  const cache = createMatchCache(tmpFile());
  const fetch = fakeYouTube([OFFICIAL]);
  await matchSong({ fetch, key: 'k', cache, now: () => 0 }, SONG);
  const before = fetch.calls.length;
  const again = await matchSong({ fetch, key: 'k', cache, now: () => 1000 }, { ...SONG, title: 'CALM DOWN (feat. Selena Gomez)' });
  assert.equal(again.videoId, 'ok1');
  assert.equal(fetch.calls.length, before);
});

test('cache survives a restart (written to the file)', async () => {
  const file = tmpFile();
  await matchSong({ fetch: fakeYouTube([OFFICIAL]), key: 'k', cache: createMatchCache(file), now: () => 0 }, SONG);
  const fetch = fakeYouTube([OFFICIAL]);
  const result = await matchSong({ fetch, key: 'k', cache: createMatchCache(file), now: () => 0 }, SONG);
  assert.equal(result.videoId, 'ok1');
  assert.equal(fetch.calls.length, 0);
});

test('a corrupt cache file starts empty', () => {
  const file = tmpFile();
  fs.writeFileSync(file, '{not json');
  assert.equal(createMatchCache(file).get('x', 0), undefined);
});

test('no-match is cached for 7 days, then searched again', async () => {
  const cache = createMatchCache(tmpFile());
  const fetch = fakeYouTube([COVER]);
  const first = await matchSong({ fetch, key: 'k', cache, now: () => 0 }, SONG);
  assert.deepEqual(first, { videoId: null, reason: 'no-match' });
  const calls = fetch.calls.length;
  await matchSong({ fetch, key: 'k', cache, now: () => 6 * 86_400_000 }, SONG);
  assert.equal(fetch.calls.length, calls);
  await matchSong({ fetch, key: 'k', cache, now: () => 7 * 86_400_000 + 1 }, SONG);
  assert.ok(fetch.calls.length > calls);
});

test('quotaExceeded returns reason quota and is not cached', async () => {
  const cache = createMatchCache(tmpFile());
  const quota = await matchSong({ fetch: fakeYouTube([], { quota: true }), key: 'k', cache, now: () => 0 }, SONG);
  assert.deepEqual(quota, { videoId: null, reason: 'quota' });
  const fetch = fakeYouTube([OFFICIAL]);
  const later = await matchSong({ fetch, key: 'k', cache, now: () => 1 }, SONG);
  assert.equal(later.videoId, 'ok1');
});

test('missing key returns no-key without calling YouTube', async () => {
  const fetch = fakeYouTube([OFFICIAL]);
  const result = await matchSong({ fetch, key: '', cache: createMatchCache(tmpFile()), now: () => 0 }, SONG);
  assert.deepEqual(result, { videoId: null, reason: 'no-key' });
  assert.equal(fetch.calls.length, 0);
});

test('match route returns the match, validates input and rate-limits after 30 a minute', async () => {
  const relay = await startRelay({
    fetch: fakeYouTube([OFFICIAL]),
    env: { YOUTUBE_API_KEY: 'k' },
    cacheFile: tmpFile(),
    now: () => 0,
  });
  const ok = await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down&duration=239');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).videoId, 'ok1');
  assert.equal((await relay.get('/api/youtube/match?artist=Rema')).status, 400);
  let last;
  for (let i = 0; i < 30; i++) last = await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down');
  assert.equal(last.status, 429);
  assert.deepEqual(await last.json(), { error: 'rate_limited' });
  await relay.close();
});

test('match route without a key answers no-key', async () => {
  const relay = await startRelay({ fetch: fakeYouTube([OFFICIAL]), env: {}, cacheFile: tmpFile() });
  const res = await relay.get('/api/youtube/match?artist=Rema&title=Calm%20Down');
  assert.deepEqual(await res.json(), { videoId: null, reason: 'no-key' });
  await relay.close();
});
