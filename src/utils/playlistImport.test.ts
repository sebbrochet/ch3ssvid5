import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPlaylistId, sanitizeName, findExistingVideoUrl, buildVideoPgn, formatPgnDate } from './playlistImport';

describe('extractPlaylistId', () => {
  it('extracts from standard playlist URL', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe(
      'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
    );
  });

  it('extracts from watch URL with list param', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOe123')).toBe(
      'PLrAXtmErZgOe123',
    );
  });

  it('extracts from youtube.com without www', () => {
    expect(extractPlaylistId('https://youtube.com/playlist?list=PLtest123')).toBe('PLtest123');
  });

  it('extracts from m.youtube.com', () => {
    expect(extractPlaylistId('https://m.youtube.com/playlist?list=PLmobile')).toBe('PLmobile');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(extractPlaylistId('https://vimeo.com/playlist?list=PLfoo')).toBeNull();
  });

  it('returns null for YouTube URLs without list param', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(extractPlaylistId('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPlaylistId('')).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('removes filesystem-unsafe characters', () => {
    expect(sanitizeName('Chapter 1: Introduction')).toBe('Chapter 1 Introduction');
  });

  it('removes pipes', () => {
    expect(sanitizeName('Best Move? | Sicilian Dragon')).toBe('Best Move Sicilian Dragon');
  });

  it('collapses consecutive whitespace', () => {
    expect(sanitizeName('Too   many    spaces')).toBe('Too many spaces');
  });

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeName('  Chapter 1  ')).toBe('Chapter 1');
  });

  it('preserves Unicode letters and normalizes dashes', () => {
    expect(sanitizeName('D\u00e9fense Fran\u00e7aise \u2014 Partie 3')).toBe('D\u00e9fense Fran\u00e7aise - Partie 3');
  });

  it('replaces smart single quotes with apostrophe', () => {
    expect(sanitizeName('Bobby Fischer\u2019s First Game')).toBe("Bobby Fischer's First Game");
  });

  it('removes smart double quotes', () => {
    expect(sanitizeName('Robert \u201Ethe other\u201C Byrne')).toBe('Robert the other Byrne');
  });

  it('removes non-ASCII symbols', () => {
    expect(sanitizeName('Fischer \u00B7 Age 12')).toBe('Fischer Age 12');
  });

  it('removes emoji', () => {
    expect(sanitizeName('Best Game Ever! 🔥♟️')).toBe('Best Game Ever!');
  });

  it('removes hash and brackets', () => {
    expect(sanitizeName('Chess Lesson # 117')).toBe('Chess Lesson 117');
    expect(sanitizeName('Horde Chess [Reupload]')).toBe('Horde Chess Reupload');
  });

  it('replaces non-breaking spaces with regular spaces', () => {
    expect(sanitizeName('attacking\u00A0chess')).toBe('attacking chess');
  });

  it('truncates at word boundary', () => {
    const longName = 'word '.repeat(50); // 250 chars
    const result = sanitizeName(longName);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).not.toMatch(/\s$/);
  });

  it('handles normal names unchanged', () => {
    expect(sanitizeName('Chapter 3 - Caro-Kann Fantasy 3. f3')).toBe('Chapter 3 - Caro-Kann Fantasy 3. f3');
  });

  it('handles empty string', () => {
    expect(sanitizeName('')).toBe('');
  });
});

describe('findExistingVideoUrl', () => {
  const games = [
    { pgn: '[VideoURL "https://youtu.be/abc123"]\n\n*', folder: '/Channel/Playlist' },
    { pgn: '[VideoURL "https://youtu.be/def456"]\n\n*', folder: '/Channel/Playlist' },
    { pgn: '[VideoURL "https://youtu.be/ghi789"]\n\n*', folder: '/Other' },
  ];

  it('finds existing video in target folder', () => {
    expect(findExistingVideoUrl(games, 'abc123', '/Channel/Playlist')).toBe(true);
  });

  it('does not match video in different folder', () => {
    expect(findExistingVideoUrl(games, 'ghi789', '/Channel/Playlist')).toBe(false);
  });

  it('returns false for non-existing video', () => {
    expect(findExistingVideoUrl([], 'abc123', '/Channel/Playlist')).toBe(false);
  });

  it('detects legacy youtube.com/watch?v= format', () => {
    const legacy = [{ pgn: '[VideoURL "https://www.youtube.com/watch?v=old123"]\n\n*', folder: '/Ch/PL' }];
    expect(findExistingVideoUrl(legacy, 'old123', '/Ch/PL')).toBe(true);
  });
});

