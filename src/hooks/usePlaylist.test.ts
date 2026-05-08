import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaylist } from './usePlaylist';
import type { StoredGame } from '../types';

// Mock IndexedDB storage with in-memory store
const store = new Map<string, unknown>();
vi.mock('../utils/storage', () => ({
  loadPlaylists: vi.fn(async () => (store.get('ch3ssvid5-playlists') as unknown[]) ?? []),
  savePlaylists: vi.fn(async (playlists: unknown[]) => {
    store.set('ch3ssvid5-playlists', playlists);
  }),
  loadGames: vi.fn(async () => []),
  saveGames: vi.fn(async () => {}),
  loadFolders: vi.fn(async () => []),
  saveFolders: vi.fn(async () => {}),
}));

function makeGame(id: string, name: string): StoredGame {
  return { id, name, pgn: '1. e4 *', folder: '/', timestamps: {}, createdAt: 0, updatedAt: 0 };
}

const games: StoredGame[] = [
  makeGame('g1', 'Advance Variation'),
  makeGame('g2', 'Classical Line'),
  makeGame('g3', 'Exchange Variation'),
  makeGame('g4', 'Panov Attack'),
  makeGame('g5', 'Fantasy Variation'),
];

beforeEach(() => {
  store.clear();
});

/** Render the hook and wait for async loading to complete */
async function renderPlaylist() {
  const hook = renderHook(() => usePlaylist());
  await waitFor(() => expect(hook.result.current.playlists).toBeDefined());
  return hook;
}

describe('CRUD operations', () => {
  it('creates a playlist with name and description', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('My Playlist', 'A study plan');
    });
    expect(pl!.name).toBe('My Playlist');
    expect(pl!.description).toBe('A study plan');
    expect(pl!.gameIds).toEqual([]);
    expect(result.current.playlists).toHaveLength(1);
    // persisted
    expect(store.get('ch3ssvid5-playlists') as unknown[]).toHaveLength(1);
  });

  it('auto-suffixes duplicate playlist names', async () => {
    const { result } = await renderPlaylist();
    act(() => {
      result.current.createPlaylist('Study');
    });
    let pl2: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl2 = result.current.createPlaylist('Study');
    });
    expect(pl2!.name).toBe('Study (2)');
    let pl3: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl3 = result.current.createPlaylist('Study');
    });
    expect(pl3!.name).toBe('Study (3)');
  });

  it('deletes a playlist by ID', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('ToDelete');
    });
    expect(result.current.playlists).toHaveLength(1);
    act(() => {
      result.current.deletePlaylist(pl!.id);
    });
    expect(result.current.playlists).toHaveLength(0);
  });

  it('renames a playlist', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('Old Name');
    });
    act(() => {
      result.current.updatePlaylist(pl!.id, { name: 'New Name' });
    });
    expect(result.current.playlists[0].name).toBe('New Name');
  });

  it('updates description', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.updatePlaylist(pl!.id, { description: 'Updated desc' });
    });
    expect(result.current.playlists[0].description).toBe('Updated desc');
  });
});

describe('Game management', () => {
  it('adds a game by ID', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    expect(result.current.playlists[0].gameIds).toEqual(['g1']);
  });

  it('allows duplicate games', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    expect(result.current.playlists[0].gameIds).toEqual(['g1', 'g1']);
  });

  it('removes a game by index', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    act(() => {
      result.current.removeGame(pl!.id, 1);
    });
    expect(result.current.playlists[0].gameIds).toEqual(['g1', 'g3']);
  });

  it('reorders games', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    act(() => {
      result.current.reorderGame(pl!.id, 2, 0);
    });
    expect(result.current.playlists[0].gameIds).toEqual(['g3', 'g1', 'g2']);
  });
});

describe('Lazy cleanup', () => {
  it('removes stale IDs', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'deleted-id');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    let cleaned: ReturnType<typeof result.current.cleanupPlaylist>;
    act(() => {
      cleaned = result.current.cleanupPlaylist(pl!.id, games);
    });
    expect(cleaned!.gameIds).toEqual(['g1', 'g2']);
  });

  it('preserves valid IDs', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    let cleaned: ReturnType<typeof result.current.cleanupPlaylist>;
    act(() => {
      cleaned = result.current.cleanupPlaylist(pl!.id, games);
    });
    expect(cleaned!.gameIds).toEqual(['g1', 'g3']);
  });

  it('persists cleaned playlist', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'stale');
    });
    act(() => {
      result.current.cleanupPlaylist(pl!.id, games);
    });
    const stored = store.get('ch3ssvid5-playlists') as { gameIds: string[] }[];
    expect(stored[0].gameIds).toEqual(['g1']);
  });

  it('empty playlist stays empty after cleanup', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    let cleaned: ReturnType<typeof result.current.cleanupPlaylist>;
    act(() => {
      cleaned = result.current.cleanupPlaylist(pl!.id, games);
    });
    expect(cleaned!.gameIds).toEqual([]);
  });
});

