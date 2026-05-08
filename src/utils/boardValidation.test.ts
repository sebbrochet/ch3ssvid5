import { describe, it, expect } from 'vitest';
import { validatePosition } from './boardValidation';

describe('validatePosition', () => {
  it('accepts standard starting position', () => {
    const result = validatePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    expect(result).toEqual({ valid: true });
  });

  it('accepts a simple valid position', () => {
    const result = validatePosition('4k3/8/8/8/8/8/8/4K3');
    expect(result).toEqual({ valid: true });
  });

  it('rejects missing white king', () => {
    const result = validatePosition('4k3/8/8/8/8/8/8/8');
    expect(result).toEqual({ valid: false, error: 'editor.noWhiteKing' });
  });

  it('rejects missing black king', () => {
    const result = validatePosition('8/8/8/8/8/8/8/4K3');
    expect(result).toEqual({ valid: false, error: 'editor.noBlackKing' });
  });

  it('rejects multiple white kings', () => {
    const result = validatePosition('4k3/8/8/8/8/8/8/3KK3');
    expect(result).toEqual({ valid: false, error: 'editor.multipleWhiteKings' });
  });

  it('rejects multiple black kings', () => {
    const result = validatePosition('3kk3/8/8/8/8/8/8/4K3');
    expect(result).toEqual({ valid: false, error: 'editor.multipleBlackKings' });
  });

  it('rejects white pawn on rank 8', () => {
    const result = validatePosition('P3k3/8/8/8/8/8/8/4K3');
    expect(result).toEqual({ valid: false, error: 'editor.pawnsOnEdge' });
  });

  it('rejects black pawn on rank 1', () => {
    const result = validatePosition('4k3/8/8/8/8/8/8/4K2p');
    expect(result).toEqual({ valid: false, error: 'editor.pawnsOnEdge' });
  });

  it('rejects white pawn on rank 1', () => {
    const result = validatePosition('4k3/8/8/8/8/8/8/P3K3');
    expect(result).toEqual({ valid: false, error: 'editor.pawnsOnEdge' });
  });

  it('rejects black pawn on rank 8', () => {
    const result = validatePosition('p3k3/8/8/8/8/8/8/4K3');
    expect(result).toEqual({ valid: false, error: 'editor.pawnsOnEdge' });
  });

  it('accepts pawns on ranks 2-7', () => {
    const result = validatePosition('4k3/P7/8/8/8/8/p7/4K3');
    expect(result).toEqual({ valid: true });
  });

  it('prioritizes king errors over pawn errors', () => {
    // No white king + pawn on edge — should report king error first
    const result = validatePosition('P3k3/8/8/8/8/8/8/8');
    expect(result).toEqual({ valid: false, error: 'editor.noWhiteKing' });
  });
});