describe('buildVideoPgn', () => {
  it('creates PGN with Seven Tag Roster and VideoURL', () => {
    const pgn = buildVideoPgn('abc123');
    expect(pgn).toContain('[Event "?"]');
    expect(pgn).toContain('[Site "?"]');
    expect(pgn).toContain('[Date "????.??.??"]');
    expect(pgn).toContain('[White "?"]');
    expect(pgn).toContain('[Black "?"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toContain('[VideoURL "https://youtu.be/abc123"]');
    expect(pgn).toMatch(/\n\n\*$/);
  });

  it('includes Date when publishedAt is provided', () => {
    const pgn = buildVideoPgn('vid1', { publishedAt: 1710460800 }); // 2024-03-15 UTC
    expect(pgn).toContain('[Date "2024.03.15"]');
  });

  it('includes VideoTitle when provided', () => {
    const pgn = buildVideoPgn('vid1', { videoTitle: 'Chapter 1 - Caro-Kann: Advanced' });
    expect(pgn).toContain('[VideoTitle "Chapter 1 - Caro-Kann: Advanced"]');
  });

  it('omits VideoTitle when not provided', () => {
    const pgn = buildVideoPgn('vid1');
    expect(pgn).not.toContain('VideoTitle');
  });

  it('includes VideoPlaylist when provided', () => {
    const pgn = buildVideoPgn('vid1', { playlistTitle: 'New Caro-Kann speedrun 2025' });
    expect(pgn).toContain('[VideoPlaylist "New Caro-Kann speedrun 2025"]');
  });

  it('omits VideoPlaylist when not provided', () => {
    const pgn = buildVideoPgn('vid1');
    expect(pgn).not.toContain('VideoPlaylist');
  });
});

describe('formatPgnDate', () => {
  it('formats unix timestamp to YYYY.MM.DD', () => {
    expect(formatPgnDate(1710460800)).toBe('2024.03.15'); // 2024-03-15 00:00 UTC
  });

  it('pads single-digit month and day', () => {
    expect(formatPgnDate(1704067200)).toBe('2024.01.01'); // 2024-01-01 00:00 UTC
  });
});

describe('fetchPlaylist', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('fetches playlist from Invidious', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    const mockData = {
      title: 'Caro-Kann Masterclass',
      author: 'ChessGeek1',
      videoCount: 2,
      videos: [
        { title: 'Chapter 1 - Advanced', videoId: 'vid1', index: 0, lengthSeconds: 600 },
        { title: 'Chapter 2 - Exchange', videoId: 'vid2', index: 1, lengthSeconds: 500 },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);

    const result = await fetchPlaylist('PLtest123');
    expect(result.title).toBe('Caro-Kann Masterclass');
    expect(result.author).toBe('ChessGeek1');
    expect(result.videos).toHaveLength(2);
    expect(result.videos[0].title).toBe('Chapter 1 - Advanced');
  });

  it('skips private and deleted videos', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    const mockPage1 = {
      title: 'Mixed Playlist',
      author: 'TestChannel',
      videoCount: 3,
      videos: [
        { title: 'Good Video', videoId: 'vid1', index: 0, lengthSeconds: 600 },
        { title: '[Private video]', videoId: 'vid2', index: 1, lengthSeconds: 0 },
        { title: '[Deleted video]', videoId: 'vid3', index: 2, lengthSeconds: 0 },
      ],
    };

    // Page 2 returns empty (pagination stop)
    const mockPage2 = { ...mockPage1, videos: [] };

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPage1),
    } as Response);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPage2),
    } as Response);

    const result = await fetchPlaylist('PLtest');
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].title).toBe('Good Video');
  });

  it('tries fallback instances on failure', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // First 3 Invidious instances fail
    fetchSpy.mockRejectedValueOnce(new Error('timeout'));
    fetchSpy.mockRejectedValueOnce(new Error('timeout'));
    fetchSpy.mockRejectedValueOnce(new Error('timeout'));
    // First Piped instance succeeds (different response shape)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          name: 'Fallback Test',
          uploaderName: 'Channel',
          relatedStreams: [{ title: 'Video', url: '/watch?v=v1', duration: 300 }],
        }),
    } as Response);

    const result = await fetchPlaylist('PLfallback');
    expect(result.title).toBe('Fallback Test');
    expect(result.videos).toHaveLength(1);
  });

  it('throws when all instances fail', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

    await expect(fetchPlaylist('PLfail')).rejects.toThrow('All API instances failed');
  });

  it('saves last successful instance to localStorage', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          title: 'Test',
          author: 'Author',
          videoCount: 1,
          videos: [{ title: 'V1', videoId: 'v1', index: 0, lengthSeconds: 60 }],
        }),
    } as Response);

    await fetchPlaylist('PLsave');
    expect(localStorage.getItem('ch3ssvid5-last-api-instance')).toBe('https://inv.nadeko.net');
  });

  it('tries last successful instance first on subsequent calls', async () => {
    const { fetchPlaylist } = await import('./playlistImport');

    // Simulate a previous successful call to the second Invidious instance
    localStorage.setItem('ch3ssvid5-last-api-instance', 'https://invidious.nerdvpn.de');

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          title: 'Cached',
          author: 'Author',
          videoCount: 1,
          videos: [{ title: 'V1', videoId: 'v1', index: 0, lengthSeconds: 60 }],
        }),
    } as Response);

    const result = await fetchPlaylist('PLcached');
    expect(result.title).toBe('Cached');
    // Should have called the cached instance first (nerdvpn.de)
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('invidious.nerdvpn.de');
  });
});
