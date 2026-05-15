import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { ChessBoardPanel } from './components/ChessBoardPanel';
import { MoveTreePanel } from './components/MoveTreePanel';
import { NavigationControls } from './components/NavigationControls';
import { GameLibrary } from './components/GameLibrary';
import { GameSelector } from './components/GameSelector';
import { SaveGameDialog } from './components/SaveGameDialog';
import type { GameMetadata, Variant } from './components/SaveGameDialog';
import { EditGameInfoDialog } from './components/EditGameInfoDialog';
import type { GameHeaders } from './components/EditGameInfoDialog';
import { PeerShareDialog, PeerReceiveDialog } from './components/PeerShareDialog';
import { CommentPanel } from './components/CommentPanel';
import { VideoPanelWithSync } from './components/VideoPanelWithSync';
import { SettingsPanel } from './components/SettingsPanel';
import { usePgn } from './hooks/usePgn';
import { useGameLibrary } from './hooks/useGameLibrary';
import { useStockfish } from './hooks/useStockfish';
import { useBoardMoves } from './hooks/useBoardMoves';
import { useSplitter } from './hooks/useSplitter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePlaylist } from './hooks/usePlaylist';
import { useOpening } from './hooks/useOpening';
import { useIsMobile } from './hooks/useIsMobile';
import { extractVideoId } from './utils/pgnParser';
import { playMoveSound } from './utils/moveSound';
import { fenToPosition, variantToRules, isEngineSupported } from './utils/chessPosition';
import type { Position } from 'chessops/chess';
import { findNodeById, getPreviousNode, getNextNode, getMainLine, generatePgnFromTree } from './utils/moveTree';
import type { NodeOverrides } from './utils/moveTree';
import {
  findBestGameAndNode,
  resolveVideoForGame,
  resolveOrientation,
  getFirstTimestamp,
  propagateVideoUrl,
} from './utils/gameSync';
import { resolveEvalDisplay } from './utils/evalDisplay';
import { parseImportParams, fetchPgn, deriveGameName, isAllowedDomain } from './utils/urlImport';
import { findDeepestOpening, isOpeningsLoaded } from './utils/openingLookup';
import { showToast } from './components/Toast';
import { ImportUrlDialog } from './components/ImportUrlDialog';
import { ImportPlaylistDialog } from './components/ImportPlaylistDialog';
import { sanitizeName } from './utils/playlistImport';
import { NowPlayingBar } from './components/NowPlayingBar';
import { PlaylistView } from './components/PlaylistView';
import { PlaylistGamePicker } from './components/PlaylistGamePicker';
import type { GameData, StoredGame, MoveNode, DrawShape } from './types';
import './App.css';

const EMPTY_PGN = `[Event "?"]
[Site "?"]
[Date "????.??.??"]
[White "?"]
[Black "?"]
[Result "*"]

*`;

