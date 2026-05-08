import { describe, it, expect } from 'vitest';
import {
  findBestGameAndNode,
  resolveVideoForGame,
  resolveOrientation,
  clampGameIndex,
  getFirstTimestamp,
  propagateVideoUrl,
} from './gameSync';
import { parseMoveTree } from './moveTree';
import type { GameData } from '../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Helper to build a GameData with timestamped moves */
function makeGame(movetext: string, headers: Record<string, string> = {}): GameData {
  const tree = parseMoveTree(movetext, START_FEN);
  return {
    headers: { Result: '*', ...headers },
    moves: [],
    moveTree: tree,
    startFen: START_FEN,
    videoId: headers['VideoURL'] ? 'test-id' : undefined,
  };
}

// ─── findBestGameAndNode ──────────────────────────────────────────────────────

describe('findBestGameAndNode', () => {
  it('returns the correct node within a single game', () => {
    const game = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]} 2. Nf3 {[%ts 0:30]}');
    const result = findBestGameAndNode([game], 15, 0, {});
    expect(result.gameIndex).toBe(0);
    expect(result.nodeId).toBe(game.moveTree!.id); // e4 at 10s is best for t=15
  });

  it('returns null nodeId when time is before any timestamp', () => {
    const game = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    const result = findBestGameAndNode([game], 5, 0, {});
    expect(result.gameIndex).toBe(0);
    expect(result.nodeId).toBeNull();
  });

  it('switches to a better matching game', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    const game2 = makeGame('1. d4 {[%ts 0:25]} d5 {[%ts 0:35]}');
    const allGames = [game1, game2];

    // At t=28, game2's d4 (25s) is a better match than game1's e5 (20s)
    const result = findBestGameAndNode(allGames, 28, 0, {});
    expect(result.gameIndex).toBe(1);
    expect(result.nodeId).toBe(game2.moveTree!.id);
  });

  it('stays on the current game when its match is best', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    const game2 = makeGame('1. d4 {[%ts 0:25]} d5 {[%ts 0:35]}');
    const allGames = [game1, game2];

    // At t=12, game1's e4 (10s) is the only match
    const result = findBestGameAndNode(allGames, 12, 0, {});
    expect(result.gameIndex).toBe(0);
    expect(result.nodeId).toBe(game1.moveTree!.id);
  });

  it('uses override timestamps for the current game', () => {
    const game = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    const e4Id = game.moveTree!.id;
    // Override e4's timestamp to 50s
    const overrides = { [e4Id]: 50 };
    const result = findBestGameAndNode([game], 55, 0, overrides);
    expect(result.nodeId).toBe(e4Id);
  });

  it('does not use override timestamps for other games', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    const game2 = makeGame('1. d4 {[%ts 0:25]} d5 {[%ts 0:35]}');
    // Even with overrides for game2, they shouldn't be used when game2 is not current
    const result = findBestGameAndNode([game1, game2], 28, 0, {});
    expect(result.gameIndex).toBe(1);
  });

  it('handles interleaved timestamps across games', () => {
    // Game 1: timestamps at 10s, 20s, 30s
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]} 2. Nf3 {[%ts 0:30]}');
    // Game 2: timestamps at 15s, 25s, 35s
    const game2 = makeGame('1. d4 {[%ts 0:15]} d5 {[%ts 0:25]} 2. c4 {[%ts 0:35]}');
    const allGames = [game1, game2];

    // At 17s, game2's d4 (15s) beats game1's e4 (10s)
    const r1 = findBestGameAndNode(allGames, 17, 0, {});
    expect(r1.gameIndex).toBe(1);

    // At 22s, game1's e5 (20s) beats game2's d4 (15s)
    const r2 = findBestGameAndNode(allGames, 22, 0, {});
    expect(r2.gameIndex).toBe(0);

    // At 27s, game2's d5 (25s) beats game1's e5 (20s)
    const r3 = findBestGameAndNode(allGames, 27, 0, {});
    expect(r3.gameIndex).toBe(1);
  });

  it('handles game with no move tree', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]}');
    const emptyGame: GameData = {
      headers: { Result: '*' },
      moves: [],
      moveTree: null,
      startFen: START_FEN,
    };
    const result = findBestGameAndNode([game1, emptyGame], 15, 0, {});
    expect(result.gameIndex).toBe(0);
  });

  it('handles all games with no timestamps', () => {
    const game1 = makeGame('1. e4 e5');
    const game2 = makeGame('1. d4 d5');
    const result = findBestGameAndNode([game1, game2], 15, 0, {});
    expect(result.nodeId).toBeNull();
  });

  it('skips games with a different VideoURL when currentVideoId is provided', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const game2 = makeGame('1. d4 {[%ts 0:15]} d5 {[%ts 0:25]}', { VideoURL: 'https://youtube.com/watch?v=BBB' });
    const allGames = [game1, game2];

    // Without video filtering, game2's d4 (15s) would beat game1's e4 (10s) at t=17
    // With video filtering for AAA, game2 is skipped → stays on game1
    const result = findBestGameAndNode(allGames, 17, 0, {}, 'AAA');
    expect(result.gameIndex).toBe(0);
  });

  it('includes games with matching VideoURL', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const game2 = makeGame('1. d4 {[%ts 0:15]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const allGames = [game1, game2];

    // Both games share video AAA, so game2 should be considered
    const result = findBestGameAndNode(allGames, 17, 0, {}, 'AAA');
    expect(result.gameIndex).toBe(1);
  });

  it('includes games without VideoURL header (they inherit global video)', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const game2 = makeGame('1. d4 {[%ts 0:15]}'); // no VideoURL = inherits global
    const allGames = [game1, game2];

    // game2 has no VideoURL so it's treated as sharing the global video
    const result = findBestGameAndNode(allGames, 17, 0, {}, 'AAA');
    expect(result.gameIndex).toBe(1);
  });

  it('stays on current game when video ends and no other game matches', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const game2 = makeGame('1. d4 {[%ts 0:50]} d5 {[%ts 1:00]}', { VideoURL: 'https://youtube.com/watch?v=BBB' });
    const allGames = [game1, game2];

    // At t=45, game1's last move was at 20s. game2 has a closer match (d4 at 50s)
    // but it's a different video — should stay on game1
    const result = findBestGameAndNode(allGames, 45, 0, {}, 'AAA');
    expect(result.gameIndex).toBe(0);
  });

  it('behaves as before when no currentVideoId is provided (backward compat)', () => {
    const game1 = makeGame('1. e4 {[%ts 0:10]}', { VideoURL: 'https://youtube.com/watch?v=AAA' });
    const game2 = makeGame('1. d4 {[%ts 0:15]}', { VideoURL: 'https://youtube.com/watch?v=BBB' });
    const allGames = [game1, game2];

    // Without currentVideoId, all games are considered (legacy behavior)
    const result = findBestGameAndNode(allGames, 17, 0, {});
    expect(result.gameIndex).toBe(1);
  });
});

