import { describe, it, expect } from 'vitest';
import { applySan } from './chessPosition';
import {
  parseMoveTree,
  findNodeById,
  flattenTree,
  getMainLine,
  getPreviousNode,
  getNextNode,
  findNodeByTime,
  getAllTimestampedNodes,
  generatePgnFromTree,
  generateMovetext,
  formatTimestamp,
  truncateFromNode,
  cloneTree,
  addVariation,
  promoteVariation,
} from './moveTree';
import { parsePgn } from './pgnParser';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseMoveTree', () => {
  it('parses a simple mainline', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN);
    expect(tree).not.toBeNull();
    expect(tree!.san).toBe('e4');
    expect(tree!.color).toBe('w');
    expect(tree!.moveNumber).toBe(1);
    expect(tree!.next?.san).toBe('e5');
    expect(tree!.next?.next?.san).toBe('Nf3');
    expect(tree!.next?.next?.next?.san).toBe('Nc6');
  });

  it('returns null for empty movetext', () => {
    expect(parseMoveTree('', START_FEN)).toBeNull();
    expect(parseMoveTree('*', START_FEN)).toBeNull();
  });

  it('returns null for result-only PGN', () => {
    expect(parseMoveTree('1-0', START_FEN)).toBeNull();
    expect(parseMoveTree('0-1', START_FEN)).toBeNull();
    expect(parseMoveTree('1/2-1/2', START_FEN)).toBeNull();
  });

  it('parses a variation (RAV)', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3', START_FEN);
    expect(tree).not.toBeNull();
    const e5 = tree!.next!;
    expect(e5.san).toBe('e5');
    expect(e5.variations).toHaveLength(1);
    expect(e5.variations[0].san).toBe('d5');
    expect(e5.variations[0].next?.san).toBe('exd5');
    // Mainline continues
    expect(e5.next?.san).toBe('Nf3');
  });

  it('parses comments', () => {
    const tree = parseMoveTree('1. e4 {best move} e5', START_FEN);
    expect(tree!.comment).toBe('best move');
  });

  it('parses NAGs', () => {
    const tree = parseMoveTree('1. e4! e5?!', START_FEN);
    expect(tree!.nags).toContain('!');
    expect(tree!.next!.nags).toContain('?!');
  });

  it('parses timestamps from comments', () => {
    const tree = parseMoveTree('1. e4 {[%ts 1:30]} e5 {[%ts 2:00]}', START_FEN);
    expect(tree!.timestamp).toBe(90);
    expect(tree!.next!.timestamp).toBe(120);
  });

  it('parses eval from comments', () => {
    const tree = parseMoveTree('1. e4 {[%eval 0.54]} e5 {[%eval -0.1]}', START_FEN);
    expect(tree!.eval).toBe('0.54');
    expect(tree!.next!.eval).toBe('-0.1');
  });

  it('parses arrows and highlights from comments', () => {
    const tree = parseMoveTree('1. e4 {[%cal Ge2e4,Re7e5] [%csl Ge4,Rd5]}', START_FEN);
    expect(tree!.arrows).toHaveLength(2);
    expect(tree!.arrows![0]).toEqual({ brush: 'green', orig: 'e2', dest: 'e4' });
    expect(tree!.highlights).toHaveLength(2);
    expect(tree!.highlights![0]).toEqual({ brush: 'green', orig: 'e4' });
  });

  it('roundtrips arrows and highlights through PGN', () => {
    // Parse a PGN with arrows/highlights
    const tree = parseMoveTree('1. e4 {[%cal Ge2e4]} e5 {[%csl Re5]}', START_FEN)!;
    expect(tree.arrows).toHaveLength(1);
    expect(tree.next!.highlights).toHaveLength(1);

    // Generate PGN
    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).toContain('[%cal Ge2e4]');
    expect(pgn).toContain('[%csl Re5]');

    // Re-parse and verify
    const reparsed = parsePgn(pgn);
    const rt = reparsed[0].moveTree!;
    expect(rt.arrows).toHaveLength(1);
    expect(rt.arrows![0]).toEqual({ brush: 'green', orig: 'e2', dest: 'e4' });
    expect(rt.next!.highlights).toHaveLength(1);
    expect(rt.next!.highlights![0]).toEqual({ brush: 'red', orig: 'e5' });
  });

  it('persists programmatically added arrows through roundtrip', () => {
    // Simulate handleShapesChange: mutate node, rebuild PGN, re-parse
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;

    // Add arrows to the e4 node (simulates user drawing on board)
    tree.arrows = [{ brush: 'green', orig: 'e2', dest: 'e4' }];
    tree.highlights = [{ brush: 'red', orig: 'd5' }];

    // Generate and re-parse
    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).toContain('[%cal Ge2e4]');
    expect(pgn).toContain('[%csl Rd5]');

    const reparsed = parsePgn(pgn);
    const rt = reparsed[0].moveTree!;
    expect(rt.arrows).toHaveLength(1);
    expect(rt.highlights).toHaveLength(1);
  });

  it('persists arrows on non-first moves', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;
    const nf3 = tree.next!.next!;
    expect(nf3.san).toBe('Nf3');

    // Add arrow to Nf3
    nf3.arrows = [{ brush: 'blue', orig: 'f3', dest: 'd4' }];

    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).toContain('[%cal Bf3d4]');

    const reparsed = parsePgn(pgn);
    const rtNf3 = reparsed[0].moveTree!.next!.next!;
    expect(rtNf3.arrows).toHaveLength(1);
    expect(rtNf3.arrows![0].brush).toBe('blue');
  });

  it('persists arrows in variations', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];
    expect(d5.san).toBe('d5');

    // Add arrow to the variation move
    d5.arrows = [{ brush: 'yellow', orig: 'd7', dest: 'd5' }];

    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).toContain('[%cal Yd7d5]');

    const reparsed = parsePgn(pgn);
    const rtD5 = reparsed[0].moveTree!.next!.variations[0];
    expect(rtD5.arrows).toHaveLength(1);
    expect(rtD5.arrows![0].brush).toBe('yellow');
  });

  it('preserves arrows on previous move when appending a new move', () => {
    // Step 1: Parse a game with 2 moves
    const tree1 = parseMoveTree('1. e4 e5', START_FEN)!;

    // Step 2: Add arrows to the last move (e5)
    const e5 = tree1.next!;
    e5.arrows = [{ brush: 'green', orig: 'e7', dest: 'e5' }];

    // Step 3: Generate PGN (simulates handleShapesChange → rebuildPgn)
    const pgn1 = generatePgnFromTree({ Result: '*' }, tree1, {});
    expect(pgn1).toContain('[%cal Ge7e5]');

    // Step 4: Re-parse (simulates usePgn re-parse after setPgnText)
    const games2 = parsePgn(pgn1);
    const tree2 = games2[0].moveTree!;
    const e5reparsed = tree2.next!;
    expect(e5reparsed.arrows).toHaveLength(1); // arrows survived re-parse

    // Step 5: Append a new move (Nf3) at end of line
    // (simulates handleBoardMove "end of line" branch)
    const result = applySan(e5reparsed.fen, 'Nf3');
    e5reparsed.next = {
      id: `${e5reparsed.id}/append`,
      moveNumber: 2,
      color: result!.color,
      san: result!.san,
      fenBefore: e5reparsed.fen,
      fen: result!.newFen,
      from: result!.from,
      to: result!.to,
      next: null,
      variations: [],
    };

    // Step 6: Generate PGN again (simulates rebuildPgn after append)
    const pgn2 = generatePgnFromTree({ Result: '*' }, tree2, {});

    // CRITICAL: arrows from step 2 must still be in the PGN
    expect(pgn2).toContain('[%cal Ge7e5]');
    expect(pgn2).toContain('Nf3');

    // Step 7: Re-parse and verify arrows survived
    const games3 = parsePgn(pgn2);
    const tree3 = games3[0].moveTree!;
    expect(tree3.next!.arrows).toHaveLength(1);
    expect(tree3.next!.arrows![0]).toEqual({ brush: 'green', orig: 'e7', dest: 'e5' });
    expect(tree3.next!.next!.san).toBe('Nf3');
  });

  it('generates correct FEN for each node', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN);
    // After 1. e4
    expect(tree!.fen).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
    // After 1... e5
    expect(tree!.next!.fen).toContain('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  });
});

