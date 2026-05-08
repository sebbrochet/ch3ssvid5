/**
 * Build script: download Lichess ECO TSV files, replay moves via chessops,
 * and generate public/openings.json as a FEN→{eco,name} lookup table.
 *
 * Usage: npx tsx scripts/build-openings.ts
 */
import { parseFen, makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import { setupPosition } from 'chessops/variant';
import * as fs from 'fs';
import * as path from 'path';

const TSV_BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const FILES = ['a', 'b', 'c', 'd', 'e'];
const OUTPUT = path.join(import.meta.dirname, '..', 'public', 'openings.json');

interface OpeningEntry {
  eco: string;
  name: string;
  plyCount: number;
}

/** Strip halfmove clock and fullmove number from FEN (keep first 4 fields). */
function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Replay a SAN move sequence and return the resulting normalized FEN. */
function replayMoves(moves: string): string | null {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const setup = parseFen(startFen).unwrap();
  const pos = setupPosition('chess', setup).unwrap();

  const tokens = moves.trim().split(/\s+/);
  for (const token of tokens) {
    // Skip move numbers like "1." or "1..."
    if (/^\d+\./.test(token)) continue;

    const move = parseSan(pos, token);
    if (!move) {
      console.warn(`  Failed to parse move "${token}" in sequence: ${moves}`);
      return null;
    }
    pos.play(move);
  }

  return normalizeFen(makeFen(pos.toSetup()));
}

async function main() {
  const fenMap = new Map<string, OpeningEntry>();

  for (const file of FILES) {
    const url = `${TSV_BASE}/${file}.tsv`;
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const text = await response.text();

    const lines = text.trim().split('\n');
    let parsed = 0;
    let skipped = 0;

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const [eco, name, moves] = parts;
      // Skip TSV header row
      if (eco === 'eco') continue;
      const plyCount = moves
        .trim()
        .split(/\s+/)
        .filter((t) => !/^\d+\./.test(t)).length;

      const fen = replayMoves(moves);
      if (!fen) {
        skipped++;
        continue;
      }

      const existing = fenMap.get(fen);
      // Keep the entry with the most moves (most specific name)
      if (!existing || plyCount > existing.plyCount) {
        fenMap.set(fen, { eco, name, plyCount });
      }
      parsed++;
    }

    console.log(`  ${file}.tsv: ${parsed} entries parsed, ${skipped} skipped`);
  }

  // Build output: { [fen]: { eco, name } }
  const output: Record<string, { eco: string; name: string }> = {};
  for (const [fen, entry] of fenMap) {
    output[fen] = { eco: entry.eco, name: entry.name };
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(output), 'utf-8');
  const sizeKB = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
  console.log(`\nWritten ${fenMap.size} openings to ${OUTPUT} (${sizeKB} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
