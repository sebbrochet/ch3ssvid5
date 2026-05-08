import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import { fenToPosition, isPromotion, applyMove, chessgroundDests, variantToRules } from '../utils/chessPosition';
import type { Position } from 'chessops/chess';
import type { DrawShape } from '../types';
import { SquareLabels } from './SquareLabels';
import { MoveOverlay } from './MoveOverlay';
import './ChessBoardPanel.css';
import './PieceThemes.css';

export interface PlayerInfo {
  name: string;
  elo?: string;
  team?: string;
  result?: string;
}

interface Props {
  fen: string;
  pos?: Position | null;
  lastMove?: [string, string];
  orientation?: 'white' | 'black';
  shapes?: DrawShape[];
  onMove?: (from: string, to: string, san: string, newFen: string) => void;
  onShapesChange?: (shapes: DrawShape[]) => void;
  engineArrow?: DrawShape;
  interactive?: boolean;
  topPlayer?: PlayerInfo;
  bottomPlayer?: PlayerInfo;
  nag?: string;
  nagSquare?: string;
  evalStr?: string;
  boardTheme?: string;
  onBoardTap?: () => void;
  isVideoPlaying?: boolean;
  showSquareLabels?: boolean;
  moveAnimation?: { san: string; square: string; trigger: number; reverse?: boolean };
  pieceTheme?: string;
  isChess960?: boolean;
  variant?: string;
}

/** Convert eval string to white's percentage (0-100) for the eval bar */
function evalToWhitePercent(evalStr: string): number {
  if (evalStr.startsWith('#')) {
    const mateIn = parseInt(evalStr.substring(1));
    return mateIn > 0 ? 100 : 0;
  }
  const cp = parseFloat(evalStr);
  if (isNaN(cp)) return 50;
  const scaled = 50 + 50 * (2 / (1 + Math.exp(-0.5 * cp)) - 1);
  return Math.max(1, Math.min(99, scaled));
}

/** Format eval for the bar label */
function formatEvalShort(evalStr: string): string {
  if (evalStr.startsWith('#')) return evalStr;
  const num = parseFloat(evalStr);
  if (isNaN(num)) return '';
  return num > 0 ? `+${num.toFixed(1)}` : num.toFixed(1);
}

/** Map NAG symbol to Lichess-style color */
function nagColor(nag: string): string {
  switch (nag) {
    case '!!':
    case '$3':
      return '#22ac38'; // brilliant - green
    case '!':
    case '$1':
      return '#56b4e9'; // good - blue
    case '!?':
    case '$5':
      return '#56b4e9'; // interesting - blue
    case '?!':
    case '$6':
      return '#e69f00'; // dubious - orange
    case '?':
    case '$2':
      return '#e04040'; // mistake - red
    case '??':
    case '$4':
      return '#cc3333'; // blunder - dark red
    default:
      return '#999999';
  }
}

