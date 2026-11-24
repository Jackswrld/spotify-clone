import { Album, Artist, Track } from './models';

const APPLE_PREFIX = 'apple:';

/** Strips the "apple:" prefix used by catalog ids. */
export function appleIdOf(id: string): string {
  return id.startsWith(APPLE_PREFIX) ? id.slice(APPLE_PREFIX.length) : id;
}

/** Router link to a song's page: catalog songs → /song/:appleId, Audius → /track/:id. */
export function trackLink(t: Track): unknown[] {
  return t.source === 'catalog' ? ['/song', t.appleId ?? appleIdOf(t.id)] : ['/track', t.id];
}

/** Router link to the artist of a track, or to an artist. */
export function artistLink(item: Track | Artist): unknown[] {
  const isTrack = 'artistId' in item;
  const id = isTrack ? (item as Track).artistId : (item as Artist).id;
  return item.source === 'catalog' ? ['/catalog-artist', appleIdOf(id)] : ['/artist', id];
}

export function albumLink(a: Album): unknown[] {
  return ['/album', a.appleId];
}
