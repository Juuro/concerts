import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the lastfm-ts-api module with default successful response
const mockGetInfo = vi.fn((params: { artist: string; autocorrect?: 0 | 1 }, callback: (err: any, res: any) => void) => {
  // Last.fm API returns { artist: {...} } structure
  callback(null, {
    artist: {
      name: params.artist,
      url: `https://www.last.fm/music/${params.artist}`,
      image: [{ size: 'large', '#text': 'https://example.com/image.jpg' }],
      bio: { summary: 'Test bio' },
      tags: { tag: ['indie', 'rock'] },
    },
  });
});

vi.mock('lastfm-ts-api', () => ({
  LastFMArtist: vi.fn().mockImplementation(() => ({
    getInfo: mockGetInfo,
  })),
}));

// Import after mocking
const { getArtistInfo } = await import('../lastfm');

describe('lastfm', () => {
  describe('getArtistInfo', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
      mockGetInfo.mockClear();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('test_getArtistInfo_when_feature_disabled_returns_null', async () => {
      vi.stubEnv('ENABLE_LASTFM', 'false');
      vi.stubEnv('LASTFM_API_KEY', 'test-api-key');

      const result = await getArtistInfo('Radiohead');

      expect(result).toBeNull();
      expect(mockGetInfo).not.toHaveBeenCalled();
    });

    it('test_getArtistInfo_when_api_key_missing_returns_null', async () => {
      vi.stubEnv('ENABLE_LASTFM', 'true');
      // No LASTFM_API_KEY set

      const result = await getArtistInfo('Radiohead');

      expect(result).toBeNull();
      expect(mockGetInfo).not.toHaveBeenCalled();
    });

    it('test_getArtistInfo_when_empty_artist_name_returns_null', async () => {
      vi.stubEnv('ENABLE_LASTFM', 'true');
      vi.stubEnv('LASTFM_API_KEY', 'test-api-key');

      const result = await getArtistInfo('');

      expect(result).toBeNull();
      expect(mockGetInfo).not.toHaveBeenCalled();
    });

    it('test_getArtistInfo_successful_response_returns_artist_data', async () => {
      vi.stubEnv('ENABLE_LASTFM', 'true');
      vi.stubEnv('LASTFM_API_KEY', 'test-api-key');

      const result = await getArtistInfo('Radiohead');

      expect(mockGetInfo).toHaveBeenCalledWith(
        expect.objectContaining({ artist: 'Radiohead' }),
        expect.any(Function)
      );
      expect(result).toEqual({
        name: 'Radiohead',
        url: 'https://www.last.fm/music/Radiohead',
        images: {
          small: null,
          medium: null,
          large: 'https://example.com/image.jpg',
          extralarge: null,
          mega: null,
        },
        bio: 'Test bio',
        genres: ['indie', 'rock'],
      });
    });

    it('test_getArtistInfo_with_api_error_returns_null', async () => {
      vi.stubEnv('ENABLE_LASTFM', 'true');
      vi.stubEnv('LASTFM_API_KEY', 'test-api-key');

      // Override mock to simulate API error
      mockGetInfo.mockImplementationOnce((params: any, callback: any) => {
        callback(new Error('API Error'), null);
      });

      const result = await getArtistInfo('NonExistentBand');

      expect(result).toBeNull();
    });
  });
});
