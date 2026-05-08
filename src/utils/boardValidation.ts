export interface ValidationResult {
  valid: boolean;
  error?: string; // i18n key
}

/**
 * Validate a board position given as a FEN piece-placement string (first field of FEN).
 * Returns { valid: true } or { valid: false, error: '<i18n key>' }.
 */
export function validatePosition(piecePlacement: string): ValidationResult {
  let whiteKings = 0;
  let blackKings = 0;
  let pawnOnEdge = false;

  const ranks = piecePlacement.split('/');
  for (let rankIdx = 0; rankIdx < ranks.length; rankIdx++) {
    const rank = ranks[rankIdx];
    const isEdge = rankIdx === 0 || rankIdx === 7; // rank 8 or rank 1
    for (const ch of rank) {
      if (ch >= '1' && ch <= '8') continue;
      if (ch === 'K') whiteKings++;
      if (ch === 'k') blackKings++;
      if (isEdge && (ch === 'P' || ch === 'p')) pawnOnEdge = true;
    }
  }

  if (whiteKings === 0) return { valid: false, error: 'editor.noWhiteKing' };
  if (whiteKings > 1) return { valid: false, error: 'editor.multipleWhiteKings' };
  if (blackKings === 0) return { valid: false, error: 'editor.noBlackKing' };
  if (blackKings > 1) return { valid: false, error: 'editor.multipleBlackKings' };
  if (pawnOnEdge) return { valid: false, error: 'editor.pawnsOnEdge' };

  return { valid: true };
}
