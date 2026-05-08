import type { GameData } from '../types';
import { parseMoveTree, treeToFlatMoves } from './moveTree';
import { variantToRules } from './chessPosition';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Extract YouTube video ID from a URL string.
 * Supports youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
export function extractVideoId(url: string): string | undefined {
  if (!url) return undefined;
  const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (shortMatch) return shortMatch[1];
  const longMatch = url.match(/youtube\.com\/(?:watch\?v=|embed\/)([\w-]+)/);
  if (longMatch) return longMatch[1];
  if (/^[\w-]{11}$/.test(url)) return url;
  return undefined;
}

/**
 * Parse PGN headers from raw PGN text.
 */
function parseHeaders(pgn: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }
  return headers;
}

/**
 * Extract the movetext portion (after all headers) from PGN.
 */
function extractMovetext(pgn: string): string {
  // Remove only PGN header lines (lines matching [TagName "value"]),
  // NOT inline annotations like [%csl ...] or [%cal ...] inside comments
  return pgn.replace(/^\s*\[\w+\s+"[^"]*"\]\s*$/gm, '').trim();
}

/**
 * Split a PGN string that may contain multiple games into individual game strings.
 */
function splitPgnGames(pgn: string): string[] {
  const lines = pgn.split(/\r?\n/);
  const gameStartIndices: number[] = [];
  let inHeaders = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('[') && line.endsWith(']')) {
      if (!inHeaders) {
        gameStartIndices.push(i);
        inHeaders = true;
      }
    } else {
      inHeaders = false;
    }
  }

  if (gameStartIndices.length === 0) {
    return [pgn];
  }

  const games: string[] = [];
  for (let i = 0; i < gameStartIndices.length; i++) {
    const start = gameStartIndices[i];
    const end = i + 1 < gameStartIndices.length ? gameStartIndices[i + 1] : lines.length;
    const gameText = lines.slice(start, end).join('\n').trim();
    if (gameText) games.push(gameText);
  }

  return games;
}

/**
 * Parse a single game PGN string into a GameData object.
 */
function parseSingleGame(pgn: string): GameData {
  const headers = parseHeaders(pgn);
  const startFen = headers['FEN'] || START_FEN;
  const movetext = extractMovetext(pgn);
  const videoId = headers['VideoURL'] ? extractVideoId(headers['VideoURL']) : undefined;
  const variant = headers['Variant'] || undefined;

  const moveTree = parseMoveTree(movetext, startFen, variantToRules(variant));
  const moves = moveTree ? treeToFlatMoves(moveTree) : [];

  return { headers, moves, moveTree, startFen, videoId, variant };
}

/**
 * Parse a PGN string that may contain one or more games.
 */
export function parsePgn(pgn: string): GameData[] {
  const gameTexts = splitPgnGames(pgn);
  return gameTexts.map((text) => parseSingleGame(text));
}

/**
 * Convenience: parse a PGN and return the first game only.
 */
export function parsePgnFirst(pgn: string): GameData {
  const games = parsePgn(pgn);
  return games[0] ?? { headers: {}, moves: [], moveTree: null, startFen: START_FEN };
}
