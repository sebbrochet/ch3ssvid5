export interface ParsedMove {
  /** Index in the flat move array (0-based) */
  index: number;
  /** Move number (1-based, e.g., 1, 2, 3...) */
  moveNumber: number;
  /** Which color played this move */
  color: 'w' | 'b';
  /** Standard Algebraic Notation (e.g., "e4", "Nf3") */
  san: string;
  /** FEN string representing the position AFTER this move */
  fen: string;
  /** Source square (e.g., "e2") */
  from?: string;
  /** Destination square (e.g., "e4") */
  to?: string;
  /** Timestamp in seconds into the video, extracted from [%ts M:SS] */
  timestamp?: number;
  /** Comment text (without the timestamp annotation) */
  comment?: string;
}

export interface DrawShape {
  /** Color: 'green' | 'red' | 'blue' | 'yellow' */
  brush: string;
  /** Origin square (e.g., "e2") */
  orig: string;
  /** Destination square (e.g., "e4") — omit for square highlight */
  dest?: string;
}

/**
 * A node in the move tree. Represents a single half-move (ply) with
 * optional variations branching off after this move.
 */
export interface MoveNode {
  /** Unique path-based ID, e.g. "0", "0/1", "0/1/v0/0" */
  id: string;
  /** Move number (1-based) */
  moveNumber: number;
  /** Which color played this move */
  color: 'w' | 'b';
  /** Standard Algebraic Notation */
  san: string;
  /** FEN BEFORE this move was played (parent position) */
  fenBefore: string;
  /** FEN AFTER this move was played */
  fen: string;
  /** Source square */
  from: string;
  /** Destination square */
  to: string;
  /** Timestamp in seconds */
  timestamp?: number;
  /** Comment text (without timestamp/annotation markup) */
  comment?: string;
  /** NAG symbols ($1, !, ?, etc.) */
  nags?: string[];
  /** Position evaluation from [%eval] (centipawns as float, e.g. 0.54, -1.3, or "#5" for mate) */
  eval?: string;
  /** Arrow annotations [%cal] */
  arrows?: DrawShape[];
  /** Square highlight annotations [%csl] */
  highlights?: DrawShape[];
  /** Next move in this line (continuation) */
  next: MoveNode | null;
  /** Alternative continuations from the PARENT position (sibling variations) */
  variations: MoveNode[];
}

export interface GameData {
  /** PGN header tags */
  headers: Record<string, string>;
  /** Flat list of main line moves with computed FENs and timestamps */
  moves: ParsedMove[];
  /** Tree of all moves including variations */
  moveTree: MoveNode | null;
  /** Starting FEN (from headers or default) */
  startFen: string;
  /** YouTube video ID extracted from VideoURL header */
  videoId?: string;
  /** Variant name from [Variant] header (e.g., "Chess960", "KingOfTheHill", "ThreeCheck", "Antichess") */
  variant?: string;
}

export interface SyncState {
  /** Current move index (-1 = starting position) */
  currentMoveIndex: number;
  /** Current board FEN */
  fen: string;
  /** Whether the video is currently playing */
  isPlaying: boolean;
}

export interface StoredGame {
  id: string;
  name: string;
  pgn: string;
  videoId?: string;
  /** Folder path, e.g. "/" or "/Kasparov" or "/Openings/Sicilian" */
  folder: string;
  timestamps: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}
