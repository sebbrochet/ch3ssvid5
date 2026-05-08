import { useEffect, useState } from 'react';
import './MoveOverlay.css';

function squareToPosition(square: string, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1]) - 1;
  const x = orientation === 'white' ? file : 7 - file;
  const y = orientation === 'white' ? 7 - rank : rank;
  return { left: `${x * 12.5}%`, top: `${y * 12.5}%` };
}

function detectMoveType(san: string): 'quiet' | 'capture' | 'check' | 'checkmate' | 'castling' {
  if (san === 'O-O' || san === 'O-O-O') return 'castling';
  if (san.includes('#')) return 'checkmate';
  if (san.includes('+')) return 'check';
  if (san.includes('x')) return 'capture';
  return 'quiet';
}

interface MoveOverlayProps {
  san?: string;
  square?: string;
  orientation: 'white' | 'black';
  trigger: number;
  reverse?: boolean;
}

export function MoveOverlay({ san, square, orientation, trigger, reverse }: MoveOverlayProps) {
  const [animKey, setAnimKey] = useState(0);

  // Re-trigger animation when trigger changes
  useEffect(() => {
    if (trigger > 0) {
      setAnimKey((k) => k + 1);
    }
  }, [trigger]);

  if (!san || !square) return null;

  const moveType = detectMoveType(san);
  const pos = squareToPosition(square, orientation);

  return (
    <div key={animKey} className={`move-overlay ${reverse ? 'reverse' : ''}`} style={{ left: pos.left, top: pos.top }}>
      <div className={`move-pulse ${moveType}`} />
      <span className={`move-san ${moveType}`}>{san}</span>
    </div>
  );
}
