import { useMemo } from 'react';
import './SquareLabels.css';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

interface Props {
  orientation: 'white' | 'black';
  fen: string;
}

/** Parse FEN piece placement to a set of occupied square names */
function getOccupiedSquares(fen: string): Set<string> {
  const placement = fen.split(' ')[0];
  const occupied = new Set<string>();
  const rows = placement.split('/');
  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        col += parseInt(ch);
      } else {
        const square = FILES[col] + RANKS[r];
        occupied.add(square);
        col++;
      }
    }
  }
  return occupied;
}

export function SquareLabels({ orientation, fen }: Props) {
  const squares = useMemo(() => {
    const occupied = getOccupiedSquares(fen);
    const files = orientation === 'white' ? FILES : [...FILES].reverse();
    const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();
    const result: { coord: string; isDark: boolean; empty: boolean }[] = [];
    for (const rank of ranks) {
      for (const file of files) {
        const fileIdx = file.charCodeAt(0) - 'a'.charCodeAt(0);
        const rankIdx = parseInt(rank) - 1;
        const isDark = (fileIdx + rankIdx) % 2 === 0;
        result.push({ coord: `${file}${rank}`, isDark, empty: !occupied.has(`${file}${rank}`) });
      }
    }
    return result;
  }, [orientation, fen]);

  return (
    <div className="square-labels-overlay">
      {squares.map((sq) => (
        <span key={sq.coord} className={`square-label ${sq.isDark ? 'dark-sq' : 'light-sq'}`}>
          {sq.empty ? sq.coord : ''}
        </span>
      ))}
    </div>
  );
}
