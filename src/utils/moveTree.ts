import { fenToPosition, applySan, applySanToPos, makeFen } from './chessPosition';
import type { Position } from 'chessops/chess';
import type { Rules } from 'chessops/types';
import type { MoveNode, ParsedMove, DrawShape } from '../types';

/**
 * Token types from PGN movetext tokenization.
 */
type Token =
  | { type: 'move'; value: string }
  | { type: 'moveNumber'; value: string }
  | { type: 'comment'; value: string }
  | { type: 'result'; value: string }
  | { type: 'ravOpen' }
  | { type: 'ravClose' }
  | { type: 'nag'; value: string };

/**
 * Tokenize PGN movetext into meaningful tokens.
 */
function tokenize(movetext: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = movetext.length;

  while (i < len) {
    const ch = movetext[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '{') {
      const end = movetext.indexOf('}', i + 1);
      if (end === -1) break;
      tokens.push({ type: 'comment', value: movetext.substring(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'ravOpen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'ravClose' });
      i++;
      continue;
    }

    if (ch === '$') {
      let j = i + 1;
      while (j < len && /\d/.test(movetext[j])) j++;
      tokens.push({ type: 'nag', value: movetext.substring(i, j) });
      i = j;
      continue;
    }

    let j = i;
    while (j < len && !/[\s{}()]/.test(movetext[j])) j++;
    const word = movetext.substring(i, j);
    i = j;

    if (/^(1-0|0-1|1\/2-1\/2|0\.5-0\.5|\*)$/.test(word)) {
      tokens.push({ type: 'result', value: word });
      continue;
    }

    if (/^\d+\.+$/.test(word)) {
      tokens.push({ type: 'moveNumber', value: word });
      continue;
    }

    if (/^[!?]+$/.test(word)) {
      tokens.push({ type: 'nag', value: word });
      continue;
    }

    // Split trailing NAG symbols from move (e.g., "g6?!" → move "g6" + nag "?!")
    const nagSuffix = word.match(/([!?]+)$/);
    if (nagSuffix && nagSuffix.index && nagSuffix.index > 0) {
      const movePart = word.substring(0, nagSuffix.index);
      tokens.push({ type: 'move', value: movePart });
      tokens.push({ type: 'nag', value: nagSuffix[1] });
      continue;
    }

    tokens.push({ type: 'move', value: word });
  }

  return tokens;
}

/**
 * Parse a timestamp string like "1:23" or "0:05" or "1:02:30" into seconds.
 */
function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
/**
 * Map Lichess color prefix to chessground brush name.
 */
function colorToBrush(c: string): string {
  switch (c) {
    case 'G':
      return 'green';
    case 'R':
      return 'red';
    case 'B':
      return 'blue';
    case 'Y':
      return 'yellow';
    default:
      return 'green';
  }
}

/**
 * Parse [%csl Ge4,Rd6] into DrawShape[] (square highlights).
 */
function parseCsl(value: string): DrawShape[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({
      brush: colorToBrush(s[0]),
      orig: s.substring(1).toLowerCase(),
    }));
}

/**
 * Parse [%cal Ge2e4,Rd1d2] into DrawShape[] (arrows).
 */
function parseCal(value: string): DrawShape[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({
      brush: colorToBrush(s[0]),
      orig: s.substring(1, 3).toLowerCase(),
      dest: s.substring(3, 5).toLowerCase(),
    }));
}

interface CommentData {
  timestamp?: number;
  comment?: string;
  eval?: string;
  arrows?: DrawShape[];
  highlights?: DrawShape[];
}

/**
 * Extract all structured annotations from a comment string.
 * Removes [%evp], [%eval], [%ts], [%csl], [%cal] and returns parsed data + remaining text.
 */
function parseComment(raw: string): CommentData {
  let text = raw;
  const result: CommentData = {};

  // Extract [%ts M:SS]
  const tsMatch = text.match(/\[%ts\s+([\d:]+)\]/);
  if (tsMatch) {
    result.timestamp = parseTimestamp(tsMatch[1]);
    text = text.replace(tsMatch[0], '');
  }

  // Extract [%eval ...] (e.g., [%eval 0.54], [%eval -1.3], [%eval #5], [%eval #-3])
  const evalMatch = text.match(/\[%eval\s+([^\]]+)\]/);
  if (evalMatch) {
    result.eval = evalMatch[1].trim();
    text = text.replace(evalMatch[0], '');
  }
  // Remove any additional [%eval] blocks (Lichess sometimes duplicates them)
  text = text.replace(/\[%eval[^\]]*\]/g, '');

  // Extract [%csl ...]
  const cslMatch = text.match(/\[%csl\s+([^\]]+)\]/);
  if (cslMatch) {
    result.highlights = parseCsl(cslMatch[1]);
    text = text.replace(cslMatch[0], '');
  }

  // Extract [%cal ...]
  const calMatch = text.match(/\[%cal\s+([^\]]+)\]/);
  if (calMatch) {
    result.arrows = parseCal(calMatch[1]);
    text = text.replace(calMatch[0], '');
  }

  // Remove [%evp ...]
  text = text.replace(/\[%evp[^\]]*\]/g, '');

  // Clean up remaining text
  const cleaned = text.trim();
  if (cleaned) result.comment = cleaned;

  return result;
}