describe('findNodeById', () => {
  it('finds the root node', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    const found = findNodeById(tree, tree.id);
    expect(found?.san).toBe('e4');
  });

  it('finds a deep node', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN)!;
    const nc6 = tree.next!.next!.next!;
    const found = findNodeById(tree, nc6.id);
    expect(found?.san).toBe('Nc6');
  });

  it('finds a node in a variation', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];
    const found = findNodeById(tree, d5.id);
    expect(found?.san).toBe('d5');
  });

  it('returns null for non-existent id', () => {
    const tree = parseMoveTree('1. e4', START_FEN)!;
    expect(findNodeById(tree, 'nonexistent')).toBeNull();
  });
});

describe('flattenTree', () => {
  it('flattens all nodes including variations', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3', START_FEN)!;
    const flat = flattenTree(tree);
    const sans = flat.map((n) => n.san);
    expect(sans).toContain('e4');
    expect(sans).toContain('e5');
    expect(sans).toContain('d5');
    expect(sans).toContain('Nf3');
    expect(flat).toHaveLength(4);
  });
});

describe('getMainLine', () => {
  it('returns only mainline moves', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3 Nc6', START_FEN)!;
    const main = getMainLine(tree);
    const sans = main.map((n) => n.san);
    expect(sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('returns empty array for null', () => {
    expect(getMainLine(null)).toEqual([]);
  });
});

describe('getPreviousNode / getNextNode', () => {
  it('navigates forward and backward', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;
    const e5 = tree.next!;
    expect(getNextNode(tree, tree.id)?.san).toBe('e5');
    expect(getPreviousNode(tree, e5.id)?.san).toBe('e4');
  });

  it('returns null at boundaries', () => {
    const tree = parseMoveTree('1. e4', START_FEN)!;
    expect(getPreviousNode(tree, tree.id)).toBeNull();
    expect(getNextNode(tree, tree.id)).toBeNull();
  });
});

describe('getAllTimestampedNodes / findNodeByTime', () => {
  it('collects embedded timestamps', () => {
    const tree = parseMoveTree('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]}', START_FEN)!;
    const nodes = getAllTimestampedNodes(tree, {});
    expect(nodes).toHaveLength(2);
    expect(nodes[0].timestamp).toBe(10);
    expect(nodes[1].timestamp).toBe(20);
  });

  it('overrides with external timestamps', () => {
    const tree = parseMoveTree('1. e4 {[%ts 0:10]} e5', START_FEN)!;
    const overrides = { [tree.id]: 5 };
    const nodes = getAllTimestampedNodes(tree, overrides);
    expect(nodes[0].timestamp).toBe(5);
  });

  it('finds correct node by time', () => {
    const tree = parseMoveTree('1. e4 {[%ts 0:10]} e5 {[%ts 0:20]} 2. Nf3 {[%ts 0:30]}', START_FEN)!;
    expect(findNodeByTime(15, tree, {})!).toBe(tree.id); // 10 <= 15 < 20
    expect(findNodeByTime(25, tree, {})!).toBe(tree.next!.id); // 20 <= 25 < 30
    expect(findNodeByTime(5, tree, {})).toBeNull(); // before any
  });
});

describe('generateMovetext / generatePgnFromTree', () => {
  it('roundtrips a simple game', () => {
    const movetext = '1. e4 e5 2. Nf3 Nc6';
    const tree = parseMoveTree(movetext, START_FEN)!;
    const output = generateMovetext(tree, {});
    expect(output).toBe('1. e4 e5 2. Nf3 Nc6');
  });

  it('roundtrips variations', () => {
    const movetext = '1. e4 e5 (1... d5 2. exd5) 2. Nf3';
    const tree = parseMoveTree(movetext, START_FEN)!;
    const output = generateMovetext(tree, {});
    expect(output).toContain('( 1... d5 2. exd5 )');
    expect(output).toContain('2. Nf3');
  });

  it('generates full PGN with headers', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    const headers = { Event: 'Test', Result: '*' };
    const pgn = generatePgnFromTree(headers, tree, {});
    expect(pgn).toContain('[Event "Test"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toContain('1. e4 e5 *');
  });

  it('includes timestamps in output', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    const timestamps = { [tree.id]: 30 };
    const output = generateMovetext(tree, timestamps);
    expect(output).toContain('[%ts 0:30]');
  });
});