export function ChessBoardPanel({
  fen,
  pos: posProp,
  lastMove,
  orientation = 'white',
  shapes,
  onMove,
  onShapesChange,
  engineArrow,
  interactive = true,
  topPlayer,
  bottomPlayer,
  nag,
  nagSquare,
  evalStr,
  boardTheme,
  onBoardTap,
  isVideoPlaying,
  showSquareLabels,
  moveAnimation,
  pieceTheme,
  isChess960,
  variant,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const cgRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  const onShapesChangeRef = useRef(onShapesChange);
  const fenRef = useRef(fen);
  const lastUserMoveRef = useRef<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Key; to: Key; color: 'w' | 'b' } | null>(null);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const playPauseTimeoutRef = useRef<number | null>(null);

  // Inject piece theme CSS dynamically (handles Vite base URL for production)
  useEffect(() => {
    if (!pieceTheme || pieceTheme === 'cburnett') {
      // Remove any injected piece theme style
      document.getElementById('piece-theme-style')?.remove();
      return;
    }
    const base = import.meta.env.BASE_URL || '/';
    const pieces = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
    const colors = [
      { css: 'white', file: 'w' },
      { css: 'black', file: 'b' },
    ];
    const fileMap: Record<string, string> = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: 'P' };
    let css = '';
    for (const color of colors) {
      for (const piece of pieces) {
        const url = `${base}pieces/${pieceTheme}/${color.file}${fileMap[piece]}.svg`;
        css += `.cg-wrap piece.${piece}.${color.css} { background-image: url('${url}') !important; }\n`;
      }
    }
    let styleEl = document.getElementById('piece-theme-style') as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'piece-theme-style';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
    return () => {
      styleEl?.remove();
    };
  }, [pieceTheme]);

  useEffect(() => {
    onMoveRef.current = onMove;
    onShapesChangeRef.current = onShapesChange;
    fenRef.current = fen;
  });

  const handleMove = useCallback((from: Key, to: Key) => {
    if (!onMoveRef.current) return;
    const currentFen = fenRef.current;
    const rules = variantToRules(variant);
    const pos = fenToPosition(currentFen, rules);
    if (!pos) return;

    if (isPromotion(pos, from, to)) {
      setPendingPromotion({ from, to, color: pos.turn === 'white' ? 'w' : 'b' });
      return;
    }

    const result = applyMove(pos, from, to);
    if (result) {
      lastUserMoveRef.current = result.newFen;
      onMoveRef.current(from, to, result.san, result.newFen);
    }
  }, []);

  const handlePromotionChoice = useCallback(
    (piece: 'q' | 'r' | 'b' | 'n') => {
      if (!pendingPromotion || !onMoveRef.current) return;
      const { from, to } = pendingPromotion;
      const pos = fenToPosition(fenRef.current, variantToRules(variant));
      if (!pos) return;
      const roleMap: Record<string, 'queen' | 'rook' | 'bishop' | 'knight'> = {
        q: 'queen',
        r: 'rook',
        b: 'bishop',
        n: 'knight',
      };
      const result = applyMove(pos, from, to, roleMap[piece]);
      if (result) {
        lastUserMoveRef.current = result.newFen;
        onMoveRef.current(from, to, result.san, result.newFen);
      }
      setPendingPromotion(null);
    },
    [pendingPromotion],
  );

  const cancelPromotion = useCallback(() => {
    // Reset board position to undo the visual move
    if (cgRef.current) {
      cgRef.current.set({ fen: fenRef.current });
    }
    setPendingPromotion(null);
  }, []);

  // Initialize Chessground
  useEffect(() => {
    if (!boardRef.current) return;

    const rules = variantToRules(variant);
    const pos = posProp ?? fenToPosition(fen, rules);
    const turn = pos?.turn ?? 'white';

    cgRef.current = Chessground(boardRef.current, {
      fen,
      orientation,
      turnColor: turn,
      movable: {
        free: false,
        color: interactive ? 'both' : undefined,
        dests: interactive && pos ? (chessgroundDests(pos, { chess960: isChess960 }) as Map<Key, Key[]>) : new Map(),
        events: {
          after: handleMove,
        },
      },
      draggable: { enabled: interactive },
      selectable: { enabled: interactive },
      animation: { enabled: true, duration: 200 },
      highlight: {
        lastMove: true,
        check: true,
      },
      drawable: {
        enabled: true,
        onChange: (drawnShapes) => {
          if (onShapesChangeRef.current) {
            const converted: DrawShape[] = drawnShapes
              .filter((s) => s.brush) // skip shapes without brush
              .map((s) => ({
                brush: s.brush || 'green',
                orig: s.orig,
                dest: s.dest,
              }));
            onShapesChangeRef.current(converted);
          }
        },
      },
    });

    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update position when FEN changes
  useEffect(() => {
    if (!cgRef.current) return;

    // Skip re-setting the board if this FEN is from a user move
    // (chessground already shows it, re-setting would snap pieces)
    if (lastUserMoveRef.current === fen) {
      lastUserMoveRef.current = null;
      // Still update movable/interactive state
      const pos = posProp ?? fenToPosition(fen, variantToRules(variant));
      cgRef.current.set({
        turnColor: pos?.turn ?? 'white',
        movable: {
          color: interactive ? 'both' : undefined,
          dests: interactive && pos ? (chessgroundDests(pos, { chess960: isChess960 }) as Map<Key, Key[]>) : new Map(),
        },
        draggable: { enabled: interactive },
        selectable: { enabled: interactive },
      });
      return;
    }

    const pos = posProp ?? fenToPosition(fen, variantToRules(variant));
    const turn = pos?.turn ?? 'white';
    const inCheck = pos?.isCheck() ?? false;

    cgRef.current.set({
      fen,
      orientation,
      turnColor: turn,
      check: inCheck,
      lastMove: lastMove as Key[] | undefined,
      movable: {
        color: interactive ? 'both' : undefined,
        dests: interactive && pos ? (chessgroundDests(pos, { chess960: isChess960 }) as Map<Key, Key[]>) : new Map(),
      },
      draggable: { enabled: interactive },
      selectable: { enabled: interactive },
      drawable: {
        // User-editable shapes (from PGN annotations — can be toggled by right-click)
        shapes: (shapes || []).map((s) => ({
          orig: s.orig as Key,
          dest: s.dest as Key | undefined,
          brush: s.brush,
        })),
        // Programmatic shapes (engine arrow, NAG label — not user-editable)
        autoShapes: [
          ...(engineArrow
            ? [
                {
                  orig: engineArrow.orig as Key,
                  dest: engineArrow.dest as Key | undefined,
                  brush: engineArrow.brush,
                },
              ]
            : []),
          ...(nag && nagSquare
            ? [
                {
                  orig: nagSquare as Key,
                  label: { text: nag, fill: nagColor(nag) },
                },
              ]
            : []),
        ],
      },
    });
  }, [fen, interactive, lastMove, orientation, shapes, engineArrow, nag, nagSquare]);

  return (
    <div className="board-panel" data-board-theme={boardTheme || 'brown'}>
      {topPlayer && (
        <div className="player-bar top">
          {topPlayer.result !== undefined && <span className="player-result">{topPlayer.result}</span>}
          {topPlayer.team && <span className="player-team">{topPlayer.team}</span>}
          <span className="player-name">{topPlayer.name}</span>
          {topPlayer.elo && <span className="player-elo">{topPlayer.elo}</span>}
        </div>
      )}
      <div className="board-row">
        {evalStr !== undefined && (
          <div className={`eval-bar${orientation === 'black' ? ' flipped' : ''}`} title={evalStr}>
            <div
              className="eval-bar-fill"
              style={{
                height: `${orientation === 'black' ? 100 - evalToWhitePercent(evalStr) : evalToWhitePercent(evalStr)}%`,
              }}
            />
            <div className="eval-bar-label">{formatEvalShort(evalStr)}</div>
          </div>
        )}
        <div
          className="board-container-wrapper"
          onPointerUp={
            onBoardTap
              ? (e) => {
                  // Only handle primary button (finger tap or left click)
                  if (e.button !== 0) return;
                  onBoardTap();
                  setShowPlayPauseIcon(true);
                  if (playPauseTimeoutRef.current) clearTimeout(playPauseTimeoutRef.current);
                  playPauseTimeoutRef.current = window.setTimeout(() => setShowPlayPauseIcon(false), 600);
                }
              : undefined
          }
        >
          {showSquareLabels && <SquareLabels orientation={orientation || 'white'} fen={fen} />}
          {moveAnimation && (
            <MoveOverlay
              san={moveAnimation.san}
              square={moveAnimation.square}
              orientation={orientation || 'white'}
              trigger={moveAnimation.trigger}
              reverse={moveAnimation.reverse}
            />
          )}
          <div ref={boardRef} className="board-container" />
          {showPlayPauseIcon && onBoardTap && (
            <div className="board-play-pause-overlay">
              <span className="board-play-pause-icon">{isVideoPlaying ? '⏸' : '▶'}</span>
            </div>
          )}
          {pendingPromotion && (
            <div className="promotion-overlay" onClick={cancelPromotion}>
              <div
                className={`promotion-picker ${pendingPromotion.color === 'w' ? 'white' : 'black'} ${orientation === 'black' ? 'flipped' : ''}`}
                style={
                  {
                    '--promo-file': (() => {
                      const fileIndex = pendingPromotion.to.charCodeAt(0) - 'a'.charCodeAt(0);
                      return orientation === 'black' ? 7 - fileIndex : fileIndex;
                    })(),
                  } as React.CSSProperties
                }
                onClick={(e) => e.stopPropagation()}
              >
                {(['q', 'r', 'b', 'n'] as const).map((piece) => (
                  <button
                    key={piece}
                    className="promotion-piece"
                    onClick={() => handlePromotionChoice(piece)}
                    title={
                      piece === 'q'
                        ? t('board.queen')
                        : piece === 'r'
                          ? t('board.rook')
                          : piece === 'b'
                            ? t('board.bishop')
                            : t('board.knight')
                    }
                  >
                    {pendingPromotion.color === 'w'
                      ? { q: '♕', r: '♖', b: '♗', n: '♘' }[piece]
                      : { q: '♛', r: '♜', b: '♝', n: '♞' }[piece]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {bottomPlayer && (
        <div className="player-bar bottom">
          {bottomPlayer.result !== undefined && <span className="player-result">{bottomPlayer.result}</span>}
          {bottomPlayer.team && <span className="player-team">{bottomPlayer.team}</span>}
          <span className="player-name">{bottomPlayer.name}</span>
          {bottomPlayer.elo && <span className="player-elo">{bottomPlayer.elo}</span>}
        </div>
      )}
    </div>
  );
}
