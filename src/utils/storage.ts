/**
 * Async storage layer using IndexedDB (via idb-keyval).
 * Settings stay in localStorage for synchronous initial render.
 */
import { get, set } from 'idb-keyval';
import type { StoredGame } from '../types';
import type { Playlist } from '../hooks/usePlaylist';

const GAMES_KEY = 'ch3ssvid5-library';
const PLAYLISTS_KEY = 'ch3ssvid5-playlists';
const FOLDERS_KEY = 'ch3ssvid5-folders';

export async function loadGames(): Promise<StoredGame[]> {
  return (await get<StoredGame[]>(GAMES_KEY)) ?? [];
}

export async function saveGames(games: StoredGame[]): Promise<void> {
  await set(GAMES_KEY, games);
}

export async function loadPlaylists(): Promise<Playlist[]> {
  return (await get<Playlist[]>(PLAYLISTS_KEY)) ?? [];
}

export async function savePlaylists(playlists: Playlist[]): Promise<void> {
  await set(PLAYLISTS_KEY, playlists);
}

export async function loadFolders(): Promise<string[]> {
  return (await get<string[]>(FOLDERS_KEY)) ?? [];
}

export async function saveFolders(folders: string[]): Promise<void> {
  await set(FOLDERS_KEY, folders);
}

/**
 * One-time migration from localStorage to IndexedDB.
 * Safe: only deletes localStorage after successful IndexedDB write.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  // Migrate each key independently: if localStorage has data, overwrite IndexedDB
  const rawGames = localStorage.getItem(GAMES_KEY);
  if (rawGames) {
    try {
      const games = JSON.parse(rawGames) as StoredGame[];
      if (games.length > 0) {
        await set(GAMES_KEY, games);
        localStorage.removeItem(GAMES_KEY);
      }
    } catch (e) {
      console.error('Migration failed for games:', e);
    }
  }

  const rawPlaylists = localStorage.getItem(PLAYLISTS_KEY);
  if (rawPlaylists) {
    try {
      const playlists = JSON.parse(rawPlaylists) as Playlist[];
      if (playlists.length > 0) {
        await set(PLAYLISTS_KEY, playlists);
        localStorage.removeItem(PLAYLISTS_KEY);
      }
    } catch (e) {
      console.error('Migration failed for playlists:', e);
    }
  }

  const rawFolders = localStorage.getItem(FOLDERS_KEY);
  if (rawFolders) {
    try {
      const folders = JSON.parse(rawFolders) as string[];
      await set(FOLDERS_KEY, folders);
      localStorage.removeItem(FOLDERS_KEY);
    } catch (e) {
      console.error('Migration failed for folders:', e);
    }
  }
}

/**
 * Estimate storage usage from IndexedDB.
 * Returns bytes used and quota, or falls back to 0/0 if API unavailable.
 */
export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return { usage: 0, quota: 0 };
}