describe('Playback state', () => {
  it('starts playlist at index 0', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    expect(result.current.activePlaylistId).toBe(pl!.id);
    expect(result.current.activeIndex).toBe(0);
  });

  it('starts playlist at specific index', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    act(() => {
      result.current.startPlaylist(pl!.id, 2);
    });
    expect(result.current.activeIndex).toBe(2);
  });

  it('nextGame advances and returns correct ID', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    let next: string | null = null;
    act(() => {
      next = result.current.nextGame();
    });
    expect(next).toBe('g2');
    expect(result.current.activeIndex).toBe(1);
  });

  it('nextGame at last position returns null', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    let next: string | null = null;
    act(() => {
      next = result.current.nextGame();
    });
    expect(next).toBeNull();
  });

  it('prevGame decrements and returns correct ID', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.startPlaylist(pl!.id, 1);
    });
    let prev: string | null = null;
    act(() => {
      prev = result.current.prevGame();
    });
    expect(prev).toBe('g1');
    expect(result.current.activeIndex).toBe(0);
  });

  it('prevGame at first position returns null', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    let prev: string | null = null;
    act(() => {
      prev = result.current.prevGame();
    });
    expect(prev).toBeNull();
  });

  it('exitPlaylist clears active state', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    act(() => {
      result.current.exitPlaylist();
    });
    expect(result.current.activePlaylistId).toBeNull();
    expect(result.current.activeIndex).toBe(0);
  });

  it('deleting active playlist clears playback', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.startPlaylist(pl!.id);
    });
    act(() => {
      result.current.deletePlaylist(pl!.id);
    });
    expect(result.current.activePlaylistId).toBeNull();
  });
});

describe('Export / Import', () => {
  it('export resolves gameIds to game names', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    let json: string | null = null;
    act(() => {
      json = result.current.exportPlaylist(pl!.id, games);
    });
    const exported = JSON.parse(json!);
    expect(exported.name).toBe('PL');
    expect(exported.games).toEqual(['Advance Variation', 'Exchange Variation']);
  });

  it('export skips unresolved IDs', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('PL');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'nonexistent');
    });
    let json: string | null = null;
    act(() => {
      json = result.current.exportPlaylist(pl!.id, games);
    });
    const exported = JSON.parse(json!);
    expect(exported.games).toEqual(['Advance Variation']);
  });

  it('export empty playlist produces valid JSON', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('Empty');
    });
    let json: string | null = null;
    act(() => {
      json = result.current.exportPlaylist(pl!.id, games);
    });
    const exported = JSON.parse(json!);
    expect(exported.games).toEqual([]);
  });

  it('import resolves game names to IDs', async () => {
    const { result } = await renderPlaylist();
    const json = JSON.stringify({ name: 'Imported', games: ['Advance Variation', 'Panov Attack'] });
    let pl: ReturnType<typeof result.current.importPlaylist>;
    act(() => {
      pl = result.current.importPlaylist(json, games);
    });
    expect(pl!.name).toBe('Imported');
    expect(pl!.gameIds).toEqual(['g1', 'g4']);
    expect(result.current.playlists).toHaveLength(1);
  });

  it('import skips unresolved names', async () => {
    const { result } = await renderPlaylist();
    const json = JSON.stringify({ name: 'Partial', games: ['Advance Variation', 'Unknown Game'] });
    let pl: ReturnType<typeof result.current.importPlaylist>;
    act(() => {
      pl = result.current.importPlaylist(json, games);
    });
    expect(pl!.gameIds).toEqual(['g1']);
  });

  it('export → import round-trip preserves game names', async () => {
    const { result } = await renderPlaylist();
    let pl: ReturnType<typeof result.current.createPlaylist>;
    act(() => {
      pl = result.current.createPlaylist('RoundTrip');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g1');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g2');
    });
    act(() => {
      result.current.addGame(pl!.id, 'g3');
    });
    let json: string | null = null;
    act(() => {
      json = result.current.exportPlaylist(pl!.id, games);
    });

    // Import in a fresh hook
    const { result: result2 } = renderHook(() => usePlaylist());
    let imported: ReturnType<typeof result2.current.importPlaylist>;
    act(() => {
      imported = result2.current.importPlaylist(json!, games);
    });
    expect(imported!.gameIds).toEqual(['g1', 'g2', 'g3']);
  });
});

describe('Persistence', () => {
  it('survives IndexedDB round-trip', async () => {
    const { result } = await renderPlaylist();
    act(() => {
      result.current.createPlaylist('Persisted', 'desc');
    });
    act(() => {
      result.current.addGame(result.current.playlists[0].id, 'g1');
    });

    // Re-mount
    const { result: result2 } = await renderPlaylist();
    expect(result2.current.playlists).toHaveLength(1);
    expect(result2.current.playlists[0].name).toBe('Persisted');
    expect(result2.current.playlists[0].gameIds).toEqual(['g1']);
  });

  it('multiple playlists persist independently', async () => {
    const { result } = await renderPlaylist();
    act(() => {
      result.current.createPlaylist('PL1');
    });
    act(() => {
      result.current.createPlaylist('PL2');
    });

    const { result: result2 } = await renderPlaylist();
    expect(result2.current.playlists).toHaveLength(2);
    expect(result2.current.playlists.map((p) => p.name)).toEqual(['PL1', 'PL2']);
  });
});
