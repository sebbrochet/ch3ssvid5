import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key, Piece, Color, Role } from 'chessground/types';
import { validatePosition } from '../utils/boardValidation';
import './BoardEditor.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_PLACEMENT = '8/8/8/8/8/8/8/8';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

type PaletteItem = { color: Color; role: Role } | 'eraser';

interface BoardEditorProps {
  fen: string;
  onFenChange: (fen: string) => void;
}

type CastlingFlags = { K: boolean; Q: boolean; k: boolean; q: boolean };

/** Auto-uncheck castling when king/rook is removed/moved */
function autoCastling(p: Map<Key, Piece>, prev: CastlingFlags): CastlingFlags {
  const cast = { ...prev };
  const wk = p.get('e1' as Key);
  if (!wk || wk.role !== 'king' || wk.color !== 'white') {
    cast.K = false;
    cast.Q = false;
  }
  const bk = p.get('e8' as Key);
  if (!bk || bk.role !== 'king' || bk.color !== 'black') {
    cast.k = false;
    cast.q = false;
  }
  const h1 = p.get('h1' as Key);
  if (!h1 || h1.role !== 'rook' || h1.color !== 'white') cast.K = false;
  const a1 = p.get('a1' as Key);
  if (!a1 || a1.role !== 'rook' || a1.color !== 'white') cast.Q = false;
  const h8 = p.get('h8' as Key);
  if (!h8 || h8.role !== 'rook' || h8.color !== 'black') cast.k = false;
  const a8 = p.get('a8' as Key);
  if (!a8 || a8.role !== 'rook' || a8.color !== 'black') cast.q = false;
  return cast;
}

/** Parse FEN piece placement into a Map<Key, Piece> */
function fenToPieces(placement: string): Map<Key, Piece> {
  const pieces = new Map<Key, Piece>();
  const ranks = placement.split('/');
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') {
        file += parseInt(ch);
      } else {
        const color: Color = ch === ch.toUpperCase() ? 'white' : 'black';
        const roleMap: Record<string, Role> = {
          k: 'king',
          q: 'queen',
          r: 'rook',
          b: 'bishop',
          n: 'knight',
          p: 'pawn',
        };
        const role = roleMap[ch.toLowerCase()];
        if (role) {
          const key = `${FILES[file]}${RANKS[r]}` as Key;
          pieces.set(key, { color, role });
        }
        file++;
      }
    }
  }
  return pieces;
}

/** Convert a Map<Key, Piece> to FEN piece placement string */
function piecesToFen(pieces: Map<Key, Piece>): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const key = `${FILES[f]}${RANKS[r]}` as Key;
      const piece = pieces.get(key);
      if (piece) {
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        const letterMap: Record<Role, string> = {
          king: 'k',
          queen: 'q',
          rook: 'r',
          bishop: 'b',
          knight: 'n',
          pawn: 'p',
        };
        const letter = letterMap[piece.role];
        row += piece.color === 'white' ? letter.toUpperCase() : letter;
      } else {
        empty++;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return rows.join('/');
}