interface ParseContext {
  tokens: Token[];
  pos: number;
}

/**
 * Parse a sequence of tokens into a linked list of MoveNodes.
 * Handles nested RAVs recursively.
 *
 * @param ctx - Parse context with tokens and current position
 * @param chess - Chess instance at the position BEFORE parsing this line
 * @param parentId - ID prefix for moves in this line
 * @param isVariation - Whether this is a variation (inside parentheses)
 * @returns The first MoveNode of the parsed line, or null if empty
 */
function parseLine(
  ctx: ParseContext,
  pos: Position,
  parentId: string,
  isVariation: boolean,
  rules: Rules = 'chess',
): MoveNode | null {
  let firstNode: MoveNode | null = null;
  let currentNode: MoveNode | null = null;
  let moveIndexInLine = 0;
  let pendingComment: string | undefined;
  let pendingNags: string[] = [];

  while (ctx.pos < ctx.tokens.length) {
    const token = ctx.tokens[ctx.pos];

    // End of variation
    if (token.type === 'ravClose') {
      if (isVariation) {
        ctx.pos++; // consume ')'
      }
      break;
    }

    // Result token ends the game
    if (token.type === 'result') {
      ctx.pos++;
      break;
    }

    // Move numbers — skip
    if (token.type === 'moveNumber') {
      ctx.pos++;
      continue;
    }

    // Comments — extract annotations, attach to previous move or hold as pending
    if (token.type === 'comment') {
      ctx.pos++;
      const data = parseComment(token.value);

      if (currentNode) {
        // Merge into current node
        if (data.timestamp !== undefined) currentNode.timestamp = data.timestamp;
        if (data.eval !== undefined && !currentNode.eval) currentNode.eval = data.eval;
        if (data.comment)
          currentNode.comment = currentNode.comment ? currentNode.comment + ' ' + data.comment : data.comment;
        if (data.arrows) currentNode.arrows = (currentNode.arrows || []).concat(data.arrows);
        if (data.highlights) currentNode.highlights = (currentNode.highlights || []).concat(data.highlights);
      } else if (data.comment) {
        pendingComment = pendingComment ? pendingComment + ' ' + data.comment : data.comment;
      }
      continue;
    }

    // NAGs
    if (token.type === 'nag') {
      ctx.pos++;
      if (currentNode) {
        if (!currentNode.nags) currentNode.nags = [];
        currentNode.nags.push(token.value);
      } else {
        pendingNags.push(token.value);
      }
      continue;
    }

    // Start of a variation — branches from the position BEFORE currentNode
    if (token.type === 'ravOpen') {
      ctx.pos++; // consume '('

      if (!currentNode) {
        // Variation before any move in this line — skip it
        let depth = 1;
        while (ctx.pos < ctx.tokens.length && depth > 0) {
          if (ctx.tokens[ctx.pos].type === 'ravOpen') depth++;
          if (ctx.tokens[ctx.pos].type === 'ravClose') depth--;
          ctx.pos++;
        }
        continue;
      }

      // Fork from the position BEFORE currentNode was played
      const varPos = fenToPosition(currentNode.fenBefore, rules);
      if (!varPos) continue;
      const varId = `${currentNode.id}/v${currentNode.variations.length}`;
      const varLine = parseLine(ctx, varPos, varId, true, rules);
      if (varLine) {
        currentNode.variations.push(varLine);
      }
      continue;
    }

    // Actual move
    if (token.type === 'move') {
      ctx.pos++;

      const fenBefore = makeFen(pos.toSetup());
      const result = applySanToPos(pos, token.value);

      if (!result) {
        console.warn(`Invalid move in tree parser: ${token.value} at position ${fenBefore}`);
        continue;
      }

      // Extract move number from the FEN BEFORE the move
      const fenParts = fenBefore.split(' ');
      const fullMoveNumber = parseInt(fenParts[5] || '1', 10);
      const moveId = parentId ? `${parentId}/${moveIndexInLine}` : `${moveIndexInLine}`;

      const node: MoveNode = {
        id: moveId,
        moveNumber: fullMoveNumber,
        color: result.color,
        san: result.san,
        fenBefore,
        fen: result.newFen,
        from: result.from,
        to: result.to,
        next: null,
        variations: [],
      };

      // Attach pending comment/nags
      if (pendingComment) {
        node.comment = pendingComment;
        pendingComment = undefined;
      }
      if (pendingNags.length > 0) {
        node.nags = pendingNags;
        pendingNags = [];
      }

      // Link into list
      if (currentNode) {
        currentNode.next = node;
      }
      if (!firstNode) {
        firstNode = node;
      }
      currentNode = node;
      moveIndexInLine++;
    }
  }

  return firstNode;
}