// ─── resolveVideoForGame ──────────────────────────────────────────────────────

describe('resolveVideoForGame', () => {
  it('returns videoUrl and videoId when game has VideoURL header', () => {
    const game = makeGame('1. e4', { VideoURL: 'https://www.youtube.com/watch?v=abc12345678' });
    const result = resolveVideoForGame(game);
    expect(result).toEqual({ videoUrl: 'https://www.youtube.com/watch?v=abc12345678', videoId: 'abc12345678' });
  });

  it('returns null when game has no VideoURL header', () => {
    const game = makeGame('1. e4');
    expect(resolveVideoForGame(game)).toBeNull();
  });

  it('returns null for undefined game', () => {
    expect(resolveVideoForGame(undefined)).toBeNull();
  });

  it('returns null for invalid VideoURL', () => {
    const game = makeGame('1. e4', { VideoURL: 'not-a-url' });
    expect(resolveVideoForGame(game)).toBeNull();
  });
});

// ─── resolveOrientation ───────────────────────────────────────────────────────

describe('resolveOrientation', () => {
  it('returns white by default', () => {
    const game = makeGame('1. e4');
    expect(resolveOrientation(game)).toBe('white');
  });

  it('returns black when header is set', () => {
    const game = makeGame('1. e4', { Orientation: 'black' });
    expect(resolveOrientation(game)).toBe('black');
  });

  it('returns white for undefined game', () => {
    expect(resolveOrientation(undefined)).toBe('white');
  });
});

// ─── clampGameIndex ───────────────────────────────────────────────────────────

describe('clampGameIndex', () => {
  it('returns 0 for empty list', () => {
    expect(clampGameIndex(5, 0)).toBe(0);
  });

  it('clamps to last index', () => {
    expect(clampGameIndex(10, 3)).toBe(2);
  });

  it('returns same index when within range', () => {
    expect(clampGameIndex(1, 3)).toBe(1);
  });

  it('handles index at boundary', () => {
    expect(clampGameIndex(2, 3)).toBe(2);
  });
});

// ─── getFirstTimestamp ────────────────────────────────────────────────────────

describe('getFirstTimestamp', () => {
  it('returns the first timestamp', () => {
    const game = makeGame('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}');
    expect(getFirstTimestamp(game)).toBe(10);
  });

  it('returns null when no timestamps', () => {
    const game = makeGame('1. e4 e5');
    expect(getFirstTimestamp(game)).toBeNull();
  });

  it('returns null for undefined game', () => {
    expect(getFirstTimestamp(undefined)).toBeNull();
  });

  it('returns null for game with no move tree', () => {
    const game: GameData = {
      headers: { Result: '*' },
      moves: [],
      moveTree: null,
      startFen: START_FEN,
    };
    expect(getFirstTimestamp(game)).toBeNull();
  });
});

// ─── propagateVideoUrl ────────────────────────────────────────────────────────

describe('propagateVideoUrl', () => {
  it('sets VideoURL on the current game', () => {
    const game = makeGame('1. e4');
    const result = propagateVideoUrl([game], 0, 'https://youtube.com/watch?v=test');
    expect(result[0]['VideoURL']).toBe('https://youtube.com/watch?v=test');
  });

  it('propagates to games without VideoURL', () => {
    const game1 = makeGame('1. e4');
    const game2 = makeGame('1. d4');
    const result = propagateVideoUrl([game1, game2], 0, 'https://youtube.com/watch?v=test');
    expect(result[0]['VideoURL']).toBe('https://youtube.com/watch?v=test');
    expect(result[1]['VideoURL']).toBe('https://youtube.com/watch?v=test');
  });

  it('does not overwrite existing VideoURL on other games', () => {
    const game1 = makeGame('1. e4');
    const game2 = makeGame('1. d4', { VideoURL: 'https://youtube.com/watch?v=existing' });
    const result = propagateVideoUrl([game1, game2], 0, 'https://youtube.com/watch?v=new');
    expect(result[0]['VideoURL']).toBe('https://youtube.com/watch?v=new');
    expect(result[1]['VideoURL']).toBe('https://youtube.com/watch?v=existing');
  });

  it('does not mutate original headers', () => {
    const game = makeGame('1. e4');
    const originalHeaders = { ...game.headers };
    propagateVideoUrl([game], 0, 'https://youtube.com/watch?v=test');
    expect(game.headers).toEqual(originalHeaders);
  });
});