export default function App() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const library = useGameLibrary();
  const playlist = usePlaylist();
  const [selectedPlaylistViewId, setSelectedPlaylistViewId] = useState<string | null>(null);
  const selectedPlaylistView = selectedPlaylistViewId
    ? (playlist.playlists.find((p) => p.id === selectedPlaylistViewId) ?? null)
    : null;
  const [showGamePicker, setShowGamePicker] = useState(false);
  const { allGames, pgnText, setPgnText } = usePgn(EMPTY_PGN);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  // Clamp index when games array shrinks (e.g., after deleting a game)
  const safeGameIndex = Math.min(selectedGameIndex, Math.max(0, allGames.length - 1));
  const gameData = allGames[safeGameIndex] ?? allGames[0];

  /** Rebuild the full PGN from game trees, replacing one game at a specific index */
  const rebuildPgn = useCallback(
    (game: GameData, _gameIndex: number, gameTimestamps: Record<string, number>): string => {
      if (allGames.length <= 1) {
        return generatePgnFromTree(game.headers, game.moveTree, gameTimestamps);
      }
      // Multi-game: regenerate each game from its tree
      return allGames
        .map((g, i) => {
          const gData = i === _gameIndex ? game : g;
          const gTs = i === _gameIndex ? gameTimestamps : {};
          return generatePgnFromTree(gData.headers, gData.moveTree, gTs);
        })
        .join('\n\n');
    },
    [allGames],
  );

  /** Rebuild PGN with per-node overrides (eval, comment, shapes) — no tree mutation */
  const rebuildPgnWithOverrides = useCallback(
    (
      game: GameData,
      _gameIndex: number,
      gameTimestamps: Record<string, number>,
      nodeOverrides: Record<string, NodeOverrides>,
    ): string => {
      if (allGames.length <= 1) {
        return generatePgnFromTree(game.headers, game.moveTree, gameTimestamps, nodeOverrides);
      }
      return allGames
        .map((g, i) => {
          const gData = i === _gameIndex ? game : g;
          const gTs = i === _gameIndex ? gameTimestamps : {};
          const gOv = i === _gameIndex ? nodeOverrides : {};
          return generatePgnFromTree(gData.headers, gData.moveTree, gTs, gOv);
        })
        .join('\n\n');
    },
    [allGames],
  );

  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  // Video state: videoIdOverride is set by user actions (URL submit, game load)
  // Falls back to gameData.videoId when not explicitly set
  const [videoIdOverride, setVideoIdOverride] = useState<string | null>(gameData.videoId || null);
  const videoId = videoIdOverride ?? gameData.videoId ?? '';
  const [videoUrl, setVideoUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryFolder, setLibraryFolder] = useState('/');
  const {
    splitPercent: videoSplitPercent,
    containerRef: rightPanelRef,
    handleMouseDown: handleSplitterMouseDown,
  } = useSplitter();

  // Clear chessground's cached bounds after sidebar toggle changes layout
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    });
  }, [showLibrary]);

  const [isSynced, setIsSynced] = useState(true);
  const [timestamps, setTimestamps] = useState<Record<string, number>>({});
  const [dialogMode, setDialogMode] = useState<'new-file' | 'add-game' | null>(null);
  const [showEditGameInfo, setShowEditGameInfo] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [lastCapture, setLastCapture] = useState<{ nodeId: string; previousTs: number | undefined } | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>(
    (gameData.headers['Orientation'] as 'white' | 'black') || 'white',
  );
  const [engineEnabled, setEngineEnabled] = useState(false);
  const [engineOverwrite, setEngineOverwrite] = useState(false);
  const [engineDepth] = useState(18);
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    return localStorage.getItem('ch3ssvid5-board-theme') || 'brown';
  });
  const [pieceTheme, setPieceTheme] = useState<string>(() => {
    return localStorage.getItem('ch3ssvid5-piece-theme') || 'cburnett';
  });
  const [showSquareLabels, setShowSquareLabels] = useState<boolean>(() => {
    return localStorage.getItem('ch3ssvid5-square-labels') === 'true';
  });
  const [moveAnimationsEnabled, setMoveAnimationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ch3ssvid5-move-animations') !== 'false'; // on by default
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ch3ssvid5-sound') !== 'false'; // on by default
  });
  const [moveAnimation, setMoveAnimation] = useState<{
    san: string;
    square: string;
    trigger: number;
    reverse?: boolean;
  } | null>(null);
  const moveAnimTriggerRef = useRef(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);

  // --- URL-based PGN import ---
  const [urlImport, setUrlImport] = useState<{ pgnUrl: string; folder: string; gameName: string } | null>(() => {
    const params = parseImportParams(window.location.search);
    if (!params) return null;
    return { pgnUrl: params.pgnUrl, folder: params.folder, gameName: deriveGameName(params.pgnUrl) };
  });
  const [urlImportLoading, setUrlImportLoading] = useState(false);
  const [urlImportError, setUrlImportError] = useState<string | undefined>();
  const [showPlaylistImport, setShowPlaylistImport] = useState(false);

  // Stockfish engine
  const { info: engineInfo, isReady: engineReady, analyze: engineAnalyze } = useStockfish(engineEnabled);

  // Effective PGN with all timestamps merged (for display, copy, export)
  const displayPgn = useMemo(() => {
    return rebuildPgn(gameData, selectedGameIndex, timestamps);
  }, [gameData, selectedGameIndex, timestamps, rebuildPgn]);

  const seekToRef = useRef<((seconds: number) => void) | null>(null);
  const getCurrentTimeRef = useRef<(() => number) | null>(null);
  const playRef = useRef<(() => void) | null>(null);
  const pauseRef = useRef<(() => void) | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Reset game selection when PGN source changes externally
  // (timestamps are reset explicitly in loadGame/handleDialogSave/handleAddGameConfirm)
  const prevPgnSourceRef = useRef(pgnText);
  useEffect(() => {
    // Only reset game index when the PGN was replaced entirely (external load),
    // not on incremental edits (board moves, delete, header changes)
    // External loads always go through loadGame/handleDialogSave which reset index themselves
    prevPgnSourceRef.current = pgnText;
  }, [pgnText]);

  // Reset state when user explicitly selects a different game within multi-game PGN
  const prevGameIndexRef = useRef(selectedGameIndex);
  useEffect(() => {
    if (prevGameIndexRef.current !== selectedGameIndex) {
      setTimestamps({});
      setCurrentNodeId(null);
      const newGame = allGames[selectedGameIndex];
      setOrientation(resolveOrientation(newGame));
      prevGameIndexRef.current = selectedGameIndex;
    }
  }, [selectedGameIndex, allGames]);

  // Handle manual game selection — switch game and seek video to first timestamp
  const handleGameSelect = useCallback(
    (index: number) => {
      setSelectedGameIndex(index);
      const game = allGames[index];
      // Sync video to this game's VideoURL (keep current video if game has none)
      const video = resolveVideoForGame(game);
      if (video) {
        setVideoUrl(video.videoUrl);
        setVideoIdOverride(video.videoId);
      }
      if (isSynced) {
        const firstTs = getFirstTimestamp(game);
        if (firstTs !== null) {
          seekToRef.current?.(firstTs);
        }
      }
    },
    [allGames, isSynced],
  );

  // --- Tree-based navigation ---
  const tree = gameData.moveTree;

  const currentNode: MoveNode | null = useMemo(() => {
    if (!currentNodeId || !tree) return null;
    return findNodeById(tree, currentNodeId);
  }, [tree, currentNodeId]);

  const currentFen = currentNode ? currentNode.fen : gameData.startFen;
  const gameRules = variantToRules(gameData.variant);
  const isChess960 = gameData.variant?.toLowerCase() === 'chess960';
  const currentPos: Position | null = useMemo(() => fenToPosition(currentFen, gameRules), [currentFen, gameRules]);

  const currentOpening = useOpening(currentFen, gameData.variant);

  // Play move sound when navigating
  const prevNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (soundEnabled && currentNode && currentNodeId !== prevNodeIdRef.current) {
      playMoveSound(currentNode.san);
    }
    prevNodeIdRef.current = currentNodeId;
  }, [currentNodeId, currentNode, soundEnabled]);

  // Auto-analyze position with Stockfish when engine is enabled
  useEffect(() => {
    if (engineEnabled && engineReady && isEngineSupported(gameData.variant)) {
      engineAnalyze(currentFen, engineDepth, isChess960);
    }
  }, [currentFen, engineEnabled, engineReady, engineAnalyze, engineDepth, isChess960, gameData.variant]);

  // Auto-save engine eval to the current node when analysis completes
  useEffect(() => {
    if (!engineEnabled || engineInfo.isThinking) return;
    if (!currentNodeId || !gameData.moveTree) return;
    if (currentNode?.eval && !engineOverwrite) return;
    if (engineInfo.depth < engineDepth) return;
    // Only save if the engine result matches the current position
    if (engineInfo.analyzedFen !== currentFen) return;

    // Generate PGN with eval override — no tree mutation
    const overrides: Record<string, NodeOverrides> = { [currentNodeId]: { eval: engineInfo.eval } };
    const updatedPgn =
      allGames.length <= 1
        ? generatePgnFromTree(gameData.headers, gameData.moveTree, timestamps, overrides)
        : allGames
            .map((g, i) => {
              const ts = i === selectedGameIndex ? timestamps : {};
              const eo = i === selectedGameIndex ? overrides : {};
              return generatePgnFromTree(g.headers, g.moveTree, ts, eo);
            })
            .join('\n\n');

    setPgnText(updatedPgn);
    if (currentGameId) {
      library.updateGame(currentGameId, { pgn: updatedPgn });
    }
  }, [
    engineEnabled,
    engineOverwrite,
    engineDepth,
    engineInfo.isThinking,
    engineInfo.eval,
    engineInfo.depth,
    engineInfo.analyzedFen,
    currentFen,
    currentNode,
    currentNodeId,
    gameData,
    allGames,
    selectedGameIndex,
    timestamps,
    setPgnText,
    currentGameId,
    library,
  ]);

  const currentLastMove: [string, string] | undefined = currentNode ? [currentNode.from, currentNode.to] : undefined;

  // Find the last node in the current line (for "go to last")
  const mainLine = useMemo(() => (tree ? getMainLine(tree) : []), [tree]);
  const lastMainNode = mainLine.length > 0 ? mainLine[mainLine.length - 1] : null;

  // Auto-populate ECO/Opening headers when opening database is loaded and headers are missing
  useEffect(() => {
    if (!isOpeningsLoaded() || allGames.length === 0) return;

    let anyUpdated = false;
    const updatedGames = allGames.map((g) => {
      if (g.variant) return g;
      const h = g.headers;
      if ((h['ECO'] && h['ECO'] !== '?') || (h['Opening'] && h['Opening'] !== '?')) return g;
      if (!g.moveTree) return g;
      const line = getMainLine(g.moveTree);
      const opening = findDeepestOpening(line.map((n) => n.fen));
      if (!opening) return g;
      anyUpdated = true;
      return { ...g, headers: { ...h, ECO: opening.eco, Opening: opening.name } };
    });

    if (!anyUpdated) return;

    const updatedPgn = updatedGames
      .map((g, i) => {
        const ts = i === selectedGameIndex ? timestamps : {};
        return generatePgnFromTree(g.headers, g.moveTree, ts);
      })
      .join('\n\n');
    setPgnText(updatedPgn);
    if (currentGameId) {
      library.updateGame(currentGameId, { pgn: updatedPgn });
    }
  }, [allGames, selectedGameIndex, timestamps, setPgnText, currentGameId, library]);

  const syncSourceRef = useRef<'board' | 'video' | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);

  const setSyncSource = useCallback((source: 'board' | 'video') => {
    syncSourceRef.current = source;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      syncSourceRef.current = null;
    }, 500);
  }, []);

  const goToNode = useCallback(
    (nodeId: string | null) => {
      setCurrentNodeId(nodeId);

      if (!isSynced) return;
      setSyncSource('board');

      if (nodeId) {
        const node = tree ? findNodeById(tree, nodeId) : null;
        if (node) {
          const ts = (timestamps[node.id] as number | undefined) ?? node.timestamp;
          if (ts !== undefined) seekToRef.current?.(ts);
        }
      } else if (tree) {
        // Going to start: seek to just before the first move
        const firstTs = (timestamps[tree.id] as number | undefined) ?? tree.timestamp;
        if (firstTs !== undefined) {
          seekToRef.current?.(Math.max(0, firstTs - 2));
        } else {
          seekToRef.current?.(0);
        }
      }
    },
    [tree, timestamps, isSynced, setSyncSource],
  );

  const triggerMoveAnimation = useCallback(
    (nodeId: string | null, reverse?: boolean) => {
      if (!moveAnimationsEnabled || !nodeId || !tree) return;
      const node = findNodeById(tree, nodeId);
      if (!node) return;
      moveAnimTriggerRef.current += 1;
      setMoveAnimation({
        san: node.san,
        square: reverse ? node.from : node.to,
        trigger: moveAnimTriggerRef.current,
        reverse,
      });
    },
    [moveAnimationsEnabled, tree],
  );

  const goToStart = useCallback(() => goToNode(null), [goToNode]);
  const goToPrev = useCallback(() => {
    if (!currentNodeId || !tree) {
      goToNode(null);
      return;
    }
    // Animate the current move being undone (reverse)
    triggerMoveAnimation(currentNodeId, true);
    const prev = getPreviousNode(tree, currentNodeId);
    goToNode(prev?.id ?? null);
  }, [tree, currentNodeId, goToNode, triggerMoveAnimation]);
  const goToNext = useCallback(() => {
    if (!tree) return;
    if (!currentNodeId) {
      triggerMoveAnimation(tree.id);
      goToNode(tree.id);
    } else {
      const next = getNextNode(tree, currentNodeId);
      if (next) {
        triggerMoveAnimation(next.id);
        goToNode(next.id);
      }
    }
  }, [tree, currentNodeId, goToNode, triggerMoveAnimation]);
  const goToLast = useCallback(() => {
    if (lastMainNode) goToNode(lastMainNode.id);
  }, [lastMainNode, goToNode]);

  /** Video time polling callback — searches across all games for cross-game sync */
  const onVideoTimeUpdate = useCallback(
    (time: number) => {
      if (!isSynced) return;
      if (syncSourceRef.current === 'board') return;

      const { gameIndex, nodeId } = findBestGameAndNode(
        allGames,
        time,
        selectedGameIndex,
        timestamps,
        videoId || undefined,
      );

      if (gameIndex !== selectedGameIndex) {
        setSelectedGameIndex(gameIndex);
        // Sync video to new game's VideoURL if it has one
        const video = resolveVideoForGame(allGames[gameIndex]);
        if (video) {
          setVideoUrl(video.videoUrl);
          setVideoIdOverride(video.videoId);
        }
        setSyncSource('video');
        setCurrentNodeId(nodeId);
        return;
      }

      if (nodeId !== currentNodeId) {
        setSyncSource('video');
        triggerMoveAnimation(nodeId);
        setCurrentNodeId(nodeId);
      }
    },
    [timestamps, isSynced, currentNodeId, setSyncSource, allGames, selectedGameIndex, triggerMoveAnimation, videoId],
  );

  const { handleCaptureRef, handleFlipRef, playlistNextRef, playlistPrevRef } = useKeyboardShortcuts({
    goToStart,
    goToPrev,
    goToNext,
    goToLast,
    toggleEngine: () => setEngineEnabled((prev) => !prev),
    togglePlayPause: () => {
      if (isVideoPlaying) {
        pauseRef.current?.();
      } else {
        playRef.current?.();
      }
    },
  });

  // --- Board orientation ---
  const handleFlipBoard = useCallback(() => {
    const newOrientation = orientation === 'white' ? 'black' : 'white';
    setOrientation(newOrientation);
    // Persist in PGN headers
    const updatedGame: GameData = {
      ...gameData,
      headers: { ...gameData.headers, Orientation: newOrientation },
    };
    const updatedPgn = rebuildPgn(updatedGame, selectedGameIndex, timestamps);
    setPgnText(updatedPgn);
    if (currentGameId) {
      library.updateGame(currentGameId, { pgn: updatedPgn });
    }
  }, [orientation, gameData, timestamps, selectedGameIndex, rebuildPgn, setPgnText, currentGameId, library]);
  useEffect(() => {
    handleFlipRef.current = handleFlipBoard;
  }, [handleFlipBoard, handleFlipRef]);

  // --- Game lifecycle ---

  const loadGame = useCallback(
    (game: StoredGame) => {
      setCurrentGameId(game.id);
      let pgn = game.pgn;
      // Backfill VideoURL header into all games that don't have it
      if (game.videoId) {
        const url = `https://www.youtube.com/watch?v=${game.videoId}`;
        let modified = false;
        // Split into game blocks, add VideoURL after Result if missing
        pgn = pgn.replace(/(\[Result\s+"[^"]*"\])(?!\s*\n\[VideoURL)/g, (match) => {
          modified = true;
          return `${match}\n[VideoURL "${url}"]`;
        });
        if (modified) {
          library.updateGame(game.id, { pgn });
        }
      }
      setPgnText(pgn);
      setTimestamps({});
      setSelectedGameIndex(0);
      setCurrentNodeId(null);
      // Read orientation from PGN headers
      const orientMatch = pgn.match(/\[Orientation\s+"(white|black)"\]/);
      setOrientation(orientMatch ? (orientMatch[1] as 'white' | 'black') : 'white');
      if (game.videoId) setVideoIdOverride(game.videoId);
      else setVideoIdOverride('');
    },
    [setPgnText, library],
  );

  // ── Playlist handlers ──────────────────────────────────────────────
  const handlePlaylistGameNav = useCallback(
    (gameId: string | null) => {
      if (!gameId) return;
      const game = library.getGame(gameId);
      if (game) loadGame(game);
    },
    [library, loadGame],
  );

  const handlePlaylistNext = useCallback(() => {
    handlePlaylistGameNav(playlist.nextGame());
  }, [playlist, handlePlaylistGameNav]);

  const handlePlaylistPrev = useCallback(() => {
    handlePlaylistGameNav(playlist.prevGame());
  }, [playlist, handlePlaylistGameNav]);

  const handlePlaylistSelectGame = useCallback(
    (gameId: string, index: number) => {
      const game = library.getGame(gameId);
      if (game) {
        loadGame(game);
        playlist.startPlaylist(selectedPlaylistView!.id, index);
      }
    },
    [library, loadGame, playlist, selectedPlaylistView],
  );

  const handlePlaylistPlayAll = useCallback(
    (startIndex = 0) => {
      if (!selectedPlaylistView) return;
      const cleaned = playlist.cleanupPlaylist(selectedPlaylistView.id, library.games);
      if (!cleaned || cleaned.gameIds.length === 0) return;
      playlist.startPlaylist(selectedPlaylistView.id, startIndex);
      const firstGameId = cleaned.gameIds[startIndex];
      const game = library.getGame(firstGameId);
      if (game) loadGame(game);
    },
    [selectedPlaylistView, playlist, library, loadGame],
  );

  const handlePlaylistExport = useCallback(() => {
    if (!selectedPlaylistView) return;
    const json = playlist.exportPlaylist(selectedPlaylistView.id, library.games);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPlaylistView.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPlaylistView, playlist, library.games]);

  const handlePlaylistImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = playlist.importPlaylist(reader.result as string, library.games);
        if (result) {
          showToast(t('playlist.imported', { name: result.name }));
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [playlist, library.games, t],
  );

  const activePlaylist = playlist.playlists.find((p) => p.id === playlist.activePlaylistId) ?? null;

  useEffect(() => {
    playlistNextRef.current = activePlaylist ? handlePlaylistNext : undefined;
    playlistPrevRef.current = activePlaylist ? handlePlaylistPrev : undefined;
  }, [activePlaylist, handlePlaylistNext, handlePlaylistPrev, playlistNextRef, playlistPrevRef]);

  // ── Playlist auto-advance ─────────────────────────────────────────
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const handlePlaylistNextRef = useRef(handlePlaylistNext);
  handlePlaylistNextRef.current = handlePlaylistNext;

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setAutoAdvanceCountdown(null);
  }, []);

  const canAutoAdvance =
    activePlaylist !== null &&
    playlist.activeIndex < activePlaylist.gameIds.length - 1 &&
    lastMainNode !== null &&
    currentNodeId === lastMainNode.id;

  useEffect(() => {
    if (!canAutoAdvance) {
      cancelAutoAdvance();
      return;
    }
    // Already counting down
    if (autoAdvanceTimerRef.current) return;

    let remaining = 3;
    setAutoAdvanceCountdown(remaining);
    autoAdvanceTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        cancelAutoAdvance();
        handlePlaylistNextRef.current();
      } else {
        setAutoAdvanceCountdown(remaining);
      }
    }, 1000);

    return () => cancelAutoAdvance();
  }, [canAutoAdvance, cancelAutoAdvance]);

  const handleNewGame = useCallback(() => {
    setDialogMode('new-file');
  }, []);

  const handleDialogSave = useCallback(
    (name: string, folder: string, dialogVideoUrl?: string, fen?: string, variant?: Variant) => {
      const vid = dialogVideoUrl ? extractVideoId(dialogVideoUrl) : videoId || undefined;
      const pgnWithTs = generatePgnFromTree(gameData.headers, gameData.moveTree, timestamps);

      if (dialogMode === 'new-file') {
        // Create new PGN file with VideoURL header if provided
        const videoHeader = dialogVideoUrl ? `\n[VideoURL "${dialogVideoUrl}"]` : '';
        const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const fenHeaders = fen && fen !== START_FEN ? `\n[SetUp "1"]\n[FEN "${fen}"]` : '';
        const variantPgnMap: Record<string, string> = {
          chess960: 'Chess960',
          kingofthehill: 'KingOfTheHill',
          threecheck: 'Three-check',
          antichess: 'Antichess',
        };
        const variantHeader = variant && variantPgnMap[variant] ? `\n[Variant "${variantPgnMap[variant]}"]` : '';
        const newPgn = `[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[White "?"]\n[Black "?"]\n[Result "*"]${variantHeader}${videoHeader}${fenHeaders}\n\n*`;
        const game = library.createGame(name, newPgn, { videoId: vid, folder });
        setPgnText(newPgn);
        setCurrentGameId(game.id);
        setTimestamps({});
        setSelectedGameIndex(0);
        setCurrentNodeId(null);
        if (vid) setVideoIdOverride(vid);
        else setVideoIdOverride('');
      } else {
        // Save current game
        const game = library.createGame(name, pgnWithTs, { videoId: vid, folder, timestamps });
        setCurrentGameId(game.id);
      }
      setDialogMode(null);
    },
    [dialogMode, gameData, timestamps, videoId, library, setPgnText],
  );

  const handleAddGame = useCallback(() => {
    setDialogMode('add-game');
  }, []);

  const handleAddGameConfirm = useCallback(
    (meta: GameMetadata) => {
      // Build a new game PGN block and append to current PGN
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
      // When sameVideo (meta.videoUrl undefined), copy VideoURL and VideoTitle from current game
      let videoHeader = '';
      if (meta.videoUrl) {
        videoHeader = `\n[VideoURL "${meta.videoUrl}"]`;
      } else if (gameData.headers['VideoURL']) {
        videoHeader = `\n[VideoURL "${gameData.headers['VideoURL']}"]`;
        if (gameData.headers['VideoTitle']) {
          videoHeader += `\n[VideoTitle "${gameData.headers['VideoTitle']}"]`;
        }
      }
      const START_FEN_ADD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const fenHeaders = meta.fen && meta.fen !== START_FEN_ADD ? `\n[SetUp "1"]\n[FEN "${meta.fen}"]` : '';
      const variantPgnMap: Record<string, string> = {
        chess960: 'Chess960',
        kingofthehill: 'KingOfTheHill',
        threecheck: 'Three-check',
        antichess: 'Antichess',
      };
      const variantHeader =
        meta.variant && variantPgnMap[meta.variant] ? `\n[Variant "${variantPgnMap[meta.variant]}"]` : '';
      const newGamePgn = `\n\n[Event "${meta.event}"]
[Site "?"]
[Date "${today}"]
[White "${meta.white}"]
[Black "${meta.black}"]
[Result "*"]${variantHeader}${videoHeader}${fenHeaders}

*`;
      const updatedPgn = pgnText + newGamePgn;
      setPgnText(updatedPgn);
      // Select the newly added game (it's the last one)
      // We need to wait for allGames to update, so set index to a high number
      // that will be clamped by the effect
      setSelectedGameIndex(allGames.length); // will point to the new game after re-parse
      setTimestamps({});
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn });
      }
      setDialogMode(null);
    },
    [pgnText, setPgnText, allGames.length, currentGameId, library, gameData.headers],
  );

  const handleDeleteCurrentGame = useCallback(() => {
    if (allGames.length <= 1) return;
    const label = `Game ${selectedGameIndex + 1}/${allGames.length}`;
    if (!confirm(t('toast.deleteGameConfirm', { label }))) return;

    // Remove the selected game and rebuild the PGN from remaining games
    const remaining = allGames.filter((_, i) => i !== selectedGameIndex);
    const updatedPgn = remaining.map((g) => generatePgnFromTree(g.headers, g.moveTree, {})).join('\n\n');
    setPgnText(updatedPgn);
    const newIndex = Math.min(selectedGameIndex, remaining.length - 1);
    setSelectedGameIndex(newIndex);
    setTimestamps({});
    setCurrentNodeId(null);
    if (currentGameId) {
      library.updateGame(currentGameId, { pgn: updatedPgn });
    }
  }, [allGames, selectedGameIndex, setPgnText, currentGameId, library, t]);

  const handleVideoUrlSubmit = useCallback(() => {
    const id = extractVideoId(videoUrl);
    if (id) {
      setVideoIdOverride(id);
      // Update VideoURL header on current game, propagate to others
      if (gameData.moveTree) {
        const updatedHeaders = propagateVideoUrl(allGames, selectedGameIndex, videoUrl);
        // Apply updated headers to each game before rebuilding PGN
        const updatedGame: GameData = { ...gameData, headers: updatedHeaders[selectedGameIndex] };
        for (let i = 0; i < allGames.length; i++) {
          allGames[i] = { ...allGames[i], headers: updatedHeaders[i] };
        }
        const updatedPgn = rebuildPgn(updatedGame, selectedGameIndex, timestamps);
        setPgnText(updatedPgn);
        if (currentGameId) {
          library.updateGame(currentGameId, { videoId: id, pgn: updatedPgn });
        }
      } else if (currentGameId) {
        library.updateGame(currentGameId, { videoId: id });
      }
    }
  }, [videoUrl, gameData, allGames, selectedGameIndex, timestamps, rebuildPgn, setPgnText, currentGameId, library]);

  const handleToggleSync = useCallback(() => {
    setIsSynced((prev) => !prev);
  }, []);

  const handleCaptureTimestamp = useCallback(() => {
    if (!currentNodeId || !currentNode) return;
    const time = getCurrentTimeRef.current?.();
    if (time === undefined) return;

    // Save undo info
    const previousTs = timestamps[currentNodeId] ?? currentNode.timestamp;
    setLastCapture({ nodeId: currentNodeId, previousTs });

    const merged: Record<string, number> = { ...timestamps };
    merged[currentNodeId] = time;

    setTimestamps(merged);

    // Regenerate and save PGN with timestamps
    if (gameData.moveTree) {
      const updatedPgn = rebuildPgn(gameData, selectedGameIndex, merged);
      setPgnText(updatedPgn);
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn });
      }
    }
  }, [
    currentNodeId,
    currentNode,
    timestamps,
    gameData,
    selectedGameIndex,
    rebuildPgn,
    setPgnText,
    currentGameId,
    library,
  ]);
  useEffect(() => {
    handleCaptureRef.current = handleCaptureTimestamp;
  }, [handleCaptureTimestamp, handleCaptureRef]);

  const handleUndoTimestamp = useCallback(() => {
    if (!lastCapture) return;
    const merged: Record<string, number> = { ...timestamps };
    if (lastCapture.previousTs !== undefined) {
      merged[lastCapture.nodeId] = lastCapture.previousTs;
    } else {
      delete merged[lastCapture.nodeId];
    }

    setTimestamps(merged);
    setLastCapture(null);

    if (gameData.moveTree) {
      const updatedPgn = rebuildPgn(gameData, selectedGameIndex, merged);
      setPgnText(updatedPgn);
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn, timestamps: merged });
      }
    }
  }, [lastCapture, timestamps, gameData, selectedGameIndex, rebuildPgn, setPgnText, currentGameId, library]);

  const { handleBoardMove, handleDeleteFromHere, handlePromoteVariation } = useBoardMoves({
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
  });

  /** Update PGN headers for the current game */
  const handleEditGameInfo = useCallback(
    (headers: GameHeaders) => {
      const mergedHeaders = { ...gameData.headers };
      // Apply all fields: set if defined, remove if undefined
      for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined && value !== '') {
          mergedHeaders[key] = value;
        } else {
          delete mergedHeaders[key];
        }
      }
      const updatedGame: GameData = {
        ...gameData,
        headers: mergedHeaders,
      };
      const updatedPgn = rebuildPgn(updatedGame, selectedGameIndex, timestamps);
      setPgnText(updatedPgn);
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn });
      }
      setShowEditGameInfo(false);
    },
    [gameData, selectedGameIndex, timestamps, rebuildPgn, setPgnText, currentGameId, library],
  );

  /** Update a move's comment text (doesn't touch timestamps) */
  const handleUpdateComment = useCallback(
    (nodeId: string, newComment: string) => {
      if (!gameData.moveTree) return;

      const overrides: Record<string, NodeOverrides> = { [nodeId]: { comment: newComment || undefined } };
      const updatedPgn = rebuildPgnWithOverrides(gameData, selectedGameIndex, timestamps, overrides);
      setPgnText(updatedPgn);
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn });
      }
    },
    [gameData, timestamps, selectedGameIndex, setPgnText, currentGameId, library, rebuildPgnWithOverrides],
  );

  /** Save user-drawn shapes (arrows + highlights) to the current node */
  const handleShapesChange = useCallback(
    (drawnShapes: DrawShape[]) => {
      if (!currentNodeId || !gameData.moveTree) return;
      const node = findNodeById(gameData.moveTree, currentNodeId);
      if (!node) return;

      const newArrows = drawnShapes.filter((s) => s.dest);
      const newHighlights = drawnShapes.filter((s) => !s.dest);

      // Skip if this is an empty onChange triggered by position change
      const hadShapes = (node.arrows?.length || 0) + (node.highlights?.length || 0) > 0;
      const hasShapes = newArrows.length + newHighlights.length > 0;
      if (hadShapes && !hasShapes) return;

      const overrides: Record<string, NodeOverrides> = {
        [currentNodeId]: { arrows: newArrows, highlights: newHighlights },
      };
      const updatedPgn = rebuildPgnWithOverrides(gameData, selectedGameIndex, timestamps, overrides);
      setPgnText(updatedPgn);
      if (currentGameId) {
        library.updateGame(currentGameId, { pgn: updatedPgn });
      }
    },
    [
      currentNodeId,
      gameData,
      timestamps,
      selectedGameIndex,
      setPgnText,
      currentGameId,
      library,
      rebuildPgnWithOverrides,
    ],
  );

  const handleCopyPgn = useCallback(() => {
    navigator.clipboard.writeText(displayPgn);
  }, [displayPgn]);

  const handleDeleteGame = useCallback(
    (id: string) => {
      library.deleteGame(id);
      if (id === currentGameId) {
        setCurrentGameId(null);
        setPgnText(EMPTY_PGN);
        setTimestamps({});
        setSelectedGameIndex(0);
        setCurrentNodeId(null);
        setVideoIdOverride('');
      }
    },
    [library, currentGameId, setPgnText],
  );

  const handleCloneGame = useCallback(
    (id: string) => {
      const game = library.getGame(id);
      if (!game) return;
      const clonedName = `${game.name} (copy)`;
      const cloned = library.createGame(clonedName, game.pgn, {
        videoId: game.videoId,
        folder: game.folder,
        timestamps: { ...game.timestamps },
      });
      loadGame(cloned);
    },
    [library, loadGame],
  );

  const handleGoHome = useCallback(() => {
    setCurrentGameId(null);
    setPgnText(EMPTY_PGN);
    setTimestamps({});
    setSelectedGameIndex(0);
    setCurrentNodeId(null);
    setVideoIdOverride('');
  }, [setPgnText]);

  /** Import a game with duplicate detection. Returns true if imported. */
  const importGameWithCheck = useCallback(
    (name: string, pgn: string, folder: string, videoId?: string): boolean => {
      // Create folder hierarchy
      const folderParts = folder.split('/').filter(Boolean);
      for (let i = 1; i <= folderParts.length; i++) {
        library.createFolder('/' + folderParts.slice(0, i).join('/'));
      }

      // Check for duplicate
      const existing = library.findGameByName(name, folder);
      if (existing) {
        const folderLabel = folder === '/' ? '/' : folder;
        const choice = window.confirm(
          t('duplicate.message', { name, folder: folderLabel }) +
            '\n\n' +
            t('duplicate.replace') +
            ' → OK\n' +
            t('duplicate.openExisting') +
            ' → ' +
            t('duplicate.cancel'),
        );
        if (choice) {
          // Replace: update existing game
          library.updateGame(existing.id, { pgn, videoId });
          loadGame({ ...existing, pgn, videoId });
          return true;
        } else {
          // Open existing
          loadGame(existing);
          return true;
        }
      }

      // No duplicate — create new
      const game = library.createGame(name, pgn, { folder, videoId });
      loadGame(game);
      return true;
    },
    [library, loadGame, t],
  );

  const handlePeerReceive = useCallback(
    (data: { name: string; pgn: string; videoId?: string; folder?: string }) => {
      const folder = data.folder || '/';
      importGameWithCheck(data.name, data.pgn, folder, data.videoId);
      setShowReceiveDialog(false);
      showToast(t('toast.importSuccess', { name: data.name }));
    },
    [importGameWithCheck, t],
  );

  const handleRenameGame = useCallback(
    (id: string, newName: string) => {
      library.updateGame(id, { name: newName });
    },
    [library],
  );

  const handleCreateFolder = useCallback(
    (path: string) => {
      library.createFolder(path);
    },
    [library],
  );

  const handleExportLibrary = useCallback(() => {
    const json = library.exportLibrary();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ch3ssvid5-library.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [library]);

  const handleImportLibrary = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        library.importLibrary(reader.result as string);
        setShowSettings(false);
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset so same file can be re-imported
    },
    [library],
  );

  const handleImportPgnFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reject files over 10MB
      if (file.size > 10 * 1024 * 1024) {
        showToast(t('toast.fileTooLarge'));
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const pgn = reader.result as string;

        // Basic validation: must contain at least one PGN header or move
        if (!pgn.trim() || (!pgn.includes('[') && !/\d+\./.test(pgn))) {
          showToast(t('toast.invalidPgn'));
          return;
        }

        const name = file.name.replace(/\.pgn$/i, '');
        const vidMatch = pgn.match(/\[VideoURL\s+"([^"]*)"\]/);
        const vid = vidMatch ? extractVideoId(vidMatch[1]) : undefined;
        importGameWithCheck(name, pgn, libraryFolder, vid);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importGameWithCheck, libraryFolder, t],
  );

  const handleExportPgnFile = useCallback(async () => {
    const currentGameObj = currentGameId ? library.getGame(currentGameId) : undefined;
    const name = currentGameObj?.name || gameData.headers['Event'] || gameData.headers['White'] || 'game';
    const fileName = `${sanitizeName(name)}.pgn`;

    // Try native "Save As" dialog (Chromium browsers)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (
          window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }
        ).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'PGN file',
              accept: { 'text/plain': ['.pgn'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(displayPgn);
        await writable.close();
        return;
      } catch {
        // User cancelled or API not available — fall through to blob download
      }
    }

    // Fallback: blob download
    const blob = new Blob([displayPgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentGameId, library, gameData.headers, displayPgn]);

  // --- URL import handlers ---
  const handleUrlImportConfirm = useCallback(async () => {
    if (!urlImport) return;
    setUrlImportLoading(true);
    setUrlImportError(undefined);

    try {
      const pgn = await fetchPgn(urlImport.pgnUrl);

      // Extract videoId from PGN
      const vidMatch = pgn.match(/\[VideoURL\s+"([^"]*)"\]/);
      const vid = vidMatch ? extractVideoId(vidMatch[1]) : undefined;

      // Import with duplicate check
      importGameWithCheck(urlImport.gameName, pgn, urlImport.folder, vid);
      showToast(t('toast.importSuccess', { name: urlImport.gameName }));

      // Clean URL parameters without reload
      window.history.replaceState({}, '', window.location.pathname);
      setUrlImport(null);
    } catch (e) {
      setUrlImportError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setUrlImportLoading(false);
    }
  }, [urlImport, importGameWithCheck, t]);

  const handleUrlImportCancel = useCallback(() => {
    setUrlImport(null);
    // Clean URL parameters
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // Show domain warning immediately if URL is from a disallowed domain
  useEffect(() => {
    if (urlImport && !isAllowedDomain(urlImport.pgnUrl)) {
      setUrlImportError(t('importUrl.domainNotAllowed'));
    }
  }, [urlImport, t]);

  // Resolve current move's effective timestamp for display
  const currentMoveTimestamp = currentNode
    ? ((timestamps[currentNode.id] as number | undefined) ?? currentNode.timestamp)
    : undefined;

  const currentGame = currentGameId ? library.getGame(currentGameId) : undefined;
  const hasContent = gameData.moves.length > 0 || gameData.moveTree !== null || !!currentGameId;

  // Player info for board display
  const h = gameData.headers;
  const whitePlayer =
    h['White'] && h['White'] !== '?'
      ? {
          name: h['White'],
          elo: h['WhiteElo'],
          team: h['WhiteTeam'],
          result: h['Result']?.split('-')[0],
        }
      : undefined;
  const blackPlayer =
    h['Black'] && h['Black'] !== '?'
      ? {
          name: h['Black'],
          elo: h['BlackElo'],
          team: h['BlackTeam'],
          result: h['Result']?.split('-')[1],
        }
      : undefined;
  const topPlayer = orientation === 'white' ? blackPlayer : whitePlayer;
  const bottomPlayer = orientation === 'white' ? whitePlayer : blackPlayer;

  // Wait for IndexedDB data to load before rendering the app
  if (library.loading) return null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button
            className="library-toggle"
            onClick={() => setShowLibrary(!showLibrary)}
            title={showLibrary ? t('header.hideLibrary') : t('header.showLibrary')}
          >
            {showLibrary ? '◀' : '☰'}
          </button>
          <h1 className="app-title" onClick={handleGoHome} title={t('app.backToHome')}>
            {t('app.title')}
          </h1>
          <span className="app-version">v{__APP_VERSION__}</span>
          {currentGame && (
            <span className="current-game-name">
              {currentGame.name}
              <button className="close-game-btn" onClick={handleGoHome} title={t('app.closeGame')}>
                ✕
              </button>
            </span>
          )}
        </div>
        <div className="header-actions">
          {!isMobile && (
            <button className="header-btn" onClick={handleCopyPgn} disabled={!hasContent} title={t('header.copyTitle')}>
              📋<span className="btn-label"> {t('header.copyLabel', 'Copy')}</span>
            </button>
          )}
          {!isMobile && (
            <button
              className="header-btn"
              onClick={handleExportPgnFile}
              disabled={!hasContent}
              title={t('header.exportTitle')}
            >
              💾<span className="btn-label"> {t('header.exportLabel', 'Export')}</span>
            </button>
          )}
          <button
            className="header-btn"
            onClick={() => setShowShareDialog(true)}
            disabled={!hasContent}
            title={t('share.shareGame', 'Share game')}
          >
            🔗
          </button>
          <button
            className="header-btn"
            onClick={() => setShowReceiveDialog(true)}
            title={t('share.receiveGame', 'Receive game')}
          >
            📲
          </button>
          {!isMobile && (
            <label className="header-btn import-label" title={t('header.importTitle')}>
              📂<span className="btn-label"> {t('header.importLabel', 'Import')}</span>
              <input type="file" accept=".pgn" onChange={handleImportPgnFile} hidden />
            </label>
          )}
          <button className="settings-btn" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? t('header.close') : '⚙️'}
          </button>
          {!isMobile && (
            <a
              className="github-link"
              href="https://github.com/sebbrochet/ch3ssvid5"
              target="_blank"
              rel="noopener noreferrer"
              title={t('header.viewOnGitHub')}
            >
              <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          )}
          {document.fullscreenEnabled && (
            <button
              className="lang-toggle"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  document.documentElement.requestFullscreen();
                }
              }}
              title={t('header.fullscreen', 'Toggle fullscreen')}
            >
              ⛶
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          pgnText={displayPgn}
          videoUrl={videoUrl}
          onVideoUrlChange={setVideoUrl}
          onVideoUrlSubmit={handleVideoUrlSubmit}
          onExportLibrary={handleExportLibrary}
          onImportLibrary={handleImportLibrary}
          boardTheme={boardTheme}
          onBoardThemeChange={(theme) => {
            setBoardTheme(theme);
            localStorage.setItem('ch3ssvid5-board-theme', theme);
          }}
          pieceTheme={pieceTheme}
          onPieceThemeChange={(theme) => {
            setPieceTheme(theme);
            localStorage.setItem('ch3ssvid5-piece-theme', theme);
          }}
          showSquareLabels={showSquareLabels}
          onSquareLabelsChange={(v) => {
            setShowSquareLabels(v);
            localStorage.setItem('ch3ssvid5-square-labels', String(v));
          }}
          moveAnimationsEnabled={moveAnimationsEnabled}
          onMoveAnimationsChange={(v) => {
            setMoveAnimationsEnabled(v);
            localStorage.setItem('ch3ssvid5-move-animations', String(v));
          }}
          soundEnabled={soundEnabled}
          onSoundChange={(v) => {
            setSoundEnabled(v);
            localStorage.setItem('ch3ssvid5-sound', String(v));
          }}
          gameCount={library.games.length}
          playlistCount={playlist.playlists.length}
          isMobile={isMobile}
        />
      )}

      <div className="app-body">
        {showLibrary && (
          <>
            <div className="sidebar-backdrop" onClick={() => setShowLibrary(false)} />
            <aside className="library-sidebar">
              {selectedPlaylistView ? (
                <PlaylistView
                  playlist={selectedPlaylistView}
                  games={library.games}
                  activeIndex={playlist.activeIndex}
                  isPlaying={playlist.activePlaylistId === selectedPlaylistView.id}
                  isMobile={isMobile}
                  onBack={() => setSelectedPlaylistViewId(null)}
                  onSelectGame={handlePlaylistSelectGame}
                  onPlayAll={handlePlaylistPlayAll}
                  onRemoveGame={(index) => playlist.removeGame(selectedPlaylistView.id, index)}
                  onReorderGame={(from, to) => playlist.reorderGame(selectedPlaylistView.id, from, to)}
                  onExport={handlePlaylistExport}
                  onAddGames={() => setShowGamePicker(true)}
                />
              ) : (
                <GameLibrary
                  games={library.games}
                  currentGameId={currentGameId}
                  getGamesInFolder={library.getGamesInFolder}
                  getSubfolders={library.getSubfolders}
                  onSelectGame={(game) => {
                    loadGame(game);
                    if (isSynced) {
                      seekToRef.current?.(0);
                    }
                    if (window.innerWidth <= 768) setShowLibrary(false);
                  }}
                  onNewGame={handleNewGame}
                  onDeleteGame={handleDeleteGame}
                  onCloneGame={handleCloneGame}
                  onRenameGame={handleRenameGame}
                  onCreateFolder={handleCreateFolder}
                  onMoveGame={library.moveGame}
                  onDeleteFolder={library.deleteFolder}
                  onRenameFolder={library.renameFolder}
                  currentFolder={libraryFolder}
                  onCurrentFolderChange={setLibraryFolder}
                  isMobile={isMobile}
                  playlists={playlist.playlists}
                  activePlaylistId={playlist.activePlaylistId}
                  onCreatePlaylist={(name) => playlist.createPlaylist(name)}
                  onDeletePlaylist={playlist.deletePlaylist}
                  onRenamePlaylist={(id, name) => playlist.updatePlaylist(id, { name })}
                  onSelectPlaylist={(pl) => {
                    playlist.cleanupPlaylist(pl.id, library.games);
                    setSelectedPlaylistViewId(pl.id);
                  }}
                  onAddToPlaylist={(plId, gameId) => {
                    playlist.addGame(plId, gameId);
                    showToast(t('playlist.gameAdded', 'Added to playlist'));
                  }}
                />
              )}
            </aside>
          </>
        )}

        <main className="app-main">
          {!hasContent ? (
            <div className="welcome-screen">
              <div className="welcome-content">
                <h2>{t('welcome.heading')}</h2>
                <p className="welcome-subtitle">{t('welcome.subtitle')}</p>
                {!isMobile && (
                  <div className="welcome-actions">
                    <div className="welcome-card" onClick={handleNewGame}>
                      <span className="welcome-icon">🎬</span>
                      <h3>{t('welcome.startFromVideo')}</h3>
                      <p>{t('welcome.startFromVideoDesc')}</p>
                    </div>
                    <div className="welcome-card">
                      <label className="welcome-card-label">
                        <span className="welcome-icon">📂</span>
                        <h3>{t('welcome.importPgn')}</h3>
                        <p>{t('welcome.importPgnDesc')}</p>
                        <input type="file" accept=".pgn" onChange={handleImportPgnFile} hidden />
                      </label>
                    </div>
                    <div className="welcome-card" onClick={() => setShowPlaylistImport(true)}>
                      <span className="welcome-icon">📋</span>
                      <h3>{t('welcome.importPlaylist')}</h3>
                      <p>{t('welcome.importPlaylistDesc')}</p>
                    </div>
                  </div>
                )}
                {!isMobile && library.games.length > 0 && (
                  <p className="welcome-hint">{t('welcome.desktopLibraryHint')}</p>
                )}

                <div className="welcome-tutorial">
                  <h3>
                    <Trans
                      i18nKey="welcome.trySample"
                      components={{
                        hub: (
                          <a
                            href="https://ch3ssvid5hub.sebbrochet.com/"
                            target="ch3ssvid5hub"
                            rel="noopener noreferrer"
                          />
                        ),
                      }}
                    />
                  </h3>
                  <div className="sample-games">
                    {[
                      {
                        file: 'Bypass Years of Opening Study With This System.pgn',
                        name: 'Jobava London (IM Alex Banzea)',
                        folder: 'Samples',
                      },
                      {
                        file: 'Chapter 1 - Caro-Kann - Advanced 4.c3.pgn',
                        name: 'Caro-Kann Defense (ChessGeek)',
                        folder: 'Samples',
                      },
                    ].map((s) => {
                      const sampleUrl = `${window.location.origin}${import.meta.env.BASE_URL}samples/${s.file}`;
                      return (
                        <button
                          key={s.file}
                          className="sample-btn"
                          onClick={() => setUrlImport({ pgnUrl: sampleUrl, folder: `/${s.folder}`, gameName: s.name })}
                        >
                          ♟ {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isMobile && library.games.length > 0 && <p className="welcome-hint">{t('welcome.libraryHint')}</p>}

                {isMobile && (
                  <>
                    <p className="welcome-hint">{t('welcome.receiveHint')}</p>
                    <div className="welcome-actions">
                      <div className="welcome-card" onClick={() => setShowReceiveDialog(true)}>
                        <span className="welcome-icon">📲</span>
                        <h3>{t('share.receiveGame')}</h3>
                        <p>{t('share.receiveDesc')}</p>
                      </div>
                    </div>
                  </>
                )}

                {isMobile ? (
                  <>
                    <div className="welcome-tutorial">
                      <h3>{t('welcome.howItWorks')}</h3>
                      <div className="tutorial-steps">
                        <div className="tutorial-step">
                          <span className="step-number">1</span>
                          <div>
                            <strong>{t('welcome.mobileStep1Title', 'Receive a game')}</strong>
                            <p>
                              {t(
                                'welcome.mobileStep1Desc',
                                'Tap 📲 Receive and enter the code from the sharing device, or tap a sample above.',
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="tutorial-step">
                          <span className="step-number">2</span>
                          <div>
                            <strong>{t('welcome.mobileStep2Title', 'Watch & follow')}</strong>
                            <p>
                              {t(
                                'welcome.mobileStep2Desc',
                                'The board follows the video automatically. Tap any move in the list to jump to that position.',
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="tutorial-step">
                          <span className="step-number">3</span>
                          <div>
                            <strong>{t('welcome.mobileStep3Title', 'Landscape for best view')}</strong>
                            <p>
                              {t(
                                'welcome.mobileStep3Desc',
                                'Rotate your phone for side-by-side video and board. Tap ⛶ for fullscreen.',
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <p className="welcome-tease">{t('welcome.mobileTease')}</p>
                  </>
                ) : (
                  <>
                    <div className="welcome-tutorial">
                      <h3>{t('welcome.howItWorks')}</h3>
                      <div className="tutorial-steps">
                        <div className="tutorial-step">
                          <span className="step-number">1</span>
                          <div>
                            <strong>{t('welcome.step1Title')}</strong>
                            <p>{t('welcome.step1Desc')}</p>
                          </div>
                        </div>
                        <div className="tutorial-step">
                          <span className="step-number">2</span>
                          <div>
                            <strong>{t('welcome.step2Title')}</strong>
                            <p>{t('welcome.step2Desc')}</p>
                          </div>
                        </div>
                        <div className="tutorial-step">
                          <span className="step-number">3</span>
                          <div>
                            <strong>{t('welcome.step3Title')}</strong>
                            <p>
                              <Trans i18nKey="welcome.step3Desc" components={{ em: <em /> }} />
                            </p>
                          </div>
                        </div>
                        <div className="tutorial-step">
                          <span className="step-number">4</span>
                          <div>
                            <strong>{t('welcome.step4Title')}</strong>
                            <p>
                              <Trans i18nKey="welcome.step4Desc" components={{ em: <em /> }} />
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="welcome-tutorial">
                      <h3>{t('welcome.shortcuts')}</h3>
                      <div className="shortcuts-grid">
                        <kbd>←</kbd>
                        <span>{t('welcome.prevMove')}</span>
                        <kbd>→</kbd>
                        <span>{t('welcome.nextMove')}</span>
                        <kbd>Home / ↑</kbd>
                        <span>{t('welcome.firstMove')}</span>
                        <kbd>End / ↓</kbd>
                        <span>{t('welcome.lastMove')}</span>
                        <kbd>F</kbd>
                        <span>{t('welcome.flipBoard')}</span>
                        <kbd>C</kbd>
                        <span>{t('welcome.captureTimestamp')}</span>
                        <kbd>E</kbd>
                        <span>{t('welcome.toggleEngine')}</span>
                        <kbd>Space</kbd>
                        <span>{t('welcome.playPause')}</span>
                      </div>
                    </div>
                    <p className="welcome-tease">{t('welcome.desktopTease')}</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="left-panel">
                <ChessBoardPanel
                  fen={currentFen}
                  pos={currentPos}
                  lastMove={currentLastMove}
                  orientation={orientation}
                  shapes={[...(currentNode?.arrows || []), ...(currentNode?.highlights || [])]}
                  engineArrow={
                    engineEnabled && engineInfo.bestMove
                      ? ({
                          brush: 'blue',
                          orig: engineInfo.bestMove.substring(0, 2),
                          dest: engineInfo.bestMove.substring(2, 4),
                        } as DrawShape)
                      : undefined
                  }
                  onMove={handleBoardMove}
                  onShapesChange={handleShapesChange}
                  interactive={!isMobile}
                  topPlayer={topPlayer}
                  bottomPlayer={bottomPlayer}
                  nag={currentNode?.nags?.[0]}
                  nagSquare={currentNode?.to}
                  evalStr={resolveEvalDisplay(engineEnabled, engineInfo.eval, currentNode?.eval)}
                  boardTheme={boardTheme}
                  pieceTheme={pieceTheme}
                  isChess960={isChess960}
                  variant={gameData.variant}
                  showSquareLabels={showSquareLabels}
                  moveAnimation={moveAnimationsEnabled ? (moveAnimation ?? undefined) : undefined}
                  onBoardTap={
                    isMobile && videoId
                      ? () => {
                          if (isVideoPlaying) {
                            pauseRef.current?.();
                          } else {
                            playRef.current?.();
                          }
                        }
                      : undefined
                  }
                  isVideoPlaying={isVideoPlaying}
                />
                {!isMobile && (
                  <CommentPanel comment={currentNode?.comment} nodeId={currentNodeId} onSave={handleUpdateComment} />
                )}
                <NavigationControls
                  onFirst={goToStart}
                  onPrev={goToPrev}
                  onNext={goToNext}
                  onLast={goToLast}
                  canPrev={currentNodeId !== null}
                  canNext={
                    (currentNode?.next !== null && currentNode?.next !== undefined) ||
                    (currentNodeId === null && tree !== null)
                  }
                  isSynced={isSynced}
                  onToggleSync={handleToggleSync}
                  onCaptureTimestamp={handleCaptureTimestamp}
                  onUndoTimestamp={handleUndoTimestamp}
                  canUndo={!!lastCapture}
                  canCapture={currentNodeId !== null && !!videoId}
                  canSync={!!videoId}
                  currentMoveTimestamp={currentMoveTimestamp}
                  onFlipBoard={handleFlipBoard}
                  orientation={orientation}
                  engineEnabled={engineEnabled}
                  onToggleEngine={() => setEngineEnabled((prev) => !prev)}
                  engineOverwrite={engineOverwrite}
                  onToggleOverwrite={() => setEngineOverwrite((prev) => !prev)}
                  engineDepth={engineDepth}
                  engineInfo={engineEnabled ? engineInfo : undefined}
                  hasVideo={!!videoId}
                  isVideoPlaying={isVideoPlaying}
                  onPlayPause={() => {
                    if (isVideoPlaying) {
                      pauseRef.current?.();
                    } else {
                      playRef.current?.();
                    }
                  }}
                  isMobile={isMobile}
                />
                {activePlaylist && (
                  <NowPlayingBar
                    playlist={activePlaylist}
                    currentIndex={playlist.activeIndex}
                    totalGames={activePlaylist.gameIds.length}
                    onPrev={handlePlaylistPrev}
                    onNext={handlePlaylistNext}
                    onExit={playlist.exitPlaylist}
                    canPrev={playlist.activeIndex > 0}
                    canNext={playlist.activeIndex < activePlaylist.gameIds.length - 1}
                    autoAdvanceCountdown={autoAdvanceCountdown}
                    onCancelAutoAdvance={cancelAutoAdvance}
                  />
                )}
              </div>
              <div
                className="right-panel"
                ref={rightPanelRef}
                style={{ gridTemplateRows: `${videoSplitPercent}% 4px 1fr` }}
              >
                <div className="right-upper">
                  {videoId ? (
                    <VideoPanelWithSync
                      videoId={videoId}
                      onTimeUpdate={onVideoTimeUpdate}
                      seekToRef={seekToRef}
                      getCurrentTimeRef={getCurrentTimeRef}
                      playRef={playRef}
                      pauseRef={pauseRef}
                      onPlayingChange={setIsVideoPlaying}
                    />
                  ) : (
                    <div className="no-video">
                      <p>{t('video.noVideo')}</p>
                      <p>{t('video.openSettings')}</p>
                    </div>
                  )}
                </div>
                <div className="horizontal-splitter" onMouseDown={handleSplitterMouseDown} />
                <div className="right-lower">
                  <GameSelector
                    games={allGames}
                    selectedIndex={selectedGameIndex}
                    onSelect={handleGameSelect}
                    onAddGame={isMobile ? undefined : handleAddGame}
                    onEditGameInfo={isMobile ? undefined : () => setShowEditGameInfo(true)}
                    onDeleteGame={isMobile ? undefined : handleDeleteCurrentGame}
                    hasFile={!!currentGameId}
                  />
                  <MoveTreePanel
                    tree={gameData.moveTree}
                    currentNodeId={currentNodeId}
                    onNodeClick={(nodeId) => {
                      triggerMoveAnimation(nodeId);
                      goToNode(nodeId);
                    }}
                    onStartClick={goToStart}
                    onDeleteFromHere={isMobile ? undefined : handleDeleteFromHere}
                    onPromoteVariation={isMobile ? undefined : handlePromoteVariation}
                    timestamps={timestamps}
                    showTimestamps={!isSynced}
                    orientation={orientation}
                    boardTheme={boardTheme}
                    opening={currentOpening}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {dialogMode && (
        <SaveGameDialog
          mode={dialogMode}
          initialName=""
          initialVideoUrl={dialogMode === 'new-file' ? '' : ''}
          currentVideoUrl={
            dialogMode === 'add-game' && videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined
          }
          folders={library.getFolders()}
          onSave={handleDialogSave}
          onAddGame={handleAddGameConfirm}
          onCancel={() => setDialogMode(null)}
        />
      )}

      {showEditGameInfo && (
        <EditGameInfoDialog
          headers={gameData.headers}
          previousVideoUrl={videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined}
          gameName={currentGame?.name}
          onSave={handleEditGameInfo}
          onCancel={() => setShowEditGameInfo(false)}
        />
      )}

      {urlImport && (
        <ImportUrlDialog
          pgnUrl={urlImport.pgnUrl}
          folder={urlImport.folder}
          gameName={urlImport.gameName}
          isLoading={urlImportLoading}
          error={urlImportError}
          onConfirm={handleUrlImportConfirm}
          onCancel={handleUrlImportCancel}
        />
      )}

      {showPlaylistImport && (
        <ImportPlaylistDialog
          games={library.games}
          onImport={(imports) => {
            let imported = 0;
            for (const item of imports) {
              const folderParts = item.folder.split('/').filter(Boolean);
              for (let i = 1; i <= folderParts.length; i++) {
                library.createFolder('/' + folderParts.slice(0, i).join('/'));
              }
              if (!library.findGameByName(item.name, item.folder)) {
                library.createGame(item.name, item.pgn, { folder: item.folder, videoId: item.videoId });
                imported++;
              }
            }
            setShowPlaylistImport(false);
            showToast(t('importPlaylist.success', { imported, total: imports.length }));
          }}
          onCancel={() => setShowPlaylistImport(false)}
        />
      )}

      {showShareDialog && currentGame && (
        <PeerShareDialog
          gameName={currentGame.name}
          pgn={displayPgn}
          videoId={videoId || undefined}
          folder={currentGame.folder}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showReceiveDialog && (
        <PeerReceiveDialog onReceive={handlePeerReceive} onClose={() => setShowReceiveDialog(false)} />
      )}

      {showGamePicker && selectedPlaylistView && (
        <PlaylistGamePicker
          games={library.games}
          onAdd={(gameIds) => {
            playlist.updatePlaylist(selectedPlaylistView.id, {
              gameIds: [...selectedPlaylistView.gameIds, ...gameIds],
            });
          }}
          onClose={() => setShowGamePicker(false)}
        />
      )}

      <input
        type="file"
        accept=".json"
        id="playlist-import-input"
        style={{ display: 'none' }}
        onChange={handlePlaylistImport}
      />
    </div>
  );
}
