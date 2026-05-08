/**
 * Opening lookup: lazy-loads the ECO database and provides FEN → opening info lookup.
 */

export interface OpeningInfo {
  eco: string;
  name: string;
}

let openingsMap: Map<string, OpeningInfo> | null = null;
let loadingPromise: Promise<Map<string, OpeningInfo>> | null = null;

/** Strip halfmove clock and fullmove number from FEN (keep first 4 fields). */
export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/** Lazy-load the opening database. Returns the cached map on subsequent calls. */
export async function loadOpenings(): Promise<Map<string, OpeningInfo>> {
  if (openingsMap) return openingsMap;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const base = import.meta.env.BASE_URL;
    const resp = await fetch(`${base}openings.json`);
    const data: Record<string, { eco: string; name: string }> = await resp.json();
    const map = new Map<string, OpeningInfo>();
    for (const [fen, info] of Object.entries(data)) {
      map.set(fen, info);
    }
    openingsMap = map;
    loadingPromise = null;
    return map;
  })();

  return loadingPromise;
}

/** Synchronous lookup — returns null if database not loaded yet or FEN not found. */
export function lookupOpening(fen: string): OpeningInfo | null {
  if (!openingsMap) return null;
  return openingsMap.get(normalizeFen(fen)) ?? null;
}

/** Whether the database has been loaded. */
export function isOpeningsLoaded(): boolean {
  return openingsMap !== null;
}

/** Find the deepest opening match along a sequence of FENs. */
export function findDeepestOpening(fens: string[]): OpeningInfo | null {
  if (!openingsMap) return null;
  let deepest: OpeningInfo | null = null;
  for (const fen of fens) {
    const info = openingsMap.get(normalizeFen(fen));
    if (info) deepest = info;
  }
  return deepest;
}