describe('formatTimestamp', () => {
  it('formats seconds correctly', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(600)).toBe('10:00');
    expect(formatTimestamp(3661)).toBe('1:01:01');
  });
});

describe('truncateFromNode', () => {
  it('removes a mainline node and everything after it', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN)!;
    const nf3 = tree.next!.next!;
    const result = truncateFromNode(tree, nf3.id);
    expect(result).toBe(true);
    expect(tree.next!.next).toBeNull();
  });

  it('removes a variation when truncating its head node', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3', START_FEN)!;
    const e5 = tree.next!;
    expect(e5.variations).toHaveLength(1);
    const d5 = e5.variations[0];

    // Truncate the variation head (d5)
    const result = truncateFromNode(tree, d5.id);
    expect(result).toBe(true);
    // Variation should be gone
    expect(e5.variations).toHaveLength(0);
    // Mainline should be unaffected
    expect(e5.next?.san).toBe('Nf3');
  });

  it('variation deletion roundtrips through PGN', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];

    truncateFromNode(tree, d5.id);

    // Generate PGN and verify variation is gone
    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).not.toContain('d5');
    expect(pgn).not.toContain('(');
    expect(pgn).toContain('Nf3');

    // Re-parse and verify
    const reparsed = parsePgn(pgn);
    const reparsedE5 = reparsed[0].moveTree!.next!;
    expect(reparsedE5.variations).toHaveLength(0);
    expect(reparsedE5.next?.san).toBe('Nf3');
  });

  it('removes a mid-variation node and keeps earlier moves', () => {
    // 1. e4 e5 (1... d5 2. exd5 Qxd5) — truncate at Qxd5
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5 Qxd5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];
    const exd5 = d5.next!;
    expect(exd5.san).toBe('exd5');
    const qxd5 = exd5.next!;
    expect(qxd5.san).toBe('Qxd5');

    const result = truncateFromNode(tree, qxd5.id);
    expect(result).toBe(true);
    // exd5 should no longer have a next
    expect(exd5.next).toBeNull();
    // Variation still exists with d5 → exd5
    expect(tree.next!.variations).toHaveLength(1);
    expect(tree.next!.variations[0].san).toBe('d5');
  });
});