/**
 * Parse PGN movetext into a MoveNode tree.
 */
export function parseMoveTree(movetext: string, startFen: string, rules: Rules = 'chess'): MoveNode | null {
  const tokens = tokenize(movetext);
  const ctx: ParseContext = { tokens, pos: 0 };
  const pos = fenToPosition(startFen, rules);
  if (!pos) return null;
  return parseLine(ctx, pos, '', false, rules);
}

// ─── Tree Navigation Utilities ───────────────────────────────────────────────

/**
 * Find a MoveNode by its ID path.
 */
export function findNodeById(root: MoveNode | null, id: string): MoveNode | null {
  if (!root) return null;

  function walk(node: MoveNode | null): MoveNode | null {
    if (!node) return null;
    if (node.id === id) return node;

    // Check variations
    for (const varHead of node.variations) {
      const found = walk(varHead);
      if (found) return found;
    }

    // Check continuation
    return walk(node.next);
  }

  return walk(root);
}

/**
 * Collect all nodes in the tree into a flat array (depth-first: main line first, then variations).
 */
export function flattenTree(root: MoveNode | null): MoveNode[] {
  const result: MoveNode[] = [];

  function walk(node: MoveNode | null) {
    if (!node) return;
    result.push(node);
    // Variations branch from this node
    for (const varHead of node.variations) {
      walk(varHead);
    }
    // Continue main line
    walk(node.next);
  }

  walk(root);
  return result;
}

/**
 * Collect only main line nodes.
 */
export function getMainLine(root: MoveNode | null): MoveNode[] {
  const result: MoveNode[] = [];
  let node = root;
  while (node) {
    result.push(node);
    node = node.next;
  }
  return result;
}

/**
 * Get the path from root to a target node (list of node IDs).
 */
