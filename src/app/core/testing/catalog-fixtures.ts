// Trimmed copies of real iTunes Search / Apple chart responses (recorded Nov 2026).

const ART = 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b2/b4/rema.jpg/100x100bb.jpg';

export const IT_SONG = {
  wrapperType: 'track',
  kind: 'song',
  artistId: 1304716885,
  collectionId: 1614063395,
  trackId: 1614063459,
  artistName: 'Rema',
  collectionName: 'Rave & Roses',
  trackName: 'Calm Down',
  artistViewUrl: 'https://music.apple.com/us/artist/rema/1304716885?uo=4',
  trackViewUrl: 'https://music.apple.com/us/album/calm-down/1614063395?i=1614063459&uo=4',
  artworkUrl100: ART,
  releaseDate: '2022-02-11T08:00:00Z',
  trackTimeMillis: 219669,
  primaryGenreName: 'Afrobeats',
  previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
};

export const IT_ARTIST = {
  wrapperType: 'artist',
  artistType: 'Artist',
  artistName: 'Rema',
  artistLinkUrl: 'https://music.apple.com/us/artist/rema/1304716885?uo=4',
  artistId: 1304716885,
  primaryGenreName: 'Afrobeats',
};

export const IT_ALBUM = {
  wrapperType: 'collection',
  collectionType: 'Album',
  collectionId: 6831560084,
  collectionName: 'E-Mortal Boy',
  artistName: 'Rema',
  artistId: 1304716885,
  artworkUrl100: ART,
  releaseDate: '2026-11-20T08:00:00Z',
  trackCount: 7,
  primaryGenreName: 'Afrobeats',
  collectionViewUrl: 'https://music.apple.com/us/album/e-mortal-boy/6831560084?uo=4',
};

export const IT_OLD_ALBUM = { ...IT_ALBUM, collectionId: 1614063395, collectionName: 'Rave & Roses', releaseDate: '2022-03-25T07:00:00Z' };

export const APPLE_CHART_SONGS = {
  feed: {
    title: 'Top Songs',
    results: [
      {
        artistName: 'Ella Langley',
        id: '1844932150',
        name: "Choosin' Texas",
        releaseDate: '2025-10-17',
        kind: 'songs',
        artistId: '1384373733',
        artistUrl: 'https://music.apple.com/us/artist/ella-langley/1384373733',
        artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e2/ella.jpg/100x100bb.jpg',
        genres: [{ genreId: '6', name: 'Country', url: 'https://itunes.apple.com/us/genre/id6' }],
        url: 'https://music.apple.com/us/album/choosin-texas/1844932149?i=1844932150',
      },
    ],
  },
};

export const APPLE_CHART_ALBUMS = {
  feed: {
    title: 'Top Albums',
    results: [
      {
        artistName: 'Rema',
        id: '6831560084',
        name: 'E-Mortal Boy',
        releaseDate: '2026-11-20',
        kind: 'albums',
        artistId: '1304716885',
        artworkUrl100: ART,
        genres: [{ genreId: '100051', name: 'Afrobeats' }],
        url: 'https://music.apple.com/us/album/e-mortal-boy/6831560084',
      },
    ],
  },
};
