import type { GameData } from '../types';
import { findNodeById, findNodeByTime, getAllTimestampedNodes } from './moveTree';
import { extractVideoId } from './pgnParser';

/**
 * Find the best matching game and node for a given video time across games
 * that share the same video as the currently playing one.
 *
 * When currentVideoId is provided, only games whose VideoURL matches
 * (or games without a VideoURL, which inherit the global video) are considered.
 * This prevents unwanted game switching when different games have different videos.
 */
export function findBestGameAndNode(
  allGames: GameData[],
  time: number,
  currentGameIndex: number,
  timestamps: Record<string, number>,
  currentVideoId?: string,
): { gameIndex: number; nodeId: string | null } {
  const currentTree = allGames[currentGameIndex]?.moveTree ?? null;
  const currentNodeId = findNodeByTime(time, currentTree, timestamps);

  if (allGames.length <= 1) {
    return { gameIndex: currentGameIndex, nodeId: currentNodeId };
  }

  let bestGameIndex = currentGameIndex;
  let bestNodeId = currentNodeId;
  let bestTimestamp = -1;

  // Get the best timestamp from the current game's match
  if (currentNodeId && currentTree) {
    const node = findNodeById(currentTree, currentNodeId);
    if (node) {
      bestTimestamp = timestamps[currentNodeId] ?? node.timestamp ?? -1;
    }
  }

  // Search other games' embedded timestamps, but only for games sharing the same video
  for (let i = 0; i < allGames.length; i++) {
    if (i === currentGameIndex) continue;
    const otherTree = allGames[i].moveTree;
    if (!otherTree) continue;

    // Skip games with a different video
    if (currentVideoId) {
      const otherVideoUrl = allGames[i].headers['VideoURL'];
      if (otherVideoUrl) {
        const otherVideoId = extractVideoId(otherVideoUrl);
        if (otherVideoId && otherVideoId !== currentVideoId) continue;
      }
    }

    const otherId = findNodeByTime(time, otherTree, {});
    if (otherId) {
      const otherNode = findNodeById(otherTree, otherId);
      const otherTs = otherNode?.timestamp;
      if (otherTs !== undefined && otherTs <= time && otherTs > bestTimestamp) {
        bestTimestamp = otherTs;
        bestGameIndex = i;
        bestNodeId = otherId;
      }
    }
  }

  return { gameIndex: bestGameIndex, nodeId: bestNodeId };
}

/**
 * Resolve the video URL and ID for a game.
 * If the game has its own VideoURL header, use it.
 * Otherwise, return null (caller should keep current video).
 */
export function resolveVideoForGame(game: GameData | undefined): { videoUrl: string; videoId: string } | null {
  const url = game?.headers['VideoURL'];
  if (!url) return null;
  const id = extractVideoId(url);
  return id ? { videoUrl: url, videoId: id } : null;
}

/**
 * Resolve orientation from a game's headers.
 */
export function resolveOrientation(game: GameData | undefined): 'white' | 'black' {
  return (game?.headers['Orientation'] as 'white' | 'black') || 'white';
}

/**
 * Clamp a game index to the valid range.
 */
export function clampGameIndex(index: number, gamesLength: number): number {
  if (gamesLength === 0) return 0;
  return Math.min(index, gamesLength - 1);
}

/**
 * Get the first timestamp in a game's move tree (for seeking on game switch).
 * Returns the timestamp in seconds, or null if no timestamped nodes exist.
 */
export function getFirstTimestamp(game: GameData | undefined): number | null {
  if (!game?.moveTree) return null;
  const timestamped = getAllTimestampedNodes(game.moveTree, {});
  return timestamped.length > 0 ? timestamped[0].timestamp : null;
}

/**
 * Build updated headers with VideoURL propagated to games that don't have one.
 * Returns new header objects (does NOT mutate originals).
 */
export function propagateVideoUrl(
  allGames: GameData[],
  currentGameIndex: number,
  videoUrl: string,
): Record<string, string>[] {
  return allGames.map((g, i) => {
    if (i === currentGameIndex) {
      return { ...g.headers, VideoURL: videoUrl };
    }
    if (!g.headers['VideoURL']) {
      return { ...g.headers, VideoURL: videoUrl };
    }
    return g.headers;
  });
}
