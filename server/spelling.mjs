// "Did you mean": corrects a misspelled search ("micheal jackson" → "Michael Jackson") using Deezer's
// top hit, which tolerates spelling mistakes better than Apple's search. Only fixes real mistakes:
// every word must match the hit's artist or title, and at least one needed a spelling fix.

import { normalise } from './youtube.mjs';

/** More words than this is a phrase or lyric search, never corrected. */
const MAX_WORDS = 5;

/** Edits between two words, counting a swap of neighbours as one ("micheal" / "michael"). */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Mistakes allowed in a word of this length: none for short words, where everything is "close". */
const allowed = (word) => (word.length >= 6 ? 2 : word.length >= 4 ? 1 : 0);

/**
 * @param {string} q what was typed
 * @param {{ artist: string, title: string } | null} hit Deezer's top song for it
 * @returns {string | null} the corrected search, or null when nothing needs fixing
 */
export function spellingFix(q, hit) {
  if (!hit) return null;
  const words = normalise(q).split(' ').filter(Boolean);
  if (!words.length || words.length > MAX_WORDS) return null;
  const artistWords = normalise(hit.artist).split(' ');
  const titleWords = normalise(hit.title).split(' ');
  let fixed = false;
  let usedArtist = false;
  let usedTitle = false;
  const exact = (w, targets) => targets.includes(w) || (w.length >= 3 && targets.some((t) => t.startsWith(w))); // or still typing
  const close = (w, targets) => targets.some((t) => editDistance(w, t) <= allowed(w));
  for (const w of words) {
    if (exact(w, artistWords)) usedArtist = true;
    else if (exact(w, titleWords)) usedTitle = true;
    else if (close(w, artistWords)) (usedArtist = true), (fixed = true);
    else if (close(w, titleWords)) (usedTitle = true), (fixed = true);
    else return null; // a word that isn't in the hit: the search is about something else
  }
  if (!fixed) return null;
  const cleanTitle = hit.title.replace(/\s*[([][^)\]]*[)\]]/g, '').trim();
  return [usedArtist ? hit.artist : '', usedTitle ? cleanTitle : ''].filter(Boolean).join(' ');
}
