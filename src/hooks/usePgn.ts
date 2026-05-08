import { useState, useMemo } from 'react';
import { parsePgn } from '../utils/pgnParser';
import type { GameData } from '../types';

/** Recursively freeze an object tree in dev mode to catch mutations. */
function deepFreeze<T>(obj: T): T {
  if (!import.meta.env.DEV) return obj;
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const value of Object.values(obj as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

const DEFAULT_PGN = `[Event "Example Game"]
[Site "Ch3ssVid5"]
[Date "2024.01.01"]
[White "Player 1"]
[Black "Player 2"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *`;

const EMPTY_GAME: GameData = {
  headers: {},
  moves: [],
  moveTree: null,
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
};

export function usePgn(initialPgn?: string) {
  const [pgnText, setPgnText] = useState(initialPgn || DEFAULT_PGN);

  const allGames: GameData[] = useMemo(() => {
    try {
      const games = parsePgn(pgnText);
      const result = games.length > 0 ? games : [EMPTY_GAME];
      return result.map((g) => deepFreeze(g));
    } catch (e) {
      console.error('Failed to parse PGN:', e);
      return [EMPTY_GAME];
    }
  }, [pgnText]);

  return { allGames, pgnText, setPgnText };
}
