import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLyricsSearch } from '../genius.mjs';
import { fakeFetch, startRelay } from './helpers.mjs';

const GENIUS = 'https://api.genius.com/search';
const DEEZER_TRACK = 'https://api.deezer.com/search?';

const hit = (title, artist) => ({ type: 'song', result: { id: title.length, title, primary_artist: { name: artist } } });
const HITS = [
  hit('WORTHLESS', 'd4vd'),
  hit('Great Expectations (Chap. 8)', 'Charles Dickens'),
  hit('Start it up', 'Genius English Translations'),
  hit('Lesley', 'Dave'),
];
/** Deezer knows the real songs only. */
const KNOWN = { 'd4vd|WORTHLESS': 'worthless.jpg', 'Dave|Lesley': 'lesley.jpg' };

function fakeUpstream(hits = HITS) {
  const fetch = fakeFetch({
    [GENIUS]: () => ({ body: { meta: { status: 200 }, response: { hits } } }),
    [DEEZER_TRACK]: (url) => {
      const q = new URL(url).searchParams.get('q');
      const match = Object.entries(KNOWN).find(([key]) => q === key.replace('|', ' '));
      if (!match) return { body: { data: [] } };
      const [artist, title] = match[0].split('|');
      return { body: { data: [{ title, duration: 180, artist: { name: artist }, album: { cover_xl: match[1] } }] } };
    },
  });
  return fetch;
}

/** fakeFetch records URLs only; this also records the headers each call sent. */
function withHeaders(fetch) {
  const headers = [];
  const wrapped = async (url, init) => {
    headers.push(init?.headers ?? {});
    return fetch(url, init);
  };
  wrapped.calls = fetch.calls;
  wrapped.headers = headers;
  return wrapped;
}

test('lyric search keeps real songs (confirmed on Deezer), drops books and Genius translation pages', async () => {
  const fetch = withHeaders(fakeUpstream());
  const search = createLyricsSearch({ fetch, token: 'tok', now: () => 0 });
  const out = await search('left the party with a girl');
  assert.deepEqual(out, {
    results: [
      { title: 'WORTHLESS', artist: 'd4vd', image: 'worthless.jpg', geniusId: 9, durationS: 180 },
      { title: 'Lesley', artist: 'Dave', image: 'lesley.jpg', geniusId: 6, durationS: 180 },
    ],
  });
  assert.equal(fetch.headers[0].Authorization, 'Bearer tok');
  assert.ok(decodeURIComponent(fetch.calls[0]).includes('q=left the party with a girl'));
  assert.ok(!fetch.calls.some((u) => decodeURIComponent(u).includes('Genius English Translations')));
});

test('at most 10 results', async () => {
  const many = Array.from({ length: 15 }, () => hit('WORTHLESS', 'd4vd'));
  const search = createLyricsSearch({ fetch: fakeUpstream(many), token: 'tok', now: () => 0 });
  assert.equal((await search('worthless')).results.length, 10);
});

test('the same query within 24 hours does not ask Genius again', async () => {
  const fetch = fakeUpstream();
  let t = 0;
  const search = createLyricsSearch({ fetch, token: 'tok', now: () => t });
  await search('left the party');
  await search('Left the party ');
  assert.equal(fetch.calls.filter((u) => u.startsWith(GENIUS)).length, 1);
  t = 24 * 3_600_000 + 1;
  await search('left the party');
  assert.equal(fetch.calls.filter((u) => u.startsWith(GENIUS)).length, 2);
});

test('without a token it answers no-key and calls nobody', async () => {
  const fetch = fakeUpstream();
  const search = createLyricsSearch({ fetch, token: '', now: () => 0 });
  assert.deepEqual(await search('anything here'), { results: [], reason: 'no-key' });
  assert.equal(fetch.calls.length, 0);
});

test('lyrics route: answers, validates, refuses other websites, 502 when Genius is down', async () => {
  let relay = await startRelay({ fetch: fakeUpstream(), env: { GENIUS_ACCESS_TOKEN: 'tok' }, now: () => 0 });
  try {
    const ok = await relay.get('/api/lyrics/search?q=left%20the%20party%20%22quoted%22%20%F0%9F%8E%B5');
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).results.length, 2);
    assert.equal((await relay.get(`/api/lyrics/search?q=${'a'.repeat(201)}`)).status, 400);
    assert.equal((await relay.get('/api/lyrics/search?q=%21%21')).status, 400);
    assert.equal((await relay.get('/api/lyrics/search?q=hello', { origin: 'http://evil.test' })).status, 403);
  } finally {
    await relay.close();
  }
  relay = await startRelay({ fetch: fakeFetch({ [GENIUS]: () => ({ status: 500 }) }), env: { GENIUS_ACCESS_TOKEN: 'tok' }, now: () => 0 });
  try {
    assert.equal((await relay.get('/api/lyrics/search?q=hello%20there')).status, 502);
  } finally {
    await relay.close();
  }
});

test('health reports whether lyric search is set up', async () => {
  const relay = await startRelay({ fetch: fakeFetch({}), env: { GENIUS_ACCESS_TOKEN: 'tok' } });
  try {
    assert.deepEqual(await (await relay.get('/api/health')).json(), { ok: true, youtubeKey: false, geniusKey: true });
  } finally {
    await relay.close();
  }
});

test('Deezer down: the search fails (route 502) instead of "no songs", and nothing is cached', async () => {
  const genius = fakeUpstream();
  const fetch = async (url, init) => {
    if (String(url).startsWith(DEEZER_TRACK)) return new Response('down', { status: 503 });
    return genius(url, init);
  };
  const search = createLyricsSearch({ fetch, token: 'tok', now: () => 0 });
  await assert.rejects(search('left the party'));
  await assert.rejects(search('left the party'));
  assert.equal(genius.calls.filter((u) => u.startsWith(GENIUS)).length, 2);
});

test('when only some Deezer checks fail, the hits found are returned but not cached', async () => {
  const genius = fakeUpstream();
  let failDave = true;
  const fetch = async (url, init) => {
    const q = String(url).startsWith(DEEZER_TRACK) ? new URL(url).searchParams.get('q') : '';
    if (failDave && q === 'Dave Lesley') return new Response('down', { status: 503 });
    return genius(url, init);
  };
  const search = createLyricsSearch({ fetch, token: 'tok', now: () => 0 });
  assert.deepEqual((await search('left the party')).results.map((r) => r.title), ['WORTHLESS']);
  failDave = false;
  assert.deepEqual((await search('left the party')).results.map((r) => r.title), ['WORTHLESS', 'Lesley']);
});
