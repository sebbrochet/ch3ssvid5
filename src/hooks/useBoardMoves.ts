import { useCallback } from 'react';
import { applySan, variantToRules } from '../utils/chessPosition';
import type { GameData, MoveNode, StoredGame } from '../types';
import { parsePgn } from '../utils/pgnParser';
import {
  findNodeById,
  flattenTree,
  addVariation,
  truncateFromNode,
  promoteVariation,
  getPreviousNode,
  generatePgnFromTree,
  cloneTree,
} from '../utils/moveTree';

interface UseBoardMovesOptions {
  tree: MoveNode | null;
  currentNodeId: string | null;
  gameData: GameData;
  timestamps: Record<string, number>;
  selectedGameIndex: number;
  allGames: GameData[];
  currentGameId: string | null;
  rebuildPgn: (game: GameData, gameIndex: number, ts: Record<string, number>) => string;
  setPgnText: (pgn: string) => void;
  setCurrentNodeId: (id: string | null) => void;
  library: { updateGame: (id: string, updates: Partial<Pick<StoredGame, 'pgn'>>) => void };
}

/** Helper: persist PGN to state and library */
function persistPgn(
  updatedPgn: string,
  setPgnText: (pgn: string) => void,
  currentGameId: string | null,
  library: { updateGame: (id: string, updates: Partial<Pick<StoredGame, 'pgn'>>) => void },
) {
  setPgnText(updatedPgn);
  if (currentGameId) {
    library.updateGame(currentGameId, { pgn: updatedPgn });
  }
}

/** Helper: re-parse PGN and find a node by FEN + SAN */
function findNodeAfterReparse(updatedPgn: string, selectedGameIndex: number, fen: string, san: string): string | null {
  const freshGames = parsePgn(updatedPgn);
  const freshTree = freshGames[selectedGameIndex]?.moveTree;
  if (!freshTree) return null;
  const allNodes = flattenTree(freshTree);
  const match = allNodes.find((n) => n.fen === fen && n.san === san);
  return match?.id ?? null;
}

