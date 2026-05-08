import { describe, it, expect } from 'vitest';
import { fenToPosition, chessgroundDests, isPromotion, applyMove, applySan } from './chessPosition';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('fenToPosition', () => {
  it('parses starting position', () => {
    const pos = fenToPosition(START_FEN);
    expect(pos).not.toBeNull();
    expect(pos!.turn).toBe('white');
  });

  it('returns null for invalid FEN', () => {
    expect(fenToPosition('garbage')).toBeNull();
  });

  it('parses a mid-game FEN', () => {
    const pos = fenToPosition('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(pos).not.toBeNull();
    expect(pos!.turn).toBe('black');
  });
});

describe('chessgroundDests', () => {
  it('returns legal dests from starting position', () => {
    const pos = fenToPosition(START_FEN)!;
    const dests = chessgroundDests(pos);
    expect(dests.size).toBeGreaterThan(0);
    expect(dests.get('e2')).toContain('e3');
    expect(dests.get('e2')).toContain('e4');
    expect(dests.get('b1')).toContain('a3');
    expect(dests.get('b1')).toContain('c3');
  });
});

describe('Position direct access', () => {
  it('turn is white for starting position', () => {
    const pos = fenToPosition(START_FEN)!;
    expect(pos.turn).toBe('white');
  });

  it('turn is black after 1.e4', () => {
    const pos = fenToPosition('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')!;
    expect(pos.turn).toBe('black');
  });

  it('isCheck returns false for starting position', () => {
    const pos = fenToPosition(START_FEN)!;
    expect(pos.isCheck()).toBe(false);
  });

  it('isCheck returns true when king is in check', () => {
    const pos = fenToPosition('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4')!;
    expect(pos.isCheck()).toBe(true);
  });
});

describe('isPromotion', () => {
  it('returns true for pawn moving to rank 8', () => {
    const pos = fenToPosition('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1')!;
    expect(isPromotion(pos, 'e7', 'e8')).toBe(true);
  });

  it('returns true for black pawn moving to rank 1', () => {
    const pos = fenToPosition('4k3/8/8/8/8/8/4p3/4K3 b - - 0 1')!;
    expect(isPromotion(pos, 'e2', 'e1')).toBe(true);
  });

  it('returns false for regular pawn move', () => {
    const pos = fenToPosition(START_FEN)!;
    expect(isPromotion(pos, 'e2', 'e4')).toBe(false);
  });

  it('returns false for non-pawn piece', () => {
    const pos = fenToPosition(START_FEN)!;
    expect(isPromotion(pos, 'b1', 'c3')).toBe(false);
  });
});

describe('applyMove', () => {
  it('applies e2-e4 from starting position', () => {
    const pos = fenToPosition(START_FEN)!;
    const result = applyMove(pos, 'e2', 'e4');
    expect(result).not.toBeNull();
    expect(result!.san).toBe('e4');
    expect(result!.newFen).toContain('4P3');
    expect(result!.newFen).toContain(' b ');
  });

  it('returns null for illegal move', () => {
    const pos = fenToPosition(START_FEN)!;
    expect(applyMove(pos, 'e2', 'e5')).toBeNull();
  });

  it('handles promotion', () => {
    const pos = fenToPosition('7k/4P3/8/8/8/8/8/4K3 w - - 0 1')!;
    const result = applyMove(pos, 'e7', 'e8', 'queen');
    expect(result).not.toBeNull();
    expect(result!.san).toBe('e8=Q+');
  });
});

describe('applySan', () => {
  it('applies e4 from starting position', () => {
    const result = applySan(START_FEN, 'e4');
    expect(result).not.toBeNull();
    expect(result!.san).toBe('e4');
    expect(result!.newFen).toContain(' b ');
  });

  it('applies Nf3', () => {
    const result = applySan(START_FEN, 'Nf3');
    expect(result).not.toBeNull();
    expect(result!.san).toBe('Nf3');
  });

  it('returns null for illegal SAN', () => {
    expect(applySan(START_FEN, 'Nf4')).toBeNull();
  });

  it('returns null for invalid FEN', () => {
    expect(applySan('garbage', 'e4')).toBeNull();
  });

  it('handles castling', () => {
    const castleFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const result = applySan(castleFen, 'O-O');
    expect(result).not.toBeNull();
    expect(result!.san).toBe('O-O');
  });
});
