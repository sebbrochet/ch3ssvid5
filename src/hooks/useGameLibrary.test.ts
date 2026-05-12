import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGameLibrary } from './useGameLibrary';

// Mock IndexedDB storage with in-memory store
const store = new Map<string, unknown>();
vi.mock('../utils/storage', () => ({
  loadGames: vi.fn(async () => (store.get('ch3ssvid5-library') as unknown[]) ?? []),
  saveGames: vi.fn(async (games: unknown[]) => {
    store.set('ch3ssvid5-library', games);
  }),
  loadFolders: vi.fn(async () => (store.get('ch3ssvid5-folders') as string[]) ?? []),
  saveFolders: vi.fn(async (folders: string[]) => {
    store.set('ch3ssvid5-folders', folders);
  }),
}));

// Clear store before each test
beforeEach(() => {
  store.clear();
});

/** Render the hook and wait for async loading to complete */
async function renderLibrary() {
  const hook = renderHook(() => useGameLibrary());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe('useGameLibrary', () => {
  // --- CRUD ---

  it('generates unique IDs for each game', async () => {
    const { result } = await renderLibrary();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      act(() => {
        const game = result.current.createGame(`Game ${i}`, '1. e4 *');
        ids.add(game.id);
      });
    }
    expect(ids.size).toBe(5);
    // Each ID should look like a UUID
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('starts with empty games list', async () => {
    const { result } = await renderLibrary();
    expect(result.current.games).toEqual([]);
  });

  it('creates a game', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Test Game', '1. e4 e5 *');
    });
    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].name).toBe('Test Game');
    expect(result.current.games[0].pgn).toBe('1. e4 e5 *');
    expect(result.current.games[0].folder).toBe('/');
    expect(result.current.games[0].id).toBeDefined();
  });

  it('creates a game with options', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Test', '1. e4 *', {
        videoId: 'abc123',
        folder: '/openings',
      });
    });
    expect(result.current.games[0].videoId).toBe('abc123');
    expect(result.current.games[0].folder).toBe('/openings');
  });

  it('updates a game', async () => {
    const { result } = await renderLibrary();
    let id = '';
    act(() => {
      id = result.current.createGame('Old Name', '1. e4 *').id;
    });
    act(() => {
      result.current.updateGame(id, { name: 'New Name', pgn: '1. d4 *' });
    });
    expect(result.current.games[0].name).toBe('New Name');
    expect(result.current.games[0].pgn).toBe('1. d4 *');
  });

  it('deletes a game', async () => {
    const { result } = await renderLibrary();
    let id = '';
    act(() => {
      id = result.current.createGame('To Delete', '1. e4 *').id;
    });
    expect(result.current.games).toHaveLength(1);
    act(() => {
      result.current.deleteGame(id);
    });
    expect(result.current.games).toHaveLength(0);
  });

  it('getGame returns the correct game', async () => {
    const { result } = await renderLibrary();
    let id = '';
    act(() => {
      id = result.current.createGame('Find Me', '1. e4 *').id;
    });
    expect(result.current.getGame(id)?.name).toBe('Find Me');
    expect(result.current.getGame('nonexistent')).toBeUndefined();
  });

  // --- Folders ---

  it('creates a folder', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createFolder('/openings');
    });
    expect(result.current.getFolders()).toContain('/openings');
  });

  it('does not create duplicate folders', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createFolder('/openings');
      result.current.createFolder('/openings');
    });
    const openingsCount = result.current.getFolders().filter((f) => f === '/openings').length;
    expect(openingsCount).toBe(1);
  });

  it('deletes a folder and its games', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Game 1', '1. e4 *', { folder: '/openings' });
      result.current.createGame('Game 2', '1. d4 *', { folder: '/openings' });
      result.current.createGame('Game 3', '1. c4 *', { folder: '/' });
    });
    expect(result.current.games).toHaveLength(3);
    act(() => {
      result.current.deleteFolder('/openings');
    });
    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].name).toBe('Game 3');
  });

  it('deletes subfolder games when parent folder is deleted', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Sub Game', '1. e4 *', { folder: '/openings/sicilian' });
      result.current.createGame('Root Game', '1. d4 *', { folder: '/' });
    });
    act(() => {
      result.current.deleteFolder('/openings');
    });
    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].name).toBe('Root Game');
  });

  it('renames a folder and updates game paths', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Game', '1. e4 *', { folder: '/old' });
      result.current.createFolder('/old');
    });
    act(() => {
      result.current.renameFolder('/old', '/new');
    });
    expect(result.current.games[0].folder).toBe('/new');
    expect(result.current.getFolders()).toContain('/new');
    expect(result.current.getFolders()).not.toContain('/old');
  });

  it('renames a folder and updates subfolder paths', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Sub Game', '1. e4 *', { folder: '/parent/child' });
    });
    act(() => {
      result.current.renameFolder('/parent', '/renamed');
    });
    expect(result.current.games[0].folder).toBe('/renamed/child');
  });

  it('moves a game to a different folder', async () => {
    const { result } = await renderLibrary();
    let id = '';
    act(() => {
      id = result.current.createGame('Game', '1. e4 *', { folder: '/' }).id;
    });
    act(() => {
      result.current.moveGame(id, '/openings');
    });
    expect(result.current.games[0].folder).toBe('/openings');
  });

  it('getGamesInFolder returns only games in that folder', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Root', '1. e4 *', { folder: '/' });
      result.current.createGame('Sub', '1. d4 *', { folder: '/openings' });
    });
    expect(result.current.getGamesInFolder('/')).toHaveLength(1);
    expect(result.current.getGamesInFolder('/')[0].name).toBe('Root');
    expect(result.current.getGamesInFolder('/openings')).toHaveLength(1);
  });

  it('getGamesInFolder returns games sorted alphabetically by name', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Sicilian Defense', '1. e4 c5 *', { folder: '/' });
      result.current.createGame('French Defense', '1. e4 e6 *', { folder: '/' });
      result.current.createGame('Caro-Kann', '1. e4 c6 *', { folder: '/' });
      result.current.createGame('Italian Game', '1. e4 e5 2. Nf3 Nc6 3. Bc4 *', { folder: '/' });
    });
    const names = result.current.getGamesInFolder('/').map((g) => g.name);
    expect(names).toEqual(['Caro-Kann', 'French Defense', 'Italian Game', 'Sicilian Defense']);
  });

  it('getGamesInFolder uses natural sort for numbered names', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Chapter 10 - Averback System', '1. d4 *', { folder: '/' });
      result.current.createGame('Chapter 2 - Classical 9b4', '1. d4 *', { folder: '/' });
      result.current.createGame('Chapter 1 - Classical 9.Ne1', '1. d4 *', { folder: '/' });
      result.current.createGame('Chapter 11 - Makogonov System', '1. d4 *', { folder: '/' });
      result.current.createGame('Chapter 0 - Introduction', '1. d4 *', { folder: '/' });
      result.current.createGame('Chapter 12 - London System', '1. d4 *', { folder: '/' });
    });
    const names = result.current.getGamesInFolder('/').map((g) => g.name);
    expect(names).toEqual([
      'Chapter 0 - Introduction',
      'Chapter 1 - Classical 9.Ne1',
      'Chapter 2 - Classical 9b4',
      'Chapter 10 - Averback System',
      'Chapter 11 - Makogonov System',
      'Chapter 12 - London System',
    ]);
  });

  it('getSubfolders returns immediate subfolders', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createFolder('/a');
      result.current.createFolder('/a/b');
      result.current.createFolder('/a/b/c');
      result.current.createFolder('/x');
    });
    expect(result.current.getSubfolders('/')).toEqual(expect.arrayContaining(['/a', '/x']));
    expect(result.current.getSubfolders('/a')).toEqual(['/a/b']);
    expect(result.current.getSubfolders('/a/b')).toEqual(['/a/b/c']);
  });

  it('getSubfolders returns subfolders sorted alphabetically', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createFolder('/sicilian');
      result.current.createFolder('/french');
      result.current.createFolder('/caro-kann');
      result.current.createFolder('/italian');
    });
    expect(result.current.getSubfolders('/')).toEqual(['/caro-kann', '/french', '/italian', '/sicilian']);
  });

  // --- Persistence ---

  it('persists games to IndexedDB', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Persisted', '1. e4 *');
    });
    await waitFor(() => {
      const stored = store.get('ch3ssvid5-library') as { name: string }[];
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('Persisted');
    });
  });

  it('loads games from IndexedDB on init', async () => {
    const game = {
      id: 'test-id',
      name: 'Preloaded',
      pgn: '1. e4 *',
      folder: '/',
      timestamps: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    store.set('ch3ssvid5-library', [game]);
    const { result } = await renderLibrary();
    expect(result.current.games).toHaveLength(1);
    expect(result.current.games[0].name).toBe('Preloaded');
  });

  // --- Import/Export ---

  it('exports library as JSON', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Export Me', '1. e4 *');
    });
    const json = result.current.exportLibrary();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Export Me');
  });

  it('imports library from JSON, skipping duplicates', async () => {
    const { result } = await renderLibrary();
    let existingId = '';
    act(() => {
      existingId = result.current.createGame('Existing', '1. e4 *').id;
    });
    const importData = JSON.stringify([
      { id: existingId, name: 'Duplicate', pgn: '1. d4 *', folder: '/', timestamps: {}, createdAt: 0, updatedAt: 0 },
      { id: 'new-id', name: 'New Game', pgn: '1. c4 *', folder: '/', timestamps: {}, createdAt: 0, updatedAt: 0 },
    ]);
    act(() => {
      result.current.importLibrary(importData);
    });
    expect(result.current.games).toHaveLength(2);
    expect(result.current.games.find((g) => g.id === existingId)?.name).toBe('Existing'); // not overwritten
    expect(result.current.games.find((g) => g.id === 'new-id')?.name).toBe('New Game');
  });

  it('handles malformed import JSON gracefully', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderLibrary();
    act(() => {
      result.current.importLibrary('not valid json');
    });
    expect(result.current.games).toHaveLength(0);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('handles non-array import JSON gracefully', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = await renderLibrary();
    act(() => {
      result.current.importLibrary('{"not": "an array"}');
    });
    expect(result.current.games).toHaveLength(0);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  // --- Clone (simulating App.tsx handleCloneGame) ---

  it('clones a game with all properties', async () => {
    const { result } = await renderLibrary();
    let originalId = '';
    act(() => {
      originalId = result.current.createGame('Original', '1. e4 e5 *', {
        videoId: 'vid123',
        folder: '/openings',
        timestamps: { 'node-1': 10.5, 'node-2': 25.3 },
      }).id;
    });
    expect(result.current.games).toHaveLength(1);

    // Clone: get original, create copy (same as handleCloneGame in App.tsx)
    let cloneId = '';
    act(() => {
      const original = result.current.getGame(originalId)!;
      const cloned = result.current.createGame(`${original.name} (copy)`, original.pgn, {
        videoId: original.videoId,
        folder: original.folder,
        timestamps: { ...original.timestamps },
      });
      cloneId = cloned.id;
    });

    expect(result.current.games).toHaveLength(2);
    const clone = result.current.getGame(cloneId)!;
    expect(clone.name).toBe('Original (copy)');
    expect(clone.pgn).toBe('1. e4 e5 *');
    expect(clone.videoId).toBe('vid123');
    expect(clone.folder).toBe('/openings');
    expect(clone.timestamps).toEqual({ 'node-1': 10.5, 'node-2': 25.3 });
    expect(clone.id).not.toBe(originalId);
  });

  it('cloned game has independent timestamps', async () => {
    const { result } = await renderLibrary();
    let originalId = '';
    act(() => {
      originalId = result.current.createGame('Game', '1. d4 *', {
        timestamps: { n1: 5.0 },
      }).id;
    });

    let cloneId = '';
    act(() => {
      const original = result.current.getGame(originalId)!;
      const cloned = result.current.createGame(`${original.name} (copy)`, original.pgn, {
        timestamps: { ...original.timestamps },
      });
      cloneId = cloned.id;
    });

    // Modify clone timestamps
    act(() => {
      result.current.updateGame(cloneId, { timestamps: { n1: 99.0 } });
    });

    // Original should be unchanged
    const original = result.current.getGame(originalId)!;
    expect(original.timestamps).toEqual({ n1: 5.0 });
    const clone = result.current.getGame(cloneId)!;
    expect(clone.timestamps).toEqual({ n1: 99.0 });
  });

  it('clones a game without optional properties', async () => {
    const { result } = await renderLibrary();
    let originalId = '';
    act(() => {
      originalId = result.current.createGame('Simple', '1. e4 *').id;
    });

    let cloneId = '';
    act(() => {
      const original = result.current.getGame(originalId)!;
      const cloned = result.current.createGame(`${original.name} (copy)`, original.pgn, {
        videoId: original.videoId,
        folder: original.folder,
        timestamps: { ...original.timestamps },
      });
      cloneId = cloned.id;
    });

    const clone = result.current.getGame(cloneId)!;
    expect(clone.name).toBe('Simple (copy)');
    expect(clone.folder).toBe('/');
    expect(clone.videoId).toBeUndefined();
    expect(clone.timestamps).toEqual({});
  });
});

