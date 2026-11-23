// Trimmed copies of real API responses (recorded Nov 2026). Tests never call real APIs.

const artwork = (base: string) => ({
  '150x150': `${base}/150x150.jpg`,
  '480x480': `${base}/480x480.jpg`,
  '1000x1000': `${base}/1000x1000.jpg`,
});

export const RAW_USER = {
  id: 'M33MVx',
  name: 'Xsetra',
  handle: 'Xsetra',
  is_verified: false,
  follower_count: 15,
  track_count: 4,
  playlist_count: 1,
  bio: 'Drum and bass producer.',
  profile_picture: artwork('https://cdn.test/avatar'),
  cover_photo: { '640x': 'https://cdn.test/cover/640x.jpg', '2000x': 'https://cdn.test/cover/2000x.jpg' },
};

export const RAW_TRACK = {
  id: 'V66vyPP',
  title: 'Xsetra - Fragments',
  duration: 212,
  genre: 'Drum & Bass',
  mood: 'Fiery',
  tags: 'lofi, chill,',
  description: 'A rolling roller.',
  artwork: artwork('https://cdn.test/track'),
  is_streamable: true,
  is_stream_gated: false,
  stream_conditions: null as unknown,
  is_delete: false,
  is_unlisted: false,
  is_available: true,
  permalink: '/Xsetra/xsetra-fragments',
  play_count: 1796,
  favorite_count: 92,
  repost_count: 100,
  release_date: '2026-10-22T13:00:00Z',
  user: RAW_USER,
};

export const RAW_GATED_TRACK = {
  ...RAW_TRACK,
  id: 'Gated1',
  is_stream_gated: true,
  stream_conditions: { usdc_purchase: {} } as unknown,
};

export const RAW_PLAYLIST = {
  id: '4W67oyr',
  playlist_name: 'Hot & New: 10/19/26',
  description: null as string | null,
  is_album: false,
  track_count: 21,
  artwork: artwork('https://cdn.test/playlist'),
  permalink: '/hotandnew/playlist/hot-new-101926-1',
  user: { ...RAW_USER, id: 'Own1', name: 'Hot & New', handle: 'hotandnew' },
};
