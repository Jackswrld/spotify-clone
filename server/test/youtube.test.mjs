import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMatchCache, matchSong, normalise, parseIsoDuration, score, songKey } from '../youtube.mjs';
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

test('DELETE match forgets a cached video so the next play searches again', async () => {
  const fetch = fakeYouTube([OFFICIAL]);
  const relay = await startRelay({ fetch, env: { YOUTUBE_API_KEY: 'k' }, cacheFile: tmpFile(), now: () => 0 });
  const path = '/api/youtube/match?artist=Rema&title=Calm%20Down';
  await relay.get(path);
  const calls = fetch.calls.length;
  await relay.get(path);
  assert.equal(fetch.calls.length, calls); // cached
  const del = await relay.request(path, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.deepEqual(await del.json(), { ok: true });
  await relay.get(path);
  assert.ok(fetch.calls.length > calls);
  assert.equal((await relay.request('/api/youtube/match?artist=Rema', { method: 'DELETE' })).status, 400);
  await relay.close();
});

test('non-Latin titles keep their letters and get distinct keys', () => {
  assert.equal(normalise('夜に駆ける'), '夜に駆ける');
  assert.equal(normalise('Кино'), 'кино');
  assert.notEqual(songKey('YOASOBI', '夜に駆ける'), songKey('YOASOBI', 'アイドル'));
  assert.notEqual(songKey('아이유', '좋은 날'), songKey('아이유', '밤편지'));
});

test('a remix or live version does not share the original song key; feat. credits still do', () => {
  assert.notEqual(songKey('Rema', 'Calm Down (Remix)'), songKey('Rema', 'Calm Down'));
  assert.notEqual(songKey('Oasis', 'Wonderwall (Live)'), songKey('Oasis', 'Wonderwall'));
  assert.equal(songKey('Rema', 'Calm Down (feat. Selena Gomez)'), songKey('rema', 'CALM DOWN'));
});

test('a non-Latin song can match its official video', () => {
  const song = { artist: 'YOASOBI', title: '夜に駆ける', durationS: 261 };
  assert.ok(score({ title: '夜に駆ける', channelTitle: 'YOASOBI - Topic', durationS: 261 }, song) >= 3);
});

test('match route rejects names with no letters or digits instead of caching them', async () => {
  const fetch = fakeYouTube([OFFICIAL]);
  const relay = await startRelay({ fetch, env: { YOUTUBE_API_KEY: 'k' }, cacheFile: tmpFile() });
  const res = await relay.get('/api/youtube/match?artist=%21%21&title=%3F%3F');
  assert.equal(res.status, 400);
  assert.equal(fetch.calls.length, 0);
  await relay.close();
});

test('Japanese voicing marks are kept (only Latin accents are removed)', () => {
  assert.equal(normalise('アイドル'), 'アイドル');
  assert.notEqual(songKey('X', 'ぶ'), songKey('X', 'ふ'));
});

test('YouTube titles arrive HTML-encoded; an apostrophe or & still matches', () => {
  const song = { artist: 'Ella Langley', title: "Choosin' Texas", durationS: 232 };
  // Title (+2) and length (+2) only — the channel isn't the artist's.
  assert.ok(score({ title: 'Ella Langley - Choosin&#39; Texas (Official Lyric Video)', channelTitle: 'Some Uploader', durationS: 232 }, song) >= 4);
  // Channel only (+3): "Simon &amp; Garfunkel" must read as "Simon & Garfunkel".
  const amp = { artist: 'Simon & Garfunkel', title: 'Cecilia', durationS: 0 };
  assert.ok(score({ title: 'Something else', channelTitle: 'Simon &amp; Garfunkel', durationS: 0 }, amp) >= 3);
});

test('a VEVO channel that writes the artist as one word counts as the artist', () => {
  const song = { artist: 'Ella Langley', title: "Choosin' Texas", durationS: 232 };
  assert.ok(score({ title: 'Something else', channelTitle: 'EllaLangleyVEVO', durationS: 0 }, song) >= 3);
});

test('the match result carries the decoded video title', async () => {
  const fetch = fakeYouTube([{ id: 'el1', title: 'Ella Langley - Choosin&#39; Texas (Official Lyric Video)', channel: 'EllaLangleyVEVO', duration: 'PT3M52S' }]);
  const result = await matchSong({ fetch, key: 'k', cache: createMatchCache(tmpFile()), now: () => 0 }, { artist: 'Ella Langley', title: "Choosin' Texas", durationS: 232 });
  assert.equal(result.videoId, 'el1');
  assert.equal(result.title, "Ella Langley - Choosin' Texas (Official Lyric Video)");
});

// ---- Songs the first search misses (e.g. Pureojuice's anime UK drill uploads) ----

const PJ = (title, durationS) => ({ title, channelTitle: 'Pure O Juice', durationS });

test('a collaboration matches when the channel belongs to any credited artist', () => {
  const song = { artist: 'A Class & Pureojuice', title: 'KENPACHI ZARAKI (Bleach UK Drill)', durationS: 142 };
  assert.ok(score(PJ('ZARAKI KENPACHI (BLEACH UK DRILL) @prodbyaclass', 139), song) >= 3);
});

test('the title still counts when its words come in a different order', () => {
  const song = { artist: 'Pureojuice', title: 'Kenpachi Zaraki', durationS: 0 };
  const swapped = score(PJ('ZARAKI KENPACHI (BLEACH UK DRILL)', 139), song);
  const same = score(PJ('KENPACHI ZARAKI (BLEACH UK DRILL)', 139), song);
  assert.equal(swapped, same);
});

test('a one-word title does not match a video that only shares an unrelated word', () => {
  const song = { artist: 'Someone Else', title: 'Drill', durationS: 0 };
  assert.ok(score(PJ('Naruto UK Drill', 177), song) < 3);
});

test('when the first search finds nothing, a plainer search (no category, no brackets) is tried', async () => {
  const queries = [];
  const fetch = fakeFetch({
    'https://www.googleapis.com/youtube/v3/search': (url) => {
      const u = new URL(url);
      queries.push({ q: u.searchParams.get('q'), category: u.searchParams.get('videoCategoryId') });
      if (u.searchParams.get('videoCategoryId')) {
        return { body: { items: [{ id: { videoId: 'wrong' }, snippet: { title: 'Demon slang', channelTitle: 'Mikelangelo - Topic' } }] } };
      }
      return { body: { items: [{ id: { videoId: 'pj1' }, snippet: { title: 'DEMON SLAYER UK DRILL (HINOKAMI KAGURA BOP) (PROD BY CJ)', channelTitle: 'Pure O Juice' } }] } };
    },
    'https://www.googleapis.com/youtube/v3/videos': (url) => ({
      body: {
        items: new URL(url).searchParams.get('id').split(',').map((id) => ({
          id, contentDetails: { duration: id === 'pj1' ? 'PT2M47S' : 'PT2M4S' }, status: { embeddable: true },
        })),
      },
    }),
  });
  const cache = createMatchCache(null);
  const song = { artist: 'Pureojuice', title: 'Demon Slayer Uk Drill (Hinokami Kagura Bop)', durationS: 170 };
  const result = await matchSong({ fetch, key: 'k', cache, now: () => 0 }, song);
  assert.equal(result.videoId, 'pj1');
  assert.equal(queries.length, 2);
  assert.equal(queries[1].category, null);
  assert.equal(queries[1].q, 'Pureojuice Demon Slayer Uk Drill');
});

test('a song found by the first search makes only one search', async () => {
  const fetch = fakeYouTube([OFFICIAL]);
  await matchSong({ fetch, key: 'k', cache: createMatchCache(null), now: () => 0 }, { artist: 'Rema', title: 'Calm Down', durationS: 239 });
  assert.equal(fetch.calls.filter((u) => u.includes('/search')).length, 1);
});

test('a "no match" saved before the plainer search existed is searched again', async () => {
  const fetch = fakeYouTube([OFFICIAL]);
  const cache = createMatchCache(null);
  cache.set(songKey('Rema', 'Calm Down'), { videoId: null, at: 0 }); // old note, no version
  const result = await matchSong({ fetch, key: 'k', cache, now: () => 1 }, SONG);
  assert.equal(result.videoId, 'ok1');
});

test('a "no match" saved with the current rules is still trusted', async () => {
  const fetch = fakeYouTube([]);
  const cache = createMatchCache(null);
  await matchSong({ fetch, key: 'k', cache, now: () => 0 }, SONG);
  const searches = fetch.calls.length;
  await matchSong({ fetch, key: 'k', cache, now: () => 1 }, SONG);
  assert.equal(fetch.calls.length, searches);
});