export function BoardEditor({ fen, onFenChange }: BoardEditorProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const { t } = useTranslation();

  // Parse incoming FEN
  const fenParts = fen.split(' ');
  const placement = fenParts[0] || EMPTY_PLACEMENT;

  const [pieces, setPieces] = useState<Map<Key, Piece>>(() => fenToPieces(placement));
  const [selectedPalette, setSelectedPalette] = useState<PaletteItem | null>(null);
  const [sideToMove, setSideToMove] = useState<'w' | 'b'>(fenParts[1] === 'b' ? 'b' : 'w');
  const [castling, setCastling] = useState(() => {
    const c = fenParts[2] || 'KQkq';
    return { K: c.includes('K'), Q: c.includes('Q'), k: c.includes('k'), q: c.includes('q') };
  });
  const [fenInput, setFenInput] = useState('');
  const [showFenInput, setShowFenInput] = useState(false);
  const [fenError, setFenError] = useState('');

  // Build full FEN from current state
  const buildFen = useCallback((p: Map<Key, Piece>, side: 'w' | 'b', cast: typeof castling) => {
    const pl = piecesToFen(p);
    const castStr = (cast.K ? 'K' : '') + (cast.Q ? 'Q' : '') + (cast.k ? 'k' : '') + (cast.q ? 'q' : '') || '-';
    return `${pl} ${side} ${castStr} - 0 1`;
  }, []);

  // Sync changes out
  const emitFen = useCallback(
    (p: Map<Key, Piece>, side: 'w' | 'b', cast: typeof castling) => {
      onFenChange(buildFen(p, side, cast));
    },
    [buildFen, onFenChange],
  );

  // Init Chessground
  useEffect(() => {
    if (!boardRef.current) return;
    cgRef.current = Chessground(boardRef.current, {
      fen: placement,
      orientation: 'white',
      movable: { free: false, color: undefined, dests: new Map() },
      draggable: { enabled: false },
      selectable: { enabled: false },
      animation: { enabled: false },
      highlight: { lastMove: false, check: false },
      drawable: { enabled: false },
      coordinates: false,
      events: {
        select: (key: Key) => handleSquareClick(key),
      },
    });
    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep Chessground in sync with pieces
  useEffect(() => {
    if (!cgRef.current) return;
    cgRef.current.set({ fen: piecesToFen(pieces) });
  }, [pieces]);

  // Handle square clicks
  const handleSquareClick = useCallback(
    (key: Key) => {
      setSelectedPalette((current) => {
        setPieces((prev) => {
          const next = new Map(prev);
          if (current === 'eraser') {
            next.delete(key);
          } else if (current) {
            next.set(key, { color: current.color, role: current.role });
          } else {
            // No tool selected — right-click removes (handled separately), click does nothing
            return prev;
          }
          // Auto-uncheck castling
          setCastling((prevCast) => autoCastling(next, prevCast));
          // Defer FEN emission
          setTimeout(() => {
            setSideToMove((s) => {
              setCastling((c) => {
                onFenChange(buildFen(next, s, c));
                return c;
              });
              return s;
            });
          }, 0);
          return next;
        });
        return current; // keep palette selected
      });
    },
    [buildFen, onFenChange],
  );

  // Handle right-click to remove piece
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      // Find the square from click position
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const fileIdx = Math.floor((x / rect.width) * 8);
      const rankIdx = Math.floor((y / rect.height) * 8);
      if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return;
      const key = `${FILES[fileIdx]}${RANKS[rankIdx]}` as Key;
      setPieces((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        setCastling((c) => autoCastling(next, c));
        setTimeout(() => {
          setSideToMove((s) => {
            setCastling((c) => {
              onFenChange(buildFen(next, s, c));
              return c;
            });
            return s;
          });
        }, 0);
        return next;
      });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [buildFen, onFenChange]);

  // Side-to-move change
  const handleSideChange = (side: 'w' | 'b') => {
    setSideToMove(side);
    emitFen(pieces, side, castling);
  };

  // Castling change
  const handleCastlingChange = (key: 'K' | 'Q' | 'k' | 'q', checked: boolean) => {
    const next = { ...castling, [key]: checked };
    setCastling(next);
    emitFen(pieces, sideToMove, next);
  };

  // Preset: starting position
  const handleStartingPos = () => {
    const p = fenToPieces('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    const cast = { K: true, Q: true, k: true, q: true };
    setPieces(p);
    setSideToMove('w');
    setCastling(cast);
    onFenChange(START_FEN);
  };

  // Preset: clear board
  const handleClear = () => {
    const p = new Map<Key, Piece>();
    const cast = { K: false, Q: false, k: false, q: false };
    setPieces(p);
    setCastling(cast);
    onFenChange(buildFen(p, sideToMove, cast));
  };

  // From FEN
  const handleFenSubmit = () => {
    const trimmed = fenInput.trim();
    if (!trimmed) return;
    // Basic FEN validation: at least piece placement
    const parts = trimmed.split(' ');
    const pl = parts[0];
    if (!pl || pl.split('/').length !== 8) {
      setFenError(t('editor.invalidFen', 'Invalid FEN string'));
      return;
    }
    try {
      const p = fenToPieces(pl);
      const side = parts[1] === 'b' ? ('b' as const) : ('w' as const);
      const castStr = parts[2] || '-';
      const cast = {
        K: castStr.includes('K'),
        Q: castStr.includes('Q'),
        k: castStr.includes('k'),
        q: castStr.includes('q'),
      };
      setPieces(p);
      setSideToMove(side);
      setCastling(cast);
      setFenError('');
      setShowFenInput(false);
      setFenInput('');
      onFenChange(buildFen(p, side, cast));
    } catch {
      setFenError(t('editor.invalidFen', 'Invalid FEN string'));
    }
  };

  // Palette rendering
  const paletteItems: { item: PaletteItem; label: string; symbol: string }[] = [
    { item: { color: 'white', role: 'king' }, label: 'K', symbol: '♔' },
    { item: { color: 'white', role: 'queen' }, label: 'Q', symbol: '♕' },
    { item: { color: 'white', role: 'rook' }, label: 'R', symbol: '♖' },
    { item: { color: 'white', role: 'bishop' }, label: 'B', symbol: '♗' },
    { item: { color: 'white', role: 'knight' }, label: 'N', symbol: '♘' },
    { item: { color: 'white', role: 'pawn' }, label: 'P', symbol: '♙' },
    { item: { color: 'black', role: 'king' }, label: 'k', symbol: '♚' },
    { item: { color: 'black', role: 'queen' }, label: 'q', symbol: '♛' },
    { item: { color: 'black', role: 'rook' }, label: 'r', symbol: '♜' },
    { item: { color: 'black', role: 'bishop' }, label: 'b', symbol: '♝' },
    { item: { color: 'black', role: 'knight' }, label: 'n', symbol: '♞' },
    { item: { color: 'black', role: 'pawn' }, label: 'p', symbol: '♟' },
  ];

  const isPaletteActive = (item: PaletteItem) => {
    if (!selectedPalette) return false;
    if (item === 'eraser') return selectedPalette === 'eraser';
    if (selectedPalette === 'eraser') return false;
    return (
      (selectedPalette as { color: Color; role: Role }).color === (item as { color: Color; role: Role }).color &&
      (selectedPalette as { color: Color; role: Role }).role === (item as { color: Color; role: Role }).role
    );
  };

  const handlePaletteClick = (item: PaletteItem) => {
    setSelectedPalette((prev) => {
      if (item === 'eraser') return prev === 'eraser' ? null : 'eraser';
      if (prev && prev !== 'eraser') {
        const p = prev as { color: Color; role: Role };
        const i = item as { color: Color; role: Role };
        if (p.color === i.color && p.role === i.role) return null;
      }
      return item;
    });
  };

  // Validation
  const currentPlacement = piecesToFen(pieces);
  const validation = validatePosition(currentPlacement);

  return (
    <div className="board-editor">
      <div className="board-editor-layout">
        <div className="board-editor-board" ref={boardRef} />
        <div className="board-editor-controls">
          <div className="palette-section">
            <div className="palette-row">
              {paletteItems.slice(0, 6).map((p) => (
                <button
                  type="button"
                  key={p.label}
                  className={`palette-btn ${isPaletteActive(p.item) ? 'active' : ''}`}
                  onClick={() => handlePaletteClick(p.item)}
                  title={p.label}
                >
                  {p.symbol}
                </button>
              ))}
            </div>
            <div className="palette-row">
              {paletteItems.slice(6).map((p) => (
                <button
                  type="button"
                  key={p.label}
                  className={`palette-btn ${isPaletteActive(p.item) ? 'active' : ''}`}
                  onClick={() => handlePaletteClick(p.item)}
                  title={p.label}
                >
                  {p.symbol}
                </button>
              ))}
            </div>
            <div className="palette-row">
              <button
                type="button"
                className={`palette-btn eraser-btn ${selectedPalette === 'eraser' ? 'active' : ''}`}
                onClick={() => handlePaletteClick('eraser')}
                title={t('editor.eraser')}
              >
                🗑️
              </button>
            </div>
          </div>

          <div className="editor-option">
            <label>{t('editor.sideToMove', 'Side to move')}</label>
            <div className="side-toggle">
              <button
                type="button"
                className={sideToMove === 'w' ? 'active' : ''}
                onClick={() => handleSideChange('w')}
              >
                {t('editor.white', 'White')}
              </button>
              <button
                type="button"
                className={sideToMove === 'b' ? 'active' : ''}
                onClick={() => handleSideChange('b')}
              >
                {t('editor.black', 'Black')}
              </button>
            </div>
          </div>

          <div className="editor-option">
            <label>{t('editor.castling', 'Castling')}</label>
            <div className="castling-checks">
              {(['K', 'Q', 'k', 'q'] as const).map((c) => (
                <label key={c} className="castling-label">
                  <input
                    type="checkbox"
                    checked={castling[c]}
                    onChange={(e) => handleCastlingChange(c, e.target.checked)}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className="editor-presets">
            <button type="button" onClick={handleStartingPos}>
              {t('editor.startingPosition', 'Starting position')}
            </button>
            <button type="button" onClick={handleClear}>
              {t('editor.clearBoard', 'Clear board')}
            </button>
            <button type="button" onClick={() => setShowFenInput(!showFenInput)}>
              {t('editor.fromFen', 'From FEN...')}
            </button>
          </div>

          {showFenInput && (
            <div className="fen-input-row">
              <input
                type="text"
                value={fenInput}
                onChange={(e) => {
                  setFenInput(e.target.value);
                  setFenError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFenSubmit();
                }}
                placeholder={t('editor.fenPlaceholder', 'Paste FEN string...')}
                autoFocus
              />
              <button type="button" onClick={handleFenSubmit}>
                OK
              </button>
            </div>
          )}
          {fenError && <div className="editor-error">{fenError}</div>}
        </div>
      </div>

      <div className="editor-fen-display">
        <code>{buildFen(pieces, sideToMove, castling)}</code>
      </div>
      {!validation.valid && <div className="editor-error">{t(validation.error!)}</div>}
      {validation.valid && <div className="editor-valid">✓ {t('editor.validPosition', 'Valid position')}</div>}
    </div>
  );
}
