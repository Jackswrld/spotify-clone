import type { Track } from './models';
import { exactKey } from './title';

/** "Rema & Selena Gomez" → "Rema". Only used to build a key, so "Simon & Garfunkel" → "Simon" is fine. */
export function leadArtist(name: string): string {
  return name.split(/\s*(?:&|,|\bfeat\.?|\bft\.?|\bfeaturing\b|\sx\s)\s*/i)[0].trim();
}

const EDITION = /\b(deluxe|ultra|expanded|edition|remaster(ed)?|anniversary)\b/i;

/** 0 = single (the original release), 1 = plain album, 2 = a later edition. */
function rank(track: Track): number {
  const album = track.albumName ?? '';
  if (/-\s*single$/i.test(album)) return 0;
  return EDITION.test(album) ? 2 : 1;
}

/**
 * Apple lists a song once for every release it is on (single, album, deluxe…). Keep one copy:
 * the best-ranked release, shown where the song first appeared. "(Remix)" and "(Live)" stay
 * separate songs because exactKey keeps brackets.
 */
export function dedupeSongs(tracks: Track[]): Track[] {
  const order: string[] = [];
  const best = new Map<string, Track>();
  for (const t of tracks) {
    const key = `${exactKey(leadArtist(t.artistName))}|${exactKey(t.title)}`;
    const current = best.get(key);
    if (!current) {
      order.push(key);
      best.set(key, t);
    } else if (rank(t) < rank(current)) {
      best.set(key, t);
    }
  }
  return order.map((k) => best.get(k)!);
}