export function useBoardMoves({
  tree,
  currentNodeId,
  gameData,
  timestamps,
  selectedGameIndex,
  allGames,
  currentGameId,
  rebuildPgn,
  setPgnText,
  setCurrentNodeId,
  library,
}: UseBoardMovesOptions) {
  /** Called when user drags/clicks a piece to make a move on the board */
  const handleBoardMove = useCallback(
    (_from: string, _to: string, san: string, _newFen: string) => {
      const rules = variantToRules(gameData.variant);
      if (!tree) {
        // No tree yet — create the first move node
        const result = applySan(gameData.startFen, san, rules);
        if (!result) return;

        const newRoot: MoveNode = {
          id: '0',
          moveNumber: 1,
          color: result.color,
          san: result.san,
          fenBefore: gameData.startFen,
          fen: result.newFen,
          from: result.from,
          to: result.to,
          next: null,
          variations: [],
        };

        const updatedPgn = generatePgnFromTree(gameData.headers, newRoot, timestamps);
        const fullPgn =
          allGames.length <= 1
            ? updatedPgn
            : allGames
                .map((g, i) => (i === selectedGameIndex ? updatedPgn : generatePgnFromTree(g.headers, g.moveTree, {})))
                .join('\n\n');
        persistPgn(fullPgn, setPgnText, currentGameId, library);
        const freshGames = parsePgn(fullPgn);
        const freshTree = freshGames[selectedGameIndex]?.moveTree;
        if (freshTree) setCurrentNodeId(freshTree.id);
        return;
      }

      // At start position — check if move matches the first move in the tree
      if (currentNodeId === null) {
        if (tree.san === san) {
          setCurrentNodeId(tree.id);
          return;
        }
        // Check if the move matches an existing variation of the first move
        for (const v of tree.variations) {
          if (v.san === san) {
            setCurrentNodeId(v.id);
            return;
          }
        }
        // Create a variation of the first move (alternative first move)
        const cloned = cloneTree(tree)!;
        const newNode = addVariation(cloned, cloned.id, san, rules);
        if (!newNode) return;
        const updatedPgn = rebuildPgn({ ...gameData, moveTree: cloned }, selectedGameIndex, timestamps);
        persistPgn(updatedPgn, setPgnText, currentGameId, library);
        const newId = findNodeAfterReparse(updatedPgn, selectedGameIndex, newNode.fen, san);
        if (newId) setCurrentNodeId(newId);
        return;
      }

      const node = findNodeById(tree, currentNodeId);
      if (!node) return;

      // Check if the move matches the existing next move
      if (node.next && node.next.san === san) {
        setCurrentNodeId(node.next.id);
        return;
      }

      // Check if the move matches an existing variation
      if (node.next) {
        for (const v of node.next.variations) {
          if (v.san === san) {
            setCurrentNodeId(v.id);
            return;
          }
        }
      }

      if (node.next) {
        // Mid-game: create a variation as a sibling of the next move
        const cloned = cloneTree(tree)!;
        const clonedNext = findNodeById(cloned, node.next.id);
        if (!clonedNext) return;
        const newNode = addVariation(cloned, clonedNext.id, san, rules);
        if (!newNode) return;
        const updatedPgn = rebuildPgn({ ...gameData, moveTree: cloned }, selectedGameIndex, timestamps);
        persistPgn(updatedPgn, setPgnText, currentGameId, library);
        const newId = findNodeAfterReparse(updatedPgn, selectedGameIndex, newNode.fen, san);
        if (newId) setCurrentNodeId(newId);
      } else {
        // End of line: append the move by adding a next node to the cloned tree
        const result = applySan(node.fen, san, rules);
        if (!result) return;

        const moveNumber = node.color === 'w' ? node.moveNumber : node.moveNumber + 1;

        const cloned = cloneTree(tree)!;
        const clonedNode = findNodeById(cloned, currentNodeId);
        if (!clonedNode) return;

        clonedNode.next = {
          id: `${clonedNode.id}/append`,
          moveNumber,
          color: result.color,
          san: result.san,
          fenBefore: node.fen,
          fen: result.newFen,
          from: result.from,
          to: result.to,
          next: null,
          variations: [],
        };

        const updatedPgn = rebuildPgn({ ...gameData, moveTree: cloned }, selectedGameIndex, timestamps);
        persistPgn(updatedPgn, setPgnText, currentGameId, library);
        const newId = findNodeAfterReparse(updatedPgn, selectedGameIndex, result.newFen, san);
        if (newId) setCurrentNodeId(newId);
      }
    },
    [
      currentNodeId,
      tree,
      gameData,
      timestamps,
      selectedGameIndex,
      setPgnText,
      currentGameId,
      library,
      allGames,
      rebuildPgn,
      setCurrentNodeId,
    ],
  );

  /** Remove a move and all subsequent moves from the current line */
  const handleDeleteFromHere = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      const node = findNodeById(tree, nodeId);
      if (!node) return;

      const prev = getPreviousNode(tree, nodeId);
      setCurrentNodeId(prev?.id ?? null);

      const cloned = cloneTree(tree)!;
      const success = truncateFromNode(cloned, nodeId);
      if (success) {
        const updatedPgn = rebuildPgn({ ...gameData, moveTree: cloned }, selectedGameIndex, timestamps);
        persistPgn(updatedPgn, setPgnText, currentGameId, library);
      }
    },
    [tree, gameData, timestamps, selectedGameIndex, rebuildPgn, setPgnText, currentGameId, library, setCurrentNodeId],
  );

  /** Promote a variation to become the main line */
  const handlePromoteVariation = useCallback(
    (nodeId: string) => {
      if (!tree) return;
      const node = findNodeById(tree, nodeId);
      if (!node) return;

      const cloned = cloneTree(tree)!;
      const success = promoteVariation(cloned, nodeId);
      if (success) {
        const updatedPgn = rebuildPgn({ ...gameData, moveTree: cloned }, selectedGameIndex, timestamps);
        persistPgn(updatedPgn, setPgnText, currentGameId, library);
        const newId = findNodeAfterReparse(updatedPgn, selectedGameIndex, node.fen, node.san);
        if (newId) setCurrentNodeId(newId);
      }
    },
    [tree, gameData, timestamps, selectedGameIndex, rebuildPgn, setPgnText, currentGameId, library, setCurrentNodeId],
  );

  return { handleBoardMove, handleDeleteFromHere, handlePromoteVariation };
}
