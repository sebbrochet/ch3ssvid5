import { describe, it, expect } from 'vitest';
import { normalizeFen, findDeepestOpening } from './openingLookup';

describe('normalizeFen', () => {
  it('strips halfmove clock and fullmove number', () => {
    expect(normalizeFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3',
    );
  });

  it('handles FEN with no en-passant', () => {
    expect(normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
    );
  });

  it('handles FEN with partial castling rights', () => {
    expect(normalizeFen('r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2')).toBe(
      'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
    );
  });

  it('handles FEN with no castling rights', () => {
    expect(normalizeFen('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBe('8/8/8/8/8/8/8/4K3 w - -');
  });
});

describe('findDeepestOpening', () => {
  it('returns null when database is not loaded', () => {
    expect(findDeepestOpening(['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'])).toBeNull();
  });

  it('returns null for empty FEN list', () => {
    expect(findDeepestOpening([])).toBeNull();
  });
});
