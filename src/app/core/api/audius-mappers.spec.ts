import { isPlayable, toArtist, toPlaylist, toTrack } from './audius-mappers';
import { RAW_GATED_TRACK, RAW_PLAYLIST, RAW_TRACK, RAW_USER } from '../testing/fixtures';

describe('audius mappers', () => {
  it('maps a raw track', () => {
    const t = toTrack(RAW_TRACK);
    expect(t.id).toBe(RAW_TRACK.id);
    expect(t.artistName).toBe(RAW_TRACK.user.name);
    expect(t.artistId).toBe(RAW_TRACK.user.id);
    expect(t.artwork.medium).toBe(RAW_TRACK.artwork['480x480']);
    expect(t.tags).toEqual(['lofi', 'chill']);
    expect(t.likeCount).toBe(RAW_TRACK.favorite_count);
  });

  it('maps null tags and missing artwork', () => {
    const t = toTrack({ ...RAW_TRACK, tags: null, artwork: null });
    expect(t.tags).toEqual([]);
    expect(t.artwork).toEqual({ small: null, medium: null, large: null });
  });

  it('isPlayable rejects gated, unstreamable, deleted, unlisted, unavailable', () => {
    expect(isPlayable(RAW_TRACK)).toBeTrue();
    expect(isPlayable(RAW_GATED_TRACK)).toBeFalse();
    const patches = [
      { is_streamable: false },
      { is_delete: true },
      { is_unlisted: true },
      { is_available: false },
      { stream_conditions: {} },
    ];
    for (const patch of patches) {
      expect(isPlayable({ ...RAW_TRACK, ...patch })).withContext(JSON.stringify(patch)).toBeFalse();
    }
  });

  it('maps artist permalink from handle', () => {
    expect(toArtist(RAW_USER).permalink).toBe('/' + RAW_USER.handle);
    expect(toArtist(RAW_USER).coverPhoto).toBe(RAW_USER.cover_photo['640x']);
  });

  it('maps a playlist', () => {
    const p = toPlaylist(RAW_PLAYLIST);
    expect(p.name).toBe(RAW_PLAYLIST.playlist_name);
    expect(p.ownerName).toBe('Hot & New');
    expect(p.artwork.small).toBe(RAW_PLAYLIST.artwork['150x150']);
  });
});