export function getPathToNode(root: MoveNode | null, targetId: string): string[] {
  if (!root) return [];

  function walk(node: MoveNode | null, path: string[]): string[] | null {
    if (!node) return null;
    const current = [...path, node.id];
    if (node.id === targetId) return current;

    // Check variations
    for (const varHead of node.variations) {
      const found = walk(varHead, current);
      if (found) return found;
    }

    // Check continuation
    return walk(node.next, current);
  }

  return walk(root, []) || [];
}

/**
 * Find the parent node of a given node.
 * Returns null for the root node.
 */
export function findParentNode(root: MoveNode | null, targetId: string): MoveNode | null {
  if (!root) return null;

  function walk(node: MoveNode | null): MoveNode | null {
    if (!node) return null;

    // Check if any variation head is the target
    for (const varHead of node.variations) {
      if (varHead.id === targetId) return node;
      const found = walk(varHead);
      if (found) return found;
    }

    // Check if next is the target
    if (node.next?.id === targetId) return node;
    return walk(node.next);
  }

  return walk(root);
}

/**
 * Get the previous node in the current line (for ← navigation).
 * If at the start of a variation, returns null (caller should exit the variation).
 */
export function getPreviousNode(root: MoveNode | null, currentId: string): MoveNode | null {
  const path = getPathToNode(root, currentId);
  if (path.length < 2) return null;
  return findNodeById(root, path[path.length - 2]);
}

/**
 * Get the next node in the current line (for → navigation).
 */
export function getNextNode(root: MoveNode | null, currentId: string): MoveNode | null {
  const node = findNodeById(root, currentId);
  return node?.next ?? null;
}

/**
 * Collect all timestamped nodes, sorted by timestamp.
 * Used for video → board sync.
 */
