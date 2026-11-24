import { Artist, Artwork, Playlist, Track } from '../models';

// Raw Audius API objects are loosely typed; only the fields we read are listed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = Record<string, any>;

function toArtwork(raw: Raw | null | undefined): Artwork {
  return {
    small: raw?.['150x150'] ?? null,
    medium: raw?.['480x480'] ?? null,
    large: raw?.['1000x1000'] ?? null,
  };
}

function splitTags(tags: unknown): string[] {
  if (typeof tags !== 'string') return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** True only for tracks that can be streamed in full by anyone. */
export function isPlayable(raw: Raw): boolean {
  return (
    raw['is_streamable'] === true &&
    raw['is_stream_gated'] !== true &&
    raw['stream_conditions'] == null &&
    raw['is_delete'] !== true &&
    raw['is_unlisted'] !== true &&
    raw['is_available'] !== false
  );
}

export function toTrack(raw: Raw): Track {
  const user: Raw = raw['user'] ?? {};
  return {
    id: String(raw['id']),
    title: raw['title'] ?? '',
    artistId: String(user['id'] ?? ''),
    artistName: user['name'] ?? '',
    artistHandle: user['handle'] ?? '',
    artistVerified: user['is_verified'] === true,
    duration: Number(raw['duration'] ?? 0),
    artwork: toArtwork(raw['artwork']),
    genre: raw['genre'] || null,
    mood: raw['mood'] || null,
    tags: splitTags(raw['tags']),
    description: raw['description'] || null,
    playCount: Number(raw['play_count'] ?? 0),
    likeCount: Number(raw['favorite_count'] ?? 0),
    repostCount: Number(raw['repost_count'] ?? 0),
    releaseDate: raw['release_date'] ?? null,
    permalink: raw['permalink'] ?? '',
    source: 'audius',
    appleId: null,
  };
}

export function toArtist(raw: Raw): Artist {
  return {
    id: String(raw['id']),
    name: raw['name'] ?? '',
    handle: raw['handle'] ?? '',
    verified: raw['is_verified'] === true,
    followerCount: Number(raw['follower_count'] ?? 0),
    trackCount: Number(raw['track_count'] ?? 0),
    playlistCount: Number(raw['playlist_count'] ?? 0),
    bio: raw['bio'] || null,
    avatar: toArtwork(raw['profile_picture']),
    coverPhoto: raw['cover_photo']?.['640x'] ?? null,
    permalink: '/' + (raw['handle'] ?? ''),
    source: 'audius',
  };
}

export function toPlaylist(raw: Raw): Playlist {
  const user: Raw = raw['user'] ?? {};
  return {
    id: String(raw['id']),
    name: raw['playlist_name'] ?? '',
    description: raw['description'] || null,
    isAlbum: raw['is_album'] === true,
    trackCount: Number(raw['track_count'] ?? 0),
    artwork: toArtwork(raw['artwork']),
    ownerId: String(user['id'] ?? ''),
    ownerName: user['name'] ?? '',
    permalink: raw['permalink'] ?? '',
    source: 'audius',
  };
}