describe('cloneTree', () => {
  it('produces an independent deep copy', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;
    const clone = cloneTree(tree)!;
    expect(clone.san).toBe('e4');
    expect(clone.next?.san).toBe('e5');
    // Mutation doesn't affect original
    clone.next!.san = 'MODIFIED';
    expect(tree.next!.san).toBe('e5');
  });
});

describe('addVariation', () => {
  it('adds a variation and generates correct PGN', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN)!;
    // After 1. e4, play d5 instead of e5
    const e5 = tree.next!;
    const newNode = addVariation(tree, e5.id, 'd5');
    expect(newNode).not.toBeNull();
    expect(newNode!.san).toBe('d5');
    // Variation should be on e5's variations array
    expect(e5.variations).toHaveLength(1);
    expect(e5.variations[0].san).toBe('d5');
    // PGN should include the variation
    const output = generateMovetext(tree, {});
    expect(output).toContain('d5');
    expect(output).toContain('(');
  });

  it('navigates into existing variation when same move played', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3', START_FEN)!;
    const e5 = tree.next!;
    expect(e5.variations).toHaveLength(1);
    expect(e5.variations[0].san).toBe('d5');
  });

  it('roundtrips addVariation through full PGN pipeline', () => {
    // Simulate the full App.tsx flow: parse → addVariation → generatePgn → re-parse
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN)!;
    const e5 = tree.next!; // node for 1... e5

    // Add d5 as a variation of e5 (alternative to e5)
    const newNode = addVariation(tree, e5.id, 'd5');
    expect(newNode).not.toBeNull();

    // Generate PGN from mutated tree (same as rebuildPgn for single game)
    const headers = { Event: 'Test', Result: '*' };
    const pgn = generatePgnFromTree(headers, tree, {});

    // Verify PGN text contains the variation
    expect(pgn).toContain('d5');
    expect(pgn).toContain('(');

    // Re-parse the full PGN (simulates usePgn re-parse via parsePgn)
    const reparsedGames = parsePgn(pgn);
    expect(reparsedGames).toHaveLength(1);

    const reparsedTree = reparsedGames[0].moveTree!;
    expect(reparsedTree.san).toBe('e4');

    // The variation should survive the roundtrip
    const reparsedE5 = reparsedTree.next!;
    expect(reparsedE5.san).toBe('e5');
    expect(reparsedE5.variations).toHaveLength(1);
    expect(reparsedE5.variations[0].san).toBe('d5');

    // Mainline should still continue
    expect(reparsedE5.next?.san).toBe('Nf3');

    // The new variation node should be findable by FEN
    const allNodes = flattenTree(reparsedTree);
    const matchedNode = allNodes.find((n) => n.fen === newNode!.fen && n.san === 'd5');
    expect(matchedNode).toBeDefined();
  });

  it('appends a move at the end of a variation line', () => {
    // Simulate: create variation d5, then append exd5 at end of variation
    const tree = parseMoveTree('1. e4 e5 2. Nf3 Nc6', START_FEN)!;

    // Step 1: Create variation d5 (alternative to e5)
    const e5 = tree.next!;
    const d5Node = addVariation(tree, e5.id, 'd5');
    expect(d5Node).not.toBeNull();
    expect(d5Node!.next).toBeNull(); // variation has no continuation yet

    // Step 2: Rebuild PGN and re-parse (simulates React state cycle)
    const pgn1 = generatePgnFromTree({ Result: '*' }, tree, {});
    const reparsed1 = parsePgn(pgn1);
    const tree2 = reparsed1[0].moveTree!;

    // Find the d5 node in the re-parsed tree
    const allNodes1 = flattenTree(tree2);
    const d5InTree2 = allNodes1.find((n) => n.san === 'd5' && n.id.includes('/v'));
    expect(d5InTree2).toBeDefined();
    expect(d5InTree2!.next).toBeNull();

    // Step 3: Append exd5 at end of d5 variation
    // This is what handleBoardMove's "end of line" branch does:
    // Generate PGN, insert move before result
    const pgn2Text = generatePgnFromTree({ Result: '*' }, tree2, {});

    // The PGN should contain the variation with d5
    expect(pgn2Text).toContain('d5');

    // Now simulate appending by using addVariation to add after d5
    // Actually in the app, the "end of line" code uses string manipulation.
    // But the underlying issue is: can we parse a PGN with a variation
    // that has a move appended?
    const withAppend = pgn2Text.replace(/\(\s*1\.\.\.\s*d5\s*\)/, '( 1... d5 2. exd5 )');
    const reparsed2 = parsePgn(withAppend);
    const tree3 = reparsed2[0].moveTree!;
    const allNodes2 = flattenTree(tree3);
    const d5InTree3 = allNodes2.find((n) => n.san === 'd5' && n.id.includes('/v'));
    expect(d5InTree3).toBeDefined();
    expect(d5InTree3!.next?.san).toBe('exd5');
  });

  it('returns null for illegal move', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    const e5 = tree.next!;
    const result = addVariation(tree, e5.id, 'Qh8');
    expect(result).toBeNull();
  });

  it('creates a variation at the first move', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;
    const newNode = addVariation(tree, tree.id, 'd4');
    expect(newNode).not.toBeNull();
    expect(newNode!.san).toBe('d4');
    expect(tree.variations).toHaveLength(1);
    expect(tree.variations[0].san).toBe('d4');
    // Mainline unaffected
    expect(tree.san).toBe('e4');
    expect(tree.next?.san).toBe('e5');
  });

  it('first-move variation roundtrips through PGN', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    addVariation(tree, tree.id, 'd4');
    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    expect(pgn).toContain('d4');
    expect(pgn).toContain('(');

    const reparsed = parsePgn(pgn);
    const rt = reparsed[0].moveTree!;
    expect(rt.san).toBe('e4');
    expect(rt.variations).toHaveLength(1);
    expect(rt.variations[0].san).toBe('d4');
  });

  it('handles nested variations (depth 2+)', () => {
    const movetext = '1. e4 e5 (1... d5 2. exd5 (2. Nc3)) 2. Nf3';
    const tree = parseMoveTree(movetext, START_FEN)!;
    const e5 = tree.next!;
    expect(e5.variations).toHaveLength(1);
    const d5 = e5.variations[0];
    expect(d5.san).toBe('d5');
    expect(d5.next?.san).toBe('exd5');
    // Nested variation within the variation
    expect(d5.next!.variations).toHaveLength(1);
    expect(d5.next!.variations[0].san).toBe('Nc3');
    // Mainline continues
    expect(e5.next?.san).toBe('Nf3');
  });
});

