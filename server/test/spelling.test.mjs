import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spellingFix } from '../spelling.mjs';
import { fakeFetch, startRelay } from './helpers.mjs';

const top = (artist, title) => ({ artist, title });

test('a misspelled artist is corrected to the real name ("micheal jackson" → Michael Jackson)', () => {
  assert.equal(spellingFix('micheal jackson', top('Michael Jackson', 'Rock with You (Single Version)')), 'Michael Jackson');
});

test('a misspelled title is corrected to the song title', () => {
  assert.equal(spellingFix('helo', top('Adele', 'Hello')), 'Hello');
  assert.equal(spellingFix('beyonse halo', top('Beyoncé', 'Halo')), 'Beyoncé Halo');
});

test('a correct search is left alone', () => {
  assert.equal(spellingFix('olivia rodrigo', top('Olivia Rodrigo', 'the cure')), null);
  assert.equal(spellingFix('calm down', top('Rema', 'Calm Down')), null);
  assert.equal(spellingFix('drak', top('Drake', 'Janice STFU')), null); // an unfinished word is not a mistake
});

test('a search about something else is never "corrected" into the top hit', () => {
  assert.equal(spellingFix('love songs for rainy days', top('Adele', 'Hello')), null);
  assert.equal(spellingFix('i just left the party with a girl', top('d4vd', 'WORTHLESS')), null);
  assert.equal(spellingFix('cat', top('Cardi B', 'WAP')), null); // short words need an exact match
});

test('the suggest route asks Deezer once and answers { suggestion }', async () => {
  const fetch = fakeFetch({
    'https://api.deezer.com/search': () => ({ body: { data: [{ title: 'Rock with You', artist: { name: 'Michael Jackson' } }] } }),
  });
  const relay = await startRelay({ fetch, env: {}, cacheFile: null });
  try {
    const get = (q) => relay.get(`/api/search/suggest?q=${encodeURIComponent(q)}`, { Origin: 'http://localhost:4300' });
    const res = await get('micheal jackson');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { suggestion: 'Michael Jackson' });
    await get('micheal jackson');
    assert.equal(fetch.calls.length, 1); // remembered
    assert.equal((await get('')).status, 400);
  } finally {
    await relay.close();
  }
});

test('the suggest route answers no suggestion when Deezer is down (search still works)', async () => {
  const relay = await startRelay({ fetch: fakeFetch({ 'https://api.deezer.com/search': () => ({ status: 503 }) }), env: {}, cacheFile: null });
  try {
    const res = await relay.get('/api/search/suggest?q=micheal', { Origin: 'http://localhost:4300' });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { suggestion: null });
  } finally {
    await relay.close();
  }
});
