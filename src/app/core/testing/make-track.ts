import { Track } from '../models';

/** Test helper: a Track with sensible defaults. */
export function makeTrack(id: string, patch: Partial<Track> = {}): Track {
  return {
    id,
    title: `Song ${id}`,
    artistId: 'a1',
    artistName: 'Artist',
    artistHandle: 'artist',
    artistVerified: false,
    duration: 200,
    artwork: { small: null, medium: null, large: null },
    genre: null,
    mood: null,
    tags: [],
    description: null,
    playCount: 0,
    likeCount: 0,
    repostCount: 0,
    releaseDate: null,
    permalink: `/artist/song-${id}`,
    ...patch,
  };
}