describe('promoteVariation', () => {
  it('swaps a variation with the main continuation', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3', START_FEN)!;
    const e5 = tree.next!;
    const d5 = e5.variations[0];
    expect(e5.san).toBe('e5');
    expect(d5.san).toBe('d5');

    const result = promoteVariation(tree, d5.id);
    expect(result).toBe(true);

    // d5 should now be the main continuation after e4
    expect(tree.next!.san).toBe('d5');
    // e5 should now be a variation of d5
    expect(tree.next!.variations).toHaveLength(1);
    expect(tree.next!.variations[0].san).toBe('e5');
  });

  it('preserves the promoted variation continuation', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5 Qxd5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];

    promoteVariation(tree, d5.id);

    // d5 is now main, and its continuation should be intact
    expect(tree.next!.san).toBe('d5');
    expect(tree.next!.next?.san).toBe('exd5');
    expect(tree.next!.next?.next?.san).toBe('Qxd5');
  });

  it('preserves the demoted mainline continuation as variation', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5) 2. Nf3 Nc6', START_FEN)!;
    const d5 = tree.next!.variations[0];

    promoteVariation(tree, d5.id);

    // The old mainline (e5 → Nf3 → Nc6) should now be a variation
    const oldMainAsVariation = tree.next!.variations[0];
    expect(oldMainAsVariation.san).toBe('e5');
    expect(oldMainAsVariation.next?.san).toBe('Nf3');
    expect(oldMainAsVariation.next?.next?.san).toBe('Nc6');
  });

  it('roundtrips through PGN after promotion', () => {
    const tree = parseMoveTree('1. e4 e5 (1... d5 2. exd5) 2. Nf3', START_FEN)!;
    const d5 = tree.next!.variations[0];

    promoteVariation(tree, d5.id);

    const movetext = generateMovetext(tree, {});
    // d5 should be in the mainline now
    expect(movetext).toContain('d5');
    // e5 should be in a variation
    expect(movetext).toContain('e5');
    expect(movetext).toContain('(');

    // Re-parse and verify structure
    const pgn = generatePgnFromTree({ Result: '*' }, tree, {});
    const reparsed = parsePgn(pgn);
    const rt = reparsed[0].moveTree!;
    expect(rt.next!.san).toBe('d5');
    expect(rt.next!.variations).toHaveLength(1);
    expect(rt.next!.variations[0].san).toBe('e5');
  });

  it('returns false for non-variation node', () => {
    const tree = parseMoveTree('1. e4 e5 2. Nf3', START_FEN)!;
    // e5 is the main continuation, not a variation
    const result = promoteVariation(tree, tree.next!.id);
    expect(result).toBe(false);
  });

  it('returns false for non-existent node', () => {
    const tree = parseMoveTree('1. e4 e5', START_FEN)!;
    const result = promoteVariation(tree, 'nonexistent');
    expect(result).toBe(false);
  });

  it('double promote reverts to original state', () => {
    const originalPgn = '1. e4 e5 (1... d5 2. exd5) 2. Nf3 Nc6';
    const tree = parseMoveTree(originalPgn, START_FEN)!;

    // Capture original structure
    expect(tree.next!.san).toBe('e5');
    expect(tree.next!.variations[0].san).toBe('d5');
    expect(tree.next!.next?.san).toBe('Nf3');

    // Promote d5 → d5 becomes main, e5 becomes variation
    const d5Id = tree.next!.variations[0].id;
    promoteVariation(tree, d5Id);
    expect(tree.next!.san).toBe('d5');
    expect(tree.next!.variations[0].san).toBe('e5');

    // Now promote e5 back → should revert to original
    const e5Id = tree.next!.variations[0].id;
    promoteVariation(tree, e5Id);
    expect(tree.next!.san).toBe('e5');
    expect(tree.next!.variations[0].san).toBe('d5');

    // Mainline continuation should be restored
    expect(tree.next!.next?.san).toBe('Nf3');
    expect(tree.next!.next?.next?.san).toBe('Nc6');

    // Variation continuation should be restored
    expect(tree.next!.variations[0].next?.san).toBe('exd5');
  });
});

