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
