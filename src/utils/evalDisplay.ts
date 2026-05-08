/**
 * Resolves the eval string to display on the board.
 * Always returns the stored eval from PGN. When the engine is on,
 * evals are auto-saved to PGN on completion, so storedEval is
 * always up-to-date after re-parse — no need for live engineEval.
 */
export function resolveEvalDisplay(
  _engineEnabled: boolean,
  _engineEval: string | undefined,
  storedEval: string | undefined,
): string | undefined {
  return storedEval;
}
