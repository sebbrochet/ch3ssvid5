/**
 * Chess960 (Fischer Random) position utilities.
 * Implements the Scharnagl numbering (positions 0–959, displayed as 1–960).
 */

/**
 * Decode a Chess960 position number (0-indexed) into the back rank piece array.
 * Uses the standard Scharnagl algorithm.
 * @param idx 0-based position index (0–959)
 * @returns Array of 8 piece letters: 'R','N','B','Q','K' etc.
 */
function decodeBackRank(idx: number): string[] {
  const rank = new Array<string>(8).fill('');

  // Step 1: Place dark-squared bishop
  // n2 = idx % 4 → bishop goes on dark square (index n2*2 + 1 → squares b,d,f,h = 1,3,5,7)
  const n2 = idx % 4;
  idx = Math.floor(idx / 4);
  rank[n2 * 2 + 1] = 'B';

  // Step 2: Place light-squared bishop
  // n1 = idx % 4 → bishop goes on light square (index n1*2 → squares a,c,e,g = 0,2,4,6)
  const n1 = idx % 4;
  idx = Math.floor(idx / 4);
  rank[n1 * 2] = 'B';

  // Step 3: Place queen in one of 6 remaining empty squares
  const q = idx % 6;
  idx = Math.floor(idx / 6);
  let emptyCount = 0;
  for (let i = 0; i < 8; i++) {
    if (rank[i] === '') {
      if (emptyCount === q) {
        rank[i] = 'Q';
        break;
      }
      emptyCount++;
    }
  }

  // Step 4: Place two knights using the "N2N" lookup table
  // There are 5 remaining squares, choose 2 for knights = C(5,2) = 10 combinations
  const knightTable = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ];
  const knightIdx = idx; // 0–9
  const [kn1, kn2] = knightTable[knightIdx];
  const emptySquares: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (rank[i] === '') emptySquares.push(i);
  }
  rank[emptySquares[kn1]] = 'N';
  rank[emptySquares[kn2]] = 'N';

  // Step 5: Place R, K, R in the 3 remaining squares (king between rooks)
  const remaining: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (rank[i] === '') remaining.push(i);
  }
  // remaining has exactly 3 entries: rook, king, rook
  rank[remaining[0]] = 'R';
  rank[remaining[1]] = 'K';
  rank[remaining[2]] = 'R';

  return rank;
}

/**
 * Encode a back rank piece array into a Chess960 position number (0-indexed).
 * Reverse of decodeBackRank.
 * @param rank Array of 8 uppercase piece letters
 * @returns 0-based position index (0–959), or -1 if invalid
 */
function encodeBackRank(rank: string[]): number {
  if (rank.length !== 8) return -1;

  // Find bishop positions
  let darkBishop = -1;
  let lightBishop = -1;
  for (let i = 0; i < 8; i++) {
    if (rank[i] === 'B') {
      if (i % 2 === 1) darkBishop = i;
      else lightBishop = i;
    }
  }
  if (darkBishop === -1 || lightBishop === -1) return -1;

  const b1 = (darkBishop - 1) / 2; // 0–3
  const b2 = lightBishop / 2; // 0–3

  // Find queen position among remaining squares
  const remaining1: number[] = [];
  for (let i = 0; i < 8; i++) {
    if (i !== darkBishop && i !== lightBishop) remaining1.push(i);
  }
  const queenPos = remaining1.findIndex((i) => rank[i] === 'Q');
  if (queenPos === -1) return -1;

  // Find knight positions among remaining squares (after removing queen)
  const remaining2 = remaining1.filter((i) => rank[i] !== 'Q');
  const knightPositions: number[] = [];
  for (let i = 0; i < remaining2.length; i++) {
    if (rank[remaining2[i]] === 'N') knightPositions.push(i);
  }
  if (knightPositions.length !== 2) return -1;

  // Find knight table index
  const knightTable = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 3],
    [2, 4],
    [3, 4],
  ];
  const n = knightTable.findIndex(([a, b]) => a === knightPositions[0] && b === knightPositions[1]);
  if (n === -1) return -1;

  return b1 + 4 * b2 + 16 * queenPos + 96 * n;
}

/**
 * Generate a Chess960 starting FEN from position number (0–959).
 * Position 518 = standard chess starting position.
 * @param num 0-based position number (0–959)
 * @returns Full FEN string, or null if number is out of range
 */
export function chess960NumberToFen(num: number): string | null {
  if (num < 0 || num > 959 || !Number.isInteger(num)) return null;
  const rank = decodeBackRank(num);
  const blackRank = rank.map((p) => p.toLowerCase()).join('');
  const whiteRank = rank.join('');

  // Chess960 castling: use standard KQkq notation (chessops/Lichess convention)
  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w KQkq - 0 1`;
}

/**
 * Identify the Chess960 position number (0–959) from a FEN string.
 * @returns 0-based position number, or null if not a valid Chess960 position
 */
export function fenToChess960Number(fen: string): number | null {
  const placement = fen.split(' ')[0];
  if (!placement) return null;
  const ranks = placement.split('/');
  if (ranks.length !== 8) return null;

  // Extract white back rank (rank 1 = last in FEN)
  const whiteRank = ranks[7].split('');
  if (whiteRank.length !== 8) return null;
  // Verify it's all uppercase pieces
  if (!whiteRank.every((c) => 'RNBQK'.includes(c))) return null;

  // Verify black back rank mirrors white
  const blackRank = ranks[0].split('');
  if (blackRank.length !== 8) return null;
  const expectedBlack = whiteRank.map((p) => p.toLowerCase());
  if (!blackRank.every((c, i) => c === expectedBlack[i])) return null;

  // Verify pawns on ranks 2 and 7
  if (ranks[1] !== 'pppppppp' || ranks[6] !== 'PPPPPPPP') return null;

  // Verify ranks 3–6 are empty
  for (let i = 2; i <= 5; i++) {
    if (ranks[i] !== '8') return null;
  }

  const idx = encodeBackRank(whiteRank);
  if (idx < 0 || idx > 959) return null;
  return idx;
}

/**
 * Generate a random Chess960 position number (0–959).
 */
export function randomChess960Number(): number {
  return Math.floor(Math.random() * 960);
}
