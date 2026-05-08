import { describe, it, expect } from 'vitest';
import { parseInfoLine } from './useStockfish';

describe('parseInfoLine', () => {
  it('returns null for non-info lines', () => {
    expect(parseInfoLine('readyok', false)).toBeNull();
    expect(parseInfoLine('bestmove e2e4', false)).toBeNull();
  });

  it('returns null for info lines without score', () => {
    expect(parseInfoLine('info depth 10 nodes 12345', false)).toBeNull();
  });

  it('skips non-primary multipv lines', () => {
    expect(parseInfoLine('info depth 10 multipv 2 score cp 50 pv d2d4', false)).toBeNull();
  });

  it('parses centipawn score when White to move', () => {
    const result = parseInfoLine(
      'info depth 18 seldepth 24 multipv 1 score cp 54 nodes 123456 nps 1234567 time 100 pv e2e4 e7e5',
      false,
    );
    expect(result).not.toBeNull();
    expect(result!.eval).toBe('0.54');
    expect(result!.depth).toBe(18);
  });

  it('parses negative centipawn score when White to move', () => {
    const result = parseInfoLine('info depth 12 score cp -150 pv d7d5', false);
    expect(result!.eval).toBe('-1.50');
  });

  it('negates score when Black to move (positive cp)', () => {
    // Stockfish says +54 from Black's perspective → -0.54 from White's perspective
    const result = parseInfoLine('info depth 18 score cp 54 pv e7e5', true);
    expect(result!.eval).toBe('-0.54');
  });

  it('negates score when Black to move (negative cp)', () => {
    // Stockfish says -200 from Black's perspective → +2.00 from White's perspective
    const result = parseInfoLine('info depth 15 score cp -200 pv e7e5', true);
    expect(result!.eval).toBe('2.00');
  });

  it('parses mate score when White to move', () => {
    const result = parseInfoLine('info depth 20 score mate 5 pv e2e4', false);
    expect(result!.eval).toBe('#5');
  });

  it('parses negative mate score when White to move', () => {
    const result = parseInfoLine('info depth 20 score mate -3 pv e7e5', false);
    expect(result!.eval).toBe('#-3');
  });

  it('negates mate score when Black to move', () => {
    // Stockfish says mate in 5 from Black's perspective → mate in -5 from White's
    const result = parseInfoLine('info depth 20 score mate 5 pv e7e5', true);
    expect(result!.eval).toBe('#-5');
  });

  it('negates negative mate when Black to move', () => {
    // Stockfish says mate in -3 from Black's perspective → mate in 3 from White's
    const result = parseInfoLine('info depth 20 score mate -3 pv e7e5', true);
    expect(result!.eval).toBe('#3');
  });

  it('parses principal variation', () => {
    const result = parseInfoLine('info depth 10 score cp 30 pv e2e4 e7e5 g1f3', false);
    expect(result!.pv).toEqual(['e2e4', 'e7e5', 'g1f3']);
  });

  it('allows multipv 1 (primary line)', () => {
    const result = parseInfoLine('info depth 10 multipv 1 score cp 30 pv e2e4', false);
    expect(result).not.toBeNull();
    expect(result!.eval).toBe('0.30');
  });

  it('handles zero eval', () => {
    const result = parseInfoLine('info depth 10 score cp 0 pv e2e4', false);
    expect(result!.eval).toBe('0.00');
  });

  it('handles zero eval with Black to move', () => {
    const result = parseInfoLine('info depth 10 score cp 0 pv e7e5', true);
    expect(result!.eval).toBe('0.00');
  });
});
