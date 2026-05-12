import { useState, useCallback, useEffect } from 'react';
import type { StoredGame } from '../types';
import { showToast } from '../components/Toast';
import {
  loadGames as idbLoadGames,
  saveGames as idbSaveGames,
  loadFolders as idbLoadFolders,
  saveFolders as idbSaveFolders,
} from '../utils/storage';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts (e.g., HTTP on LAN)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useGameLibrary() {
  const [games, setGames] = useState<StoredGame[]>([]);
  const [explicitFolders, setExplicitFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from IndexedDB on mount
  useEffect(() => {
    Promise.all([idbLoadGames(), idbLoadFolders()]).then(([g, f]) => {
      setGames(g);
      setExplicitFolders(f);
      setLoading(false);
    });
  }, []);

  /** Update games state and persist to IndexedDB */
  const persistGames = useCallback((updater: (prev: StoredGame[]) => StoredGame[]) => {
    setGames((prev) => {
      const next = updater(prev);
      idbSaveGames(next).catch((e) => {
        console.error('Failed to save games:', e);
        showToast('⚠️ Failed to save games.');
      });
      return next;
    });
  }, []);

  /** Update folders state and persist to IndexedDB */
  const persistFolders = useCallback((updater: (prev: string[]) => string[]) => {
    setExplicitFolders((prev) => {
      const next = updater(prev);
      idbSaveFolders(next).catch(() => {});
      return next;
    });
  }, []);

  const createGame = useCallback(
    (
      name: string,
      pgn: string,
      opts?: { videoId?: string; folder?: string; timestamps?: Record<string, number> },
    ): StoredGame => {
      const now = Date.now();
      const game: StoredGame = {
        id: generateId(),
        name,
        pgn,
        videoId: opts?.videoId,
        folder: opts?.folder || '/',
        timestamps: opts?.timestamps || {},
        createdAt: now,
        updatedAt: now,
      };
      persistGames((prev) => [...prev, game]);
      return game;
    },
    [persistGames],
  );

  /** Create an explicit empty folder */
  const createFolder = useCallback(
    (path: string) => {
      persistFolders((prev) => {
        if (prev.includes(path)) return prev;
        return [...prev, path];
      });
    },
    [persistFolders],
  );

  const updateGame = useCallback(
    (id: string, updates: Partial<Pick<StoredGame, 'name' | 'pgn' | 'videoId' | 'folder' | 'timestamps'>>) => {
      persistGames((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates, updatedAt: Date.now() } : g)));
    },
    [persistGames],
  );

  const deleteGame = useCallback(
    (id: string) => {
      persistGames((prev) => prev.filter((g) => g.id !== id));
    },
    [persistGames],
  );

  const deleteFolder = useCallback(
    (folderPath: string) => {
      const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
      persistGames((prev) => prev.filter((g) => g.folder !== folderPath && !g.folder.startsWith(prefix)));
      persistFolders((prev) => prev.filter((f) => f !== folderPath && !f.startsWith(prefix)));
    },
    [persistGames, persistFolders],
  );

  const renameFolder = useCallback(
    (oldPath: string, newPath: string) => {
      const oldPrefix = oldPath.endsWith('/') ? oldPath : oldPath + '/';
      const newPrefix = newPath.endsWith('/') ? newPath : newPath + '/';
      persistGames((prev) =>
        prev.map((g) => {
          if (g.folder === oldPath) {
            return { ...g, folder: newPath, updatedAt: Date.now() };
          }
          if (g.folder.startsWith(oldPrefix)) {
            return { ...g, folder: newPrefix + g.folder.slice(oldPrefix.length), updatedAt: Date.now() };
          }
          return g;
        }),
      );
      persistFolders((prev) =>
        prev.map((f) => {
          if (f === oldPath) return newPath;
          if (f.startsWith(oldPrefix)) return newPrefix + f.slice(oldPrefix.length);
          return f;
        }),
      );
    },
    [persistGames, persistFolders],
  );

  const moveGame = useCallback(
    (id: string, newFolder: string) => {
      updateGame(id, { folder: newFolder });
    },
    [updateGame],
  );

  const getGame = useCallback(
    (id: string): StoredGame | undefined => {
      return games.find((g) => g.id === id);
    },
    [games],
  );

  /** Get all unique folder paths, sorted */
  const getFolders = useCallback((): string[] => {
    const folders = new Set<string>(['/']);
    // From explicit folders
    for (const f of explicitFolders) folders.add(f);
    // From games
    for (const g of games) {
      folders.add(g.folder);
      const parts = g.folder.split('/').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) {
        folders.add('/' + parts.slice(0, i).join('/'));
      }
    }
    return Array.from(folders).sort();
  }, [games, explicitFolders]);

  /** Get games in a specific folder (not recursive) */
  const getGamesInFolder = useCallback(
    (folder: string): StoredGame[] => {
      return games.filter((g) => g.folder === folder).sort((a, b) => a.name.localeCompare(b.name));
    },
    [games],
  );

  /** Find a game by name in a specific folder */
  const findGameByName = useCallback(
    (name: string, folder: string): StoredGame | undefined => {
      return games.find((g) => g.name === name && g.folder === folder);
    },
    [games],
  );

  /** Get subfolders of a folder */
  const getSubfolders = useCallback(
    (folder: string): string[] => {
      const prefix = folder === '/' ? '/' : folder + '/';
      const subs = new Set<string>();
      // From games
      for (const g of games) {
        if (g.folder.startsWith(prefix) && g.folder !== folder) {
          const rest = g.folder.slice(prefix.length);
          const nextSegment = rest.split('/')[0];
          if (nextSegment) subs.add(prefix + nextSegment);
        }
      }
      // From explicit folders
      for (const f of explicitFolders) {
        if (f.startsWith(prefix) && f !== folder) {
          const rest = f.slice(prefix.length);
          const nextSegment = rest.split('/')[0];
          if (nextSegment) subs.add(prefix + nextSegment);
        }
      }
      return Array.from(subs).sort();
    },
    [games, explicitFolders],
  );

  /** Export entire library as JSON */
  const exportLibrary = useCallback((): string => {
    return JSON.stringify(games, null, 2);
  }, [games]);

  /** Import library from JSON (merges, skipping existing IDs) */
  const importLibrary = useCallback(
    (json: string) => {
      try {
        const imported: StoredGame[] = JSON.parse(json);
        if (!Array.isArray(imported)) throw new Error('Invalid format');
        persistGames((prev) => {
          const existingIds = new Set(prev.map((g) => g.id));
          const newGames = imported.filter((g) => !existingIds.has(g.id));
          return [...prev, ...newGames];
        });
      } catch (e) {
        console.error('Failed to import library:', e);
      }
    },
    [persistGames],
  );

  return {
    games,
    createGame,
    createFolder,
    updateGame,
    deleteGame,
    deleteFolder,
    renameFolder,
    moveGame,
    getGame,
    getFolders,
    getGamesInFolder,
    findGameByName,
    getSubfolders,
    exportLibrary,
    importLibrary,
    loading,
  };
}
