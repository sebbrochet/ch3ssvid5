import { describe, it, expect } from 'vitest';
import { parsePgn, extractVideoId } from './pgnParser';

describe('extractVideoId', () => {
  it('extracts from youtube.com/watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts raw 11-char ID', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns undefined for empty or invalid', () => {
    expect(extractVideoId('')).toBeUndefined();
    expect(extractVideoId('not-a-url')).toBeUndefined();
  });
});

describe('parsePgn', () => {
  it('parses a single game', () => {
    const pgn = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0`;

    const games = parsePgn(pgn);
    expect(games).toHaveLength(1);
    expect(games[0].headers['White']).toBe('Alice');
    expect(games[0].headers['Black']).toBe('Bob');
    expect(games[0].moveTree?.san).toBe('e4');
  });

  it('parses multi-game PGN', () => {
    const pgn = `[Event "Game 1"]
[Result "*"]

1. e4 e5 *

[Event "Game 2"]
[Result "*"]

1. d4 d5 *`;

    const games = parsePgn(pgn);
    expect(games).toHaveLength(2);
    expect(games[0].headers['Event']).toBe('Game 1');
    expect(games[0].moveTree?.san).toBe('e4');
    expect(games[1].headers['Event']).toBe('Game 2');
    expect(games[1].moveTree?.san).toBe('d4');
  });

  it('extracts videoId from VideoURL header', () => {
    const pgn = `[Event "Test"]
[VideoURL "https://www.youtube.com/watch?v=abc12345678"]
[Result "*"]

1. e4 *`;

    const games = parsePgn(pgn);
    expect(games[0].videoId).toBe('abc12345678');
  });

  it('handles empty PGN', () => {
    const games = parsePgn('[Result "*"]\n\n*');
    expect(games).toHaveLength(1);
    expect(games[0].moveTree).toBeNull();
  });
});