export function getAllTimestampedNodes(
  root: MoveNode | null,
  timestamps: Record<string, number>,
): { id: string; timestamp: number }[] {
  const all = flattenTree(root);
  const result: { id: string; timestamp: number }[] = [];

  for (const node of all) {
    const ts = timestamps[node.id] ?? node.timestamp;
    if (ts !== undefined) {
      result.push({ id: node.id, timestamp: ts });
    }
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

/**
 * Find the node whose timestamp is closest to (but not exceeding) the given time.
 * Searches across all lines (main + variations).
 */
export function findNodeByTime(time: number, root: MoveNode | null, timestamps: Record<string, number>): string | null {
  const sorted = getAllTimestampedNodes(root, timestamps);
  let bestId: string | null = null;
  for (const entry of sorted) {
    if (entry.timestamp <= time) {
      bestId = entry.id;
    } else {
      break;
    }
  }
  return bestId;
}

// ─── Tree Mutation Utilities ─────────────────────────────────────────────────

/**
 * Deep-clone a MoveNode tree.
 */
export function cloneTree(node: MoveNode | null): MoveNode | null {
  if (!node) return null;
  return {
    ...node,
    variations: node.variations.map((v) => cloneTree(v)!),
    next: cloneTree(node.next),
  };
}

/**
 * Add a move as a variation at a given node.
 * Returns the new variation's first MoveNode, or null if the move is illegal.
 */
export function addVariation(root: MoveNode, parentId: string, san: string, rules: Rules = 'chess'): MoveNode | null {
  const parent = findNodeById(root, parentId);
  if (!parent) return null;

  // The variation starts from the position BEFORE parent was played
  // Wait — actually, a variation at parentId means: "instead of parent's next move,
  // play this alternative". In Lichess UX, if you're on move N and play a different
  // move, it creates a variation at move N (sibling of move N, branching from N-1's position).
  //
  // So the variation branches from parent.fenBefore (same position as parent).
  const result = applySan(parent.fenBefore, san, rules);
  if (!result) return null;

  const varIndex = parent.variations.length;
  const varId = `${parent.id}/v${varIndex}/0`;

  const newNode: MoveNode = {
    id: varId,
    moveNumber: parent.moveNumber,
    color: result.color,
    san: result.san,
    fenBefore: parent.fenBefore,
    fen: result.newFen,
    from: result.from,
    to: result.to,
    next: null,
    variations: [],
  };

  parent.variations.push(newNode);
  return newNode;
}

/**
 * Delete a variation by removing it from its parent's variations array.
 */
export function deleteVariation(root: MoveNode, variationHeadId: string): boolean {
  const parent = findParentNode(root, variationHeadId);
  if (!parent) return false;

  const idx = parent.variations.findIndex((v) => v.id === variationHeadId);
  if (idx === -1) return false;

  parent.variations.splice(idx, 1);
  return true;
}

/**
 * Promote a variation: swap it with the main continuation.
 * The variation head replaces its sibling (the main move) and the old main move
 * becomes a variation of the promoted move.
 *
 * Example: 1. e4 e5 (1... d5) → 1. e4 d5 (1... e5)
 * Here d5 is the variation head, e5 is the main move (parent).
 * After promotion: d5 becomes the new main, e5 becomes a variation of d5.
 */
export function promoteVariation(root: MoveNode, variationHeadId: string): boolean {
  // The "parent" of the variation head is the node whose variations array contains it.
  // This is the main move that the variation is an alternative to (e.g., e5 for variation d5).
  const mainMove = findParentNode(root, variationHeadId);
  if (!mainMove) return false;

  const idx = mainMove.variations.findIndex((v) => v.id === variationHeadId);
  if (idx === -1) return false;

  const varHead = mainMove.variations[idx];

  // Find the grandparent — the node whose .next points to mainMove
  const grandparent = findParentNode(root, mainMove.id);

  // Remove the variation from mainMove's variations
  mainMove.variations.splice(idx, 1);

  // The old main move (and its remaining continuation) becomes a variation of the promoted move
  varHead.variations.push(mainMove);

  // Replace mainMove with varHead in the tree
  if (grandparent) {
    if (grandparent.next?.id === mainMove.id) {
      grandparent.next = varHead;
    } else {
      // mainMove is itself a variation head
      const gpIdx = grandparent.variations.findIndex((v) => v.id === mainMove.id);
      if (gpIdx !== -1) {
        grandparent.variations[gpIdx] = varHead;
      }
    }
  } else if (root.id === mainMove.id) {
    // mainMove is the root — can't promote past root
    // Restore state and return false
    varHead.variations.pop();
    mainMove.variations.splice(idx, 0, varHead);
    return false;
  }

  // Re-assign IDs throughout the tree to maintain consistency
  reassignIds(root, '');
  return true;
}

/**
 * Truncate: remove a node and everything after it in its line.
 */
export function truncateFromNode(root: MoveNode, nodeId: string): boolean {
  const parent = findParentNode(root, nodeId);
  if (!parent) {
    // nodeId is the root — can't truncate root itself, but can clear its next
    if (root.id === nodeId) {
      root.next = null;
      root.variations = [];
      return true;
    }
    return false;
  }

  // Is it a main continuation?
  if (parent.next?.id === nodeId) {
    parent.next = null;
    return true;
  }

  // Is it a variation head?
  const idx = parent.variations.findIndex((v) => v.id === nodeId);
  if (idx !== -1) {
    parent.variations.splice(idx, 1);
    return true;
  }

  return false;
}

/**
 * Re-assign IDs throughout the tree to maintain consistent paths.
 */
function reassignIds(node: MoveNode | null, prefix: string) {
  let current = node;
  let idx = 0;
  while (current) {
    current.id = prefix ? `${prefix}/${idx}` : `${idx}`;

    for (let vi = 0; vi < current.variations.length; vi++) {
      const varPrefix = `${current.id}/v${vi}`;
      reassignIds(current.variations[vi], varPrefix);
    }

    current = current.next;
    idx++;
  }
}

// ─── PGN Generation from Tree ───────────────────────────────────────────────

/**
 * Format seconds into M:SS or H:MM:SS string.
 */
export function formatTimestamp(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = sec.toString().padStart(2, '0');
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Generate PGN movetext from a MoveNode tree, including variations.
 */
/** Per-node overrides for PGN generation (avoids tree mutation). */
export interface NodeOverrides {
  eval?: string;
  comment?: string;
  arrows?: DrawShape[];
  highlights?: DrawShape[];
}

export function generateMovetext(
  root: MoveNode | null,
  timestamps: Record<string, number> = {},
  overrides: Record<string, NodeOverrides> = {},
): string {
  if (!root) return '';
  const parts: string[] = [];

  function emitNode(node: MoveNode | null, needsMoveNumber: boolean) {
    if (!node) return;
    const ov = overrides[node.id];

    // Move number
    if (node.color === 'w') {
      parts.push(`${node.moveNumber}.`);
    } else if (needsMoveNumber) {
      parts.push(`${node.moveNumber}...`);
    }

    // The move itself
    parts.push(node.san);

    // NAGs
    if (node.nags) {
      for (const nag of node.nags) {
        parts.push(nag);
      }
    }

    // Comment with timestamp, eval, and annotations
    const ts = timestamps[node.id] ?? node.timestamp;
    const ev = ov?.eval ?? node.eval;
    const comment = ov && 'comment' in ov ? ov.comment : node.comment;
    const highlights = ov && 'highlights' in ov ? ov.highlights : node.highlights;
    const arrows = ov && 'arrows' in ov ? ov.arrows : node.arrows;
    const commentParts: string[] = [];
    if (ts !== undefined) commentParts.push(`[%ts ${formatTimestamp(ts)}]`);
    if (ev) commentParts.push(`[%eval ${ev}]`);
    if (comment) commentParts.push(comment);
    if (highlights && highlights.length > 0) {
      const csl = highlights.map((h) => `${h.brush[0].toUpperCase()}${h.orig}`).join(',');
      commentParts.push(`[%csl ${csl}]`);
    }
    if (arrows && arrows.length > 0) {
      const cal = arrows.map((a) => `${a.brush[0].toUpperCase()}${a.orig}${a.dest}`).join(',');
      commentParts.push(`[%cal ${cal}]`);
    }
    if (commentParts.length > 0) {
      parts.push(`{${commentParts.join(' ')}}`);
    }

    // Variations (each wrapped in parentheses)
    for (const varHead of node.variations) {
      parts.push('(');
      emitNode(varHead, true);
      parts.push(')');
    }

    // Continue to next move
    // After a variation block, we need to re-emit the move number
    emitNode(node.next, node.variations.length > 0);
  }

  emitNode(root, true);
  return parts.join(' ');
}

/**
 * Generate full PGN (headers + movetext) from game data with tree.
 */
export function generatePgnFromTree(
  headers: Record<string, string>,
  tree: MoveNode | null,
  timestamps: Record<string, number> = {},
  overrides: Record<string, NodeOverrides> = {},
): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    lines.push(`[${key} "${value}"]`);
  }
  lines.push('');

  const movetext = generateMovetext(tree, timestamps, overrides);
  const result = headers['Result'] || '*';
  lines.push(movetext ? `${movetext} ${result}` : result);

  return lines.join('\n');
}

// ─── Conversion: Tree ↔ Flat ─────────────────────────────────────────────────

/**
 * Convert a MoveNode tree's main line to the legacy flat ParsedMove array.
 * Used for backward compatibility with existing components.
 */
export function treeToFlatMoves(root: MoveNode | null): ParsedMove[] {
  const mainLine = getMainLine(root);
  return mainLine.map((node, index) => ({
    index,
    moveNumber: node.moveNumber,
    color: node.color,
    san: node.san,
    fen: node.fen,
    from: node.from,
    to: node.to,
    timestamp: node.timestamp,
    comment: node.comment,
  }));
}
