import { describe, it, expect } from 'vitest';
import { chess960NumberToFen, fenToChess960Number, randomChess960Number } from './chess960';

describe('chess960NumberToFen', () => {
  it('position 518 is standard chess', () => {
    const fen = chess960NumberToFen(518);
    expect(fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('position 0 is valid', () => {
    const fen = chess960NumberToFen(0);
    expect(fen).not.toBeNull();
    expect(fen).toContain('/pppppppp/8/8/8/8/PPPPPPPP/');
  });

  it('position 959 is valid', () => {
    const fen = chess960NumberToFen(959);
    expect(fen).not.toBeNull();
  });

  it('returns null for -1', () => {
    expect(chess960NumberToFen(-1)).toBeNull();
  });

  it('returns null for 960', () => {
    expect(chess960NumberToFen(960)).toBeNull();
  });

  it('returns null for non-integer', () => {
    expect(chess960NumberToFen(1.5)).toBeNull();
  });

  it('all 960 positions have king between rooks', () => {
    for (let n = 0; n < 960; n++) {
      const fen = chess960NumberToFen(n)!;
      const whiteRank = fen.split('/')[7].split(' ')[0];
      const rook1 = whiteRank.indexOf('R');
      const king = whiteRank.indexOf('K');
      const rook2 = whiteRank.lastIndexOf('R');
      expect(rook1).toBeLessThan(king);
      expect(king).toBeLessThan(rook2);
    }
  });

  it('all 960 positions have bishops on opposite colors', () => {
    for (let n = 0; n < 960; n++) {
      const fen = chess960NumberToFen(n)!;
      const whiteRank = fen.split('/')[7].split(' ')[0];
      const b1 = whiteRank.indexOf('B');
      const b2 = whiteRank.lastIndexOf('B');
      expect((b1 + b2) % 2).toBe(1); // opposite parity
    }
  });

  it('all 960 positions are unique', () => {
    const fens = new Set<string>();
    for (let n = 0; n < 960; n++) {
      fens.add(chess960NumberToFen(n)!);
    }
    expect(fens.size).toBe(960);
  });
});

describe('fenToChess960Number', () => {
  it('standard position is 518', () => {
    expect(fenToChess960Number('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(518);
  });

  it('round-trips all 960 positions', () => {
    for (let n = 0; n < 960; n++) {
      const fen = chess960NumberToFen(n)!;
      expect(fenToChess960Number(fen)).toBe(n);
    }
  });

  it('returns null for non-Chess960 FEN', () => {
    // Position after 1.e4
    expect(fenToChess960Number('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBeNull();
  });

  it('returns null for invalid FEN', () => {
    expect(fenToChess960Number('garbage')).toBeNull();
  });
});

describe('randomChess960Number', () => {
  it('returns a number between 0 and 959', () => {
    for (let i = 0; i < 20; i++) {
      const n = randomChess960Number();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(959);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});
