import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeezer } from '../deezer.mjs';
import { fakeFetch, startRelay } from './helpers.mjs';

const ARTISTS = 'https://api.deezer.com/search/artist';
const TRACKS = 'https://api.deezer.com/search?';
const artist = (name, nb_fan, pic) => ({ name, nb_fan, picture_xl: pic });

function fakeDeezer() {
  return fakeFetch({
    [ARTISTS]: (url) =>
      decodeURIComponent(url).toLowerCase().includes('q=drake')
        ? { body: { data: [artist('Drake Bell', 2_000_000, 'bell.jpg'), artist('Drake', 500, 'band.jpg'), artist('DRAKE', 30_000_000, 'drake.jpg')] } }
        : { body: { data: [artist('Someone Else', 10, 'x.jpg')] } },
    [TRACKS]: () => ({
      body: {
        data: [
          { title: 'Calm Down (Piano rendition)', duration: 106, artist: { name: 'The Lullabeats' }, album: { cover_xl: 'piano.jpg' } },
          { title: 'Calm Down', duration: 239, artist: { name: 'Rema' }, album: { cover_xl: 'rema.jpg' } },
        ],
      },
    }),
  });
}

test('artistPhoto picks the exact-name match with the most fans, never a near name', async () => {
  const deezer = createDeezer({ fetch: fakeDeezer(), now: () => 0 });
  assert.deepEqual(await deezer.artistPhoto('Drake'), { image: 'drake.jpg', fans: 30_000_000 });
});

test('artistPhoto with no exact match gives no photo and no fans', async () => {
  const deezer = createDeezer({ fetch: fakeDeezer(), now: () => 0 });
  assert.deepEqual(await deezer.artistPhoto('Wizkid'), { image: null, fans: 0 });
});

test('artistPhoto remembers a name for 24 hours', async () => {
  const fetch = fakeDeezer();
  let t = 0;
  const deezer = createDeezer({ fetch, now: () => t });
  await deezer.artistPhoto('Drake');
  await deezer.artistPhoto('drake ');
  assert.equal(fetch.calls.length, 1);
  t = 24 * 3_600_000 + 1;
  await deezer.artistPhoto('Drake');
  assert.equal(fetch.calls.length, 2);
});

test('findTrack returns the exact artist + title match with its cover and length', async () => {
  const fetch = fakeDeezer();
  const deezer = createDeezer({ fetch, now: () => 0 });
  assert.deepEqual(await deezer.findTrack('Rema', 'Calm Down'), { cover: 'rema.jpg', durationS: 239 });
  assert.ok(decodeURIComponent(fetch.calls[0]).includes('artist:"Rema" track:"Calm Down"'));
  assert.equal(await deezer.findTrack('Charles Dickens', 'Great Expectations (Chap. 8)'), null);
});

test('artist-photo route answers, validates names and refuses other websites', async () => {
  const relay = await startRelay({ fetch: fakeDeezer(), env: {}, now: () => 0 });
  try {
    const ok = await relay.get('/api/artist-photo?name=Drake');
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { image: 'drake.jpg', fans: 30_000_000 });
    assert.equal((await relay.get('/api/artist-photo?name=%21%21')).status, 400);
    assert.equal((await relay.get(`/api/artist-photo?name=${'a'.repeat(201)}`)).status, 400);
    assert.equal((await relay.get('/api/artist-photo?name=Drake', { origin: 'http://evil.test' })).status, 403);
  } finally {
    await relay.close();
  }
});

test('artist-photo route answers 502 when Deezer is down', async () => {
  const relay = await startRelay({ fetch: fakeFetch({ [ARTISTS]: () => ({ status: 500 }) }), env: {}, now: () => 0 });
  try {
    assert.equal((await relay.get('/api/artist-photo?name=Drake')).status, 502);
  } finally {
    await relay.close();
  }
});

test('artist-photo allows 120 lookups a minute (a search asks for up to 10), then 429', async () => {
  const relay = await startRelay({ fetch: fakeDeezer(), env: {}, now: () => 0 });
  try {
    for (let i = 0; i < 120; i++) assert.equal((await relay.get(`/api/artist-photo?name=Artist${i}`)).status, 200);
    assert.equal((await relay.get('/api/artist-photo?name=One%20More')).status, 429);
  } finally {
    await relay.close();
  }
});
