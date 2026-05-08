import { useState, useCallback, useEffect, useRef } from 'react';
import type { StoredGame } from '../types';
import { showToast } from '../components/Toast';
import { loadPlaylists as idbLoadPlaylists, savePlaylists as idbSavePlaylists } from '../utils/storage';

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  gameIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistExport {
  name: string;
  description?: string;
  games: string[];
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface UsePlaylistReturn {
  playlists: Playlist[];
  activePlaylistId: string | null;
  activeIndex: number;
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, updates: Partial<Pick<Playlist, 'name' | 'description' | 'gameIds'>>) => void;
  addGame: (playlistId: string, gameId: string) => void;
  removeGame: (playlistId: string, index: number) => void;
  reorderGame: (playlistId: string, fromIndex: number, toIndex: number) => void;
  cleanupPlaylist: (playlistId: string, games: StoredGame[]) => Playlist | null;
  startPlaylist: (id: string, startIndex?: number) => void;
  nextGame: () => string | null;
  prevGame: () => string | null;
  exitPlaylist: () => void;
  setActiveIndex: (index: number) => void;
  exportPlaylist: (id: string, games: StoredGame[]) => string | null;
  importPlaylist: (json: string, games: StoredGame[]) => Playlist | null;
}

export function usePlaylist(): UsePlaylistReturn {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const initialLoadDone = useRef(false);

  // Load from IndexedDB on mount
  useEffect(() => {
    idbLoadPlaylists().then((p) => {
      setPlaylists(p);
      requestAnimationFrame(() => {
        initialLoadDone.current = true;
      });
    });
  }, []);

  const persist = useCallback((updated: Playlist[]) => {
    setPlaylists(updated);
    idbSavePlaylists(updated).catch(() => {
      showToast('⚠️ Failed to save playlists.');
    });
  }, []);

  const uniqueName = useCallback(
    (name: string, excludeId?: string): string => {
      const existing = playlists.filter((p) => !excludeId || p.id !== excludeId).map((p) => p.name);
      if (!existing.includes(name)) return name;
      let n = 2;
      while (existing.includes(`${name} (${n})`)) n++;
      return `${name} (${n})`;
    },
    [playlists],
  );

  const createPlaylist = useCallback(
    (name: string, description?: string): Playlist => {
      const playlist: Playlist = {
        id: generateId(),
        name: uniqueName(name),
        description,
        gameIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      persist([...playlists, playlist]);
      return playlist;
    },
    [playlists, persist, uniqueName],
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      if (activePlaylistId === id) {
        setActivePlaylistId(null);
        setActiveIndex(0);
      }
      persist(playlists.filter((p) => p.id !== id));
    },
    [playlists, persist, activePlaylistId],
  );

  const updatePlaylist = useCallback(
    (id: string, updates: Partial<Pick<Playlist, 'name' | 'description' | 'gameIds'>>) => {
      persist(
        playlists.map((p) => {
          if (p.id !== id) return p;
          const patched = { ...p, ...updates, updatedAt: Date.now() };
          if (updates.name && updates.name !== p.name) {
            patched.name = uniqueName(updates.name, id);
          }
          return patched;
        }),
      );
    },
    [playlists, persist, uniqueName],
  );

  const addGame = useCallback(
    (playlistId: string, gameId: string) => {
      persist(
        playlists.map((p) => {
          if (p.id !== playlistId) return p;
          return { ...p, gameIds: [...p.gameIds, gameId], updatedAt: Date.now() };
        }),
      );
    },
    [playlists, persist],
  );

  const removeGame = useCallback(
    (playlistId: string, index: number) => {
      persist(
        playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const gameIds = [...p.gameIds];
          gameIds.splice(index, 1);
          return { ...p, gameIds, updatedAt: Date.now() };
        }),
      );
    },
    [playlists, persist],
  );

  const reorderGame = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number) => {
      persist(
        playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const gameIds = [...p.gameIds];
          const [item] = gameIds.splice(fromIndex, 1);
          gameIds.splice(toIndex, 0, item);
          return { ...p, gameIds, updatedAt: Date.now() };
        }),
      );
    },
    [playlists, persist],
  );

  const cleanupPlaylist = useCallback(
    (playlistId: string, games: StoredGame[]): Playlist | null => {
      const gameIdSet = new Set(games.map((g) => g.id));
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) return null;
      const cleaned = playlist.gameIds.filter((id) => gameIdSet.has(id));
      if (cleaned.length !== playlist.gameIds.length) {
        const updated = { ...playlist, gameIds: cleaned, updatedAt: Date.now() };
        persist(playlists.map((p) => (p.id === playlistId ? updated : p)));
        return updated;
      }
      return playlist;
    },
    [playlists, persist],
  );

  const startPlaylist = useCallback((id: string, startIndex = 0) => {
    setActivePlaylistId(id);
    setActiveIndex(startIndex);
  }, []);

  const nextGame = useCallback((): string | null => {
    const playlist = playlists.find((p) => p.id === activePlaylistId);
    if (!playlist) return null;
    const next = activeIndex + 1;
    if (next >= playlist.gameIds.length) return null;
    setActiveIndex(next);
    return playlist.gameIds[next];
  }, [playlists, activePlaylistId, activeIndex]);

  const prevGame = useCallback((): string | null => {
    const playlist = playlists.find((p) => p.id === activePlaylistId);
    if (!playlist) return null;
    const prev = activeIndex - 1;
    if (prev < 0) return null;
    setActiveIndex(prev);
    return playlist.gameIds[prev];
  }, [playlists, activePlaylistId, activeIndex]);

  const exitPlaylist = useCallback(() => {
    setActivePlaylistId(null);
    setActiveIndex(0);
  }, []);

  const exportPlaylist = useCallback(
    (id: string, games: StoredGame[]): string | null => {
      const playlist = playlists.find((p) => p.id === id);
      if (!playlist) return null;
      const gameMap = new Map(games.map((g) => [g.id, g.name]));
      const exported: PlaylistExport = {
        name: playlist.name,
        ...(playlist.description ? { description: playlist.description } : {}),
        games: playlist.gameIds.map((gid) => gameMap.get(gid)).filter((n): n is string => n !== undefined),
      };
      return JSON.stringify(exported, null, 2);
    },
    [playlists],
  );

  const importPlaylist = useCallback(
    (json: string, games: StoredGame[]): Playlist | null => {
      try {
        const data = JSON.parse(json) as PlaylistExport;
        if (!data.name || !Array.isArray(data.games)) return null;
        const nameMap = new Map(games.map((g) => [g.name, g.id]));
        const gameIds = data.games.map((name) => nameMap.get(name)).filter((id): id is string => id !== undefined);
        const playlist: Playlist = {
          id: generateId(),
          name: uniqueName(data.name),
          description: data.description,
          gameIds,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        persist([...playlists, playlist]);
        return playlist;
      } catch {
        return null;
      }
    },
    [playlists, persist, uniqueName],
  );

  return {
    playlists,
    activePlaylistId,
    activeIndex,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    addGame,
    removeGame,
    reorderGame,
    cleanupPlaylist,
    startPlaylist,
    nextGame,
    prevGame,
    exitPlaylist,
    setActiveIndex,
    exportPlaylist,
    importPlaylist,
  };
}