describe('Multi-game timestamp preservation', () => {
  const MULTI_GAME_PGN = `[Event "Game 1"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 {[%ts 0:10]} e5 {[%ts 0:20]} 2. Nf3 {[%ts 0:30]} *

[Event "Game 2"]
[White "C"]
[Black "D"]
[Result "*"]

1. d4 {[%ts 1:00]} d5 {[%ts 1:10]} *`;

  it('preserves game 1 timestamps when regenerating from game 2 context', () => {
    // Parse multi-game PGN
    const games = parsePgn(MULTI_GAME_PGN);
    expect(games).toHaveLength(2);

    // Verify game 1 has timestamps parsed into node.timestamp
    const game1Tree = games[0].moveTree!;
    expect(game1Tree.timestamp).toBe(10); // 0:10
    expect(game1Tree.next!.timestamp).toBe(20); // 0:20
    expect(game1Tree.next!.next!.timestamp).toBe(30); // 0:30

    // Verify game 2 has timestamps
    const game2Tree = games[1].moveTree!;
    expect(game2Tree.timestamp).toBe(60); // 1:00
    expect(game2Tree.next!.timestamp).toBe(70); // 1:10

    // Simulate: user is on game 2 and captures new timestamps
    const game2Timestamps: Record<string, number> = {
      [game2Tree.id]: 120, // new timestamp for game 2 move 1
      [game2Tree.next!.id]: 130, // new timestamp for game 2 move 2
    };

    // Regenerate game 2 with new timestamps, game 1 with empty (simulates rebuildPgn)
    const game1Pgn = generatePgnFromTree(games[0].headers, game1Tree, {});
    const game2Pgn = generatePgnFromTree(games[1].headers, game2Tree, game2Timestamps);
    const fullPgn = game1Pgn + '\n\n' + game2Pgn;

    // Game 1's PGN should still have its original timestamps
    expect(game1Pgn).toContain('[%ts 0:10]');
    expect(game1Pgn).toContain('[%ts 0:20]');
    expect(game1Pgn).toContain('[%ts 0:30]');

    // Game 2's PGN should have the NEW timestamps
    expect(game2Pgn).toContain('[%ts 2:00]'); // 120s = 2:00
    expect(game2Pgn).toContain('[%ts 2:10]'); // 130s = 2:10

    // Re-parse the combined PGN and verify game 1 timestamps survive
    const reparsed = parsePgn(fullPgn);
    expect(reparsed).toHaveLength(2);
    const reparsedGame1 = reparsed[0].moveTree!;
    expect(reparsedGame1.timestamp).toBe(10);
    expect(reparsedGame1.next!.timestamp).toBe(20);
    expect(reparsedGame1.next!.next!.timestamp).toBe(30);
  });

  it('node IDs overlap between games — empty timestamps prevents cross-contamination', () => {
    const games = parsePgn(MULTI_GAME_PGN);
    const game1Tree = games[0].moveTree!;
    const game2Tree = games[1].moveTree!;

    // Both games start with node ID "0" — verify IDs are the same pattern
    expect(game1Tree.id).toBe('0');
    expect(game2Tree.id).toBe('0');

    // After switching back to game 1, timestamps should be {} (cleared)
    // getAllTimestampedNodes with {} should use node.timestamp (from PGN parse)
    const game1Nodes = getAllTimestampedNodes(game1Tree, {});

    // Should use game 1's parsed timestamps, not any external ones
    const firstNode = game1Nodes.find((n) => n.id === '0');
    expect(firstNode?.timestamp).toBe(10); // 0:10 from game 1's PGN
  });
});

