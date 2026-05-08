/**
 * Chess position helpers using chessops.
 * Only wraps operations that combine multiple chessops calls.
 * For simple one-liners (pos.turn, pos.isCheck()), use chessops directly.
 */
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseSan, makeSan } from 'chessops/san';
import { parseSquare, makeSquare } from 'chessops/util';
import { setupPosition } from 'chessops/variant';
import type { Position } from 'chessops/chess';
import type { Rules } from 'chessops/types';
import type { Move, Role, Square } from 'chessops/types';

// Re-export chessops essentials for convenient imports
export { chessgroundDests } from 'chessops/compat';
export { makeFen, parseFen } from 'chessops/fen';
export type { Position } from 'chessops/chess';
export type { Rules } from 'chessops/types';

/** Map PGN [Variant] header values to chessops Rules. */
export function variantToRules(variant?: string): Rules {
  if (!variant) return 'chess';
  switch (variant.toLowerCase()) {
    case 'chess960':
      return 'chess';
    case 'kingofthehill':
      return 'kingofthehill';
    case 'threecheck':
    case '3check':
      return '3check';
    case 'antichess':
      return 'antichess';
    case 'atomic':
      return 'atomic';
    case 'crazyhouse':
      return 'crazyhouse';
    case 'horde':
      return 'horde';
    case 'racingkings':
      return 'racingkings';
    default:
      return 'chess';
  }
}

/** Check if a variant is supported by standard Stockfish. */
export function isEngineSupported(variant?: string): boolean {
  if (!variant) return true;
  const v = variant.toLowerCase();
  return v === 'standard' || v === 'chess960' || v === '';
}

/** Create a Position from a FEN string, optionally for a specific variant. */
export function fenToPosition(fen: string, rules: Rules = 'chess'): Position | null {
  try {
    const setup = parseFen(fen).unwrap();
    if (rules === 'chess') {
      return Chess.fromSetup(setup).unwrap();
    }
    return setupPosition(rules, setup).unwrap();
  } catch {
    return null;
  }
}

/** Check if a move from→to would be a pawn promotion. */
export function isPromotion(pos: Position, from: string, to: string): boolean {
  const fromSq = parseSquare(from);
  const toSq = parseSquare(to);
  if (fromSq === undefined || toSq === undefined) return false;
  const piece = pos.board.get(fromSq);
  if (!piece || piece.role !== 'pawn') return false;
  const toRank = toSq >> 3;
  return toRank === 0 || toRank === 7;
}

export interface MoveResult {
  san: string;
  newFen: string;
  color: 'w' | 'b';
  from: string;
  to: string;
}

/** Helper to extract from/to as square names from a Move */
function moveSquares(move: Move): { from: string; to: string } {
  if ('from' in move) {
    return { from: makeSquare(move.from as Square), to: makeSquare(move.to as Square) };
  }
  return { from: makeSquare(move.to as Square), to: makeSquare(move.to as Square) };
}

/** Apply a UCI-style move (from, to, optional promotion) and return MoveResult or null. */
export function applyMove(pos: Position, from: string, to: string, promotion?: Role): MoveResult | null {
  const fromSq = parseSquare(from);
  const toSq = parseSquare(to);
  if (fromSq === undefined || toSq === undefined) return null;

  const move: Move = promotion ? { from: fromSq, to: toSq, promotion } : { from: fromSq, to: toSq };

  if (!pos.isLegal(move)) return null;

  const color = pos.turn === 'white' ? ('w' as const) : ('b' as const);
  const san = makeSan(pos, move);
  pos.play(move);
  return { san, newFen: makeFen(pos.toSetup()), color, from, to };
}

/** Apply a SAN move to a FEN and return MoveResult or null. */
export function applySan(fen: string, san: string, rules: Rules = 'chess'): MoveResult | null {
  const pos = fenToPosition(fen, rules);
  if (!pos) return null;
  return applySanToPos(pos, san);
}

/** Apply a SAN move to an existing Position (mutates it) and return MoveResult or null. */
export function applySanToPos(pos: Position, san: string): MoveResult | null {
  const move = parseSan(pos, san);
  if (!move) return null;
  const color = pos.turn === 'white' ? ('w' as const) : ('b' as const);
  const normalizedSan = makeSan(pos, move);
  const squares = moveSquares(move);
  pos.play(move);
  return { san: normalizedSan, newFen: makeFen(pos.toSetup()), color, ...squares };
}
