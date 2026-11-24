/** Where an item comes from: Audius (streams as audio) or the Apple catalog (plays via YouTube). */
export type TrackSource = 'audius' | 'catalog';

export interface Artwork {
  small: string | null;
  medium: string | null;
  large: string | null;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artistHandle: string;
  artistVerified: boolean;
  duration: number;
  artwork: Artwork;
  genre: string | null;
  mood: string | null;
  tags: string[];
  description: string | null;
  playCount: number;
  likeCount: number;
  repostCount: number;
  releaseDate: string | null;
  permalink: string;
  source: TrackSource;
  /** Apple track id for catalog songs; null for Audius. */
  appleId: string | null;
  albumId?: string | null;
  albumName?: string | null;
  appleUrl?: string | null;
}

export interface Artist {
  id: string;
  name: string;
  handle: string;
  verified: boolean;
  followerCount: number;
  trackCount: number;
  playlistCount: number;
  bio: string | null;
  avatar: Artwork;
  coverPhoto: string | null;
  permalink: string;
  source: TrackSource;
  appleUrl?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isAlbum: boolean;
  trackCount: number;
  artwork: Artwork;
  ownerId: string;
  ownerName: string;
  permalink: string;
  source?: 'audius';
}

/** An Apple catalog album or single. */
export interface Album {
  id: string;
  appleId: string;
  name: string;
  artistName: string;
  artistId: string;
  artwork: Artwork;
  releaseDate: string | null;
  trackCount: number;
  genre: string | null;
  appleUrl: string;
}

/** Old saved items predate `source`; they are all Audius. */
export function upgradeSource<T extends { source?: TrackSource }>(item: T): T & { source: TrackSource } {
  return { ...item, source: item.source ?? 'audius' };
}

export interface UserPlaylist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
}

export interface LyricLine {
  time: number;
  text: string;
}

export interface Lyrics {
  plain: string;
  lines: LyricLine[];
  instrumental: boolean;
}

export interface ArtistInfo {
  bio: string | null;
  tags: string[];
  url: string;
}