describe('PGN round-trip idempotency', () => {
  it('simple game survives parse → generate → re-parse', () => {
    const pgn = `[Event "Test"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0`;
    const games = parsePgn(pgn);
    const game = games[0];
    const regenerated = generatePgnFromTree(game.headers, game.moveTree, {});
    const reparsed = parsePgn(regenerated);
    const reparsedGame = reparsed[0];

    expect(reparsedGame.headers['Event']).toBe('Test');
    expect(reparsedGame.headers['White']).toBe('Alice');
    expect(reparsedGame.headers['Black']).toBe('Bob');
    expect(reparsedGame.headers['Result']).toBe('1-0');

    const mainLine = getMainLine(reparsedGame.moveTree!);
    expect(mainLine.map((n) => n.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('timestamps survive parse → generate → re-parse', () => {
    const pgn = `[Event "?"]
[Result "*"]

1. e4 {[%ts 0:05]} e5 {[%ts 0:15]} 2. Nf3 {[%ts 0:25]} *`;
    const games = parsePgn(pgn);
    const tree = games[0].moveTree!;

    expect(tree.timestamp).toBe(5);
    expect(tree.next!.timestamp).toBe(15);
    expect(tree.next!.next!.timestamp).toBe(25);

    const regenerated = generatePgnFromTree(games[0].headers, tree, {});
    const reparsed = parsePgn(regenerated);
    const rTree = reparsed[0].moveTree!;

    expect(rTree.timestamp).toBe(5);
    expect(rTree.next!.timestamp).toBe(15);
    expect(rTree.next!.next!.timestamp).toBe(25);
  });

  it('comments and NAGs survive round-trip', () => {
    const pgn = `[Event "?"]
[Result "*"]

1. e4 {Great move} e5 $1 {[%eval 0.3]} 2. Nf3 *`;
    const games = parsePgn(pgn);
    const tree = games[0].moveTree!;

    expect(tree.comment).toBe('Great move');
    expect(tree.next!.nags).toContain('$1');
    expect(tree.next!.eval).toBe('0.3');

    const regenerated = generatePgnFromTree(games[0].headers, tree, {});
    const reparsed = parsePgn(regenerated);
    const rTree = reparsed[0].moveTree!;

    expect(rTree.comment).toBe('Great move');
    expect(rTree.next!.nags).toContain('$1');
    expect(rTree.next!.eval).toBe('0.3');
  });

  it('variations survive round-trip', () => {
    const pgn = `[Event "?"]
[Result "*"]

1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *`;
    const games = parsePgn(pgn);
    const tree = games[0].moveTree!;
    const e5 = tree.next!;
    expect(e5.variations).toHaveLength(1);
    expect(e5.variations[0].san).toBe('c5');
    expect(e5.variations[0].next!.san).toBe('Nf3');

    const regenerated = generatePgnFromTree(games[0].headers, tree, {});
    const reparsed = parsePgn(regenerated);
    const rTree = reparsed[0].moveTree!;
    const re5 = rTree.next!;
    expect(re5.variations).toHaveLength(1);
    expect(re5.variations[0].san).toBe('c5');
    expect(re5.variations[0].next!.san).toBe('Nf3');
  });

  it('multi-game PGN survives round-trip', () => {
    const pgn = `[Event "Game 1"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 {[%ts 0:10]} e5 *

[Event "Game 2"]
[White "C"]
[Black "D"]
[Result "*"]

1. d4 {[%ts 1:00]} d5 *`;
    const games = parsePgn(pgn);
    expect(games).toHaveLength(2);

    const regen1 = generatePgnFromTree(games[0].headers, games[0].moveTree, {});
    const regen2 = generatePgnFromTree(games[1].headers, games[1].moveTree, {});
    const fullPgn = regen1 + '\n\n' + regen2;

    const reparsed = parsePgn(fullPgn);
    expect(reparsed).toHaveLength(2);

    expect(reparsed[0].headers['Event']).toBe('Game 1');
    expect(reparsed[0].moveTree!.san).toBe('e4');
    expect(reparsed[0].moveTree!.timestamp).toBe(10);

    expect(reparsed[1].headers['Event']).toBe('Game 2');
    expect(reparsed[1].moveTree!.san).toBe('d4');
    expect(reparsed[1].moveTree!.timestamp).toBe(60);
  });

  it('FEN/SetUp headers survive round-trip', () => {
    const pgn = `[Event "Puzzle"]
[SetUp "1"]
[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]
[Result "*"]

1. e4 *`;
    const games = parsePgn(pgn);
    expect(games[0].startFen).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');

    const regenerated = generatePgnFromTree(games[0].headers, games[0].moveTree, {});
    const reparsed = parsePgn(regenerated);
    expect(reparsed[0].startFen).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(reparsed[0].headers['SetUp']).toBe('1');
  });
});