describe('IndexedDB serialization round-trip', () => {
  it('PGN content survives serialization', async () => {
    const pgn = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[VideoURL "https://youtube.com/watch?v=abc123"]

1. e4 {[%ts 0:10]} e5 {[%ts 0:20] Great move} 2. Nf3 1-0`;

    const { result } = await renderLibrary();
    let gameId = '';
    act(() => {
      const game = result.current.createGame('Round-trip Test', pgn, { videoId: 'abc123' });
      gameId = game.id;
    });

    // Read from store
    await waitFor(() => {
      const stored = store.get('ch3ssvid5-library') as { id: string; pgn: string; name: string; videoId: string }[];
      expect(stored).not.toBeUndefined();
      const game = stored.find((g) => g.id === gameId);
      expect(game).toBeDefined();
      expect(game!.pgn).toBe(pgn);
      expect(game!.name).toBe('Round-trip Test');
      expect(game!.videoId).toBe('abc123');
    });
  });

  it('special characters in PGN survive round-trip', async () => {
    const pgn = `[Event "Torneo ñ café"]
[White "Müller"]
[Black "O'Brien"]
[Result "*"]

1. e4 {A "quoted" comment} *`;

    const { result } = await renderLibrary();
    let gameId = '';
    act(() => {
      const game = result.current.createGame('Special Chars', pgn);
      gameId = game.id;
    });

    // Re-load from store (fresh hook)
    const { result: result2 } = await renderLibrary();
    const loaded = result2.current.getGame(gameId);
    expect(loaded).toBeDefined();
    expect(loaded!.pgn).toBe(pgn);
    expect(loaded!.name).toBe('Special Chars');
  });

  it('library export → import preserves all game data', async () => {
    const { result } = await renderLibrary();
    act(() => {
      result.current.createGame('Game A', '1. e4 *', { videoId: 'vid1', folder: '/folder1' });
      result.current.createGame('Game B', '1. d4 d5 2. c4 *', { folder: '/folder2' });
    });

    const exported = result.current.exportLibrary();
    const parsed = JSON.parse(exported);
    expect(parsed).toHaveLength(2);

    // Clear and reimport
    act(() => {
      parsed.forEach((g: { id: string }) => result.current.deleteGame(g.id));
    });
    expect(result.current.games).toHaveLength(0);

    act(() => {
      result.current.importLibrary(exported);
    });

    expect(result.current.games).toHaveLength(2);
    const gameA = result.current.games.find((g) => g.name === 'Game A');
    const gameB = result.current.games.find((g) => g.name === 'Game B');
    expect(gameA).toBeDefined();
    expect(gameA!.pgn).toBe('1. e4 *');
    expect(gameA!.videoId).toBe('vid1');
    expect(gameA!.folder).toBe('/folder1');
    expect(gameB).toBeDefined();
    expect(gameB!.pgn).toBe('1. d4 d5 2. c4 *');
    expect(gameB!.folder).toBe('/folder2');
  });
});
