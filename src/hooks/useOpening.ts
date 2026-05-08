import { useState, useEffect } from 'react';
import type { OpeningInfo } from '../utils/openingLookup';
import { loadOpenings, lookupOpening, isOpeningsLoaded } from '../utils/openingLookup';

/**
 * Returns the opening info for the given FEN, or null if out of book / loading / variant game.
 * Triggers lazy-loading of the opening database on first render.
 */
export function useOpening(fen: string | null, variant?: string): OpeningInfo | null {
  const [loaded, setLoaded] = useState(isOpeningsLoaded());

  // Skip for non-standard variants — ECO doesn't apply
  const isStandard = !variant || variant.toLowerCase() === 'chess960';
  // Chess960 games that start from standard position are fine for ECO lookup,
  // but in practice most Chess960 games have non-standard starts, so skip them too
  const shouldLookup = isStandard && !variant;

  useEffect(() => {
    if (!shouldLookup || loaded) return;
    loadOpenings().then(() => setLoaded(true));
  }, [shouldLookup, loaded]);

  if (!shouldLookup || !fen || !loaded) return null;
  return lookupOpening(fen);
}
