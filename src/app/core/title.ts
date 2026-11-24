import type { Track } from './models';

/** Combining accents used by Latin letters (é → e). Other scripts' marks are kept (ド stays ド). */
const LATIN_ACCENTS = /[\u0300-\u036f]/g;

/** Lower case, Latin accents removed, anything that isn't a letter or digit (any script) → one space. */
function base(s: string): string {
  return s
    .normalize('NFD')
    .replace(LATIN_ACCENTS, '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Removes "(feat. X)", "[ft. X]" and trailing "feat. X" parts. */
function withoutFeat(s: string): string {
  return s
    .replace(/[([](?:feat|ft|featuring)\.?\s[^)\]]*[)\]]/gi, '')
    .replace(/\s(?:feat|ft|featuring)\.?\s.*$/i, '');
}

/**
 * Loose key for matching the same song across sources (also used by the relay cache):
 * drops every bracketed part ("(Remix)", "[Live]") and "feat." credits.
 */
export function normalise(s: string): string {
  return base(withoutFeat(s).replace(/\s*[([][^)\]]*[)\]]/g, ''));
}

/** Strict key for "exactly the same title": only "feat." credits, case and accents are ignored. */
export function exactKey(s: string): string {
  return base(withoutFeat(s));
}

/**
 * Audius (and some catalog) titles often repeat the artist ("Xsetra - Fragments"); LRCLIB matches on the
 * bare song title, so drop a leading "<artist> - ".
 */
export function lyricsTitle(track: Track): string {
  const prefix = `${track.artistName} - `;
  return track.title.toLowerCase().startsWith(prefix.toLowerCase())
    ? track.title.slice(prefix.length).trim()
    : track.title;
}

