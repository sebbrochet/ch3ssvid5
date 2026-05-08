import { useEffect, useRef, useCallback, useState } from 'react';

export interface EngineInfo {
  /** Evaluation in centipawns (positive = white advantage) or mate string like "#5" */
  eval: string;
  /** Best move in UCI format (e.g., "e2e4") */
  bestMove?: string;
  /** Principal variation (best line) in UCI format */
  pv?: string[];
  /** Search depth reached */
  depth: number;
  /** Whether the engine is currently thinking */
  isThinking: boolean;
  /** FEN of the position being analyzed */
  analyzedFen: string;
}

const INITIAL_INFO: EngineInfo = {
  eval: '0.0',
  depth: 0,
  isThinking: false,
  analyzedFen: '',
};

/**
 * Parse UCI info line from Stockfish output.
 * Stockfish reports scores from the side-to-move's perspective.
 * We normalize to always be from White's perspective.
 */
export function parseInfoLine(line: string, isBlackToMove: boolean): Partial<EngineInfo> | null {
  if (!line.startsWith('info ') || !line.includes('score ')) return null;
  // Skip non-primary multipv lines
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  if (multipvMatch && parseInt(multipvMatch[1]) > 1) return null;
  // Skip aspiration window bound lines — eval is not yet settled
  if (line.includes(' upperbound') || line.includes(' lowerbound')) return null;

  const result: Partial<EngineInfo> = {};

  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  if (depthMatch) result.depth = parseInt(depthMatch[1]);

  const cpMatch = line.match(/\bscore cp\s+(-?\d+)/);
  if (cpMatch) {
    const cp = parseInt(cpMatch[1]) * (isBlackToMove ? -1 : 1);
    result.eval = (cp / 100).toFixed(2);
  }

  const mateMatch = line.match(/\bscore mate\s+(-?\d+)/);
  if (mateMatch) {
    const mate = parseInt(mateMatch[1]) * (isBlackToMove ? -1 : 1);
    result.eval = `#${mate}`;
  }

  const pvMatch = line.match(/\bpv\s+(.+)$/);
  if (pvMatch) {
    result.pv = pvMatch[1].trim().split(/\s+/);
  }

  return result;
}

export function useStockfish(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const [info, setInfo] = useState<EngineInfo>(INITIAL_INFO);
  const [isReady, setIsReady] = useState(false);
  const currentFenRef = useRef<string | null>(null);
  const pendingAnalysisRef = useRef<{ fen: string; depth: number; chess960: boolean } | null>(null);
  const waitingForReadyRef = useRef(false);

  // Initialize worker
  useEffect(() => {
    if (!enabled) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        setIsReady(false);
        setInfo(INITIAL_INFO);
        currentFenRef.current = null;
      }
      return;
    }

    // Use the lite single-threaded engine (no CORS headers needed, ~7MB)
    const base = import.meta.env.BASE_URL || '/';
    const workerUrl = `${base}stockfish/stockfish-18-lite-single.js`;

    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === 'string' ? e.data : e.data?.toString?.() || '';

      if (line === 'uciok') {
        // Configure engine
        worker.postMessage('setoption name UCI_AnalyseMode value true');
        worker.postMessage('isready');
        return;
      }

      if (line === 'readyok') {
        setIsReady(true);
        waitingForReadyRef.current = false;

        // If a pending analysis was queued while waiting for readyok, start it now
        if (pendingAnalysisRef.current && workerRef.current) {
          const { fen, depth, chess960 } = pendingAnalysisRef.current;
          pendingAnalysisRef.current = null;
          workerRef.current.postMessage(`setoption name UCI_Chess960 value ${chess960 ? 'true' : 'false'}`);
          workerRef.current.postMessage(`position fen ${fen}`);
          workerRef.current.postMessage(`go depth ${depth}`);
        }
        return;
      }

      // Parse info lines
      if (line.startsWith('info ')) {
        // Ignore info from a stopped analysis while waiting for readyok
        if (waitingForReadyRef.current) return;
        const isBlack = currentFenRef.current?.split(' ')[1] === 'b';
        const parsed = parseInfoLine(line, isBlack);
        if (parsed) {
          setInfo((prev) => ({
            ...prev,
            ...parsed,
            isThinking: true,
          }));
        }
        return;
      }

      // Best move found
      if (line.startsWith('bestmove ')) {
        // Ignore bestmove from a stopped analysis while waiting for readyok
        if (waitingForReadyRef.current) return;
        const parts = line.split(/\s+/);
        setInfo((prev) => ({
          ...prev,
          bestMove: parts[1],
          isThinking: false,
        }));
      }
    };

    // Start UCI protocol
    worker.postMessage('uci');

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
      currentFenRef.current = null;
    };
  }, [enabled]);

  /** Start analyzing a position */
  const analyze = useCallback(
    (fen: string, depth: number = 18, chess960?: boolean) => {
      if (!workerRef.current || !isReady) return;

      // Don't re-analyze the same position
      if (currentFenRef.current === fen) return;
      currentFenRef.current = fen;

      // Reset info for new position
      setInfo((prev) => ({
        ...prev,
        depth: 0,
        isThinking: true,
        bestMove: undefined,
        pv: undefined,
        analyzedFen: fen,
      }));

      const pending = { fen, depth, chess960: !!chess960 };

      if (waitingForReadyRef.current) {
        // Already waiting for a previous stop to complete — just update the pending request
        pendingAnalysisRef.current = pending;
        return;
      }

      // Stop any ongoing analysis and wait for readyok before sending new commands
      workerRef.current.postMessage('stop');
      waitingForReadyRef.current = true;
      pendingAnalysisRef.current = pending;
      workerRef.current.postMessage('isready');
    },
    [isReady],
  );

  /** Stop current analysis */
  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
      currentFenRef.current = null;
    }
  }, []);

  /** Force re-analysis of current position (e.g., after depth change) */
  const reanalyze = useCallback(
    (fen: string, depth: number = 18) => {
      currentFenRef.current = null; // Clear cache
      analyze(fen, depth);
    },
    [analyze],
  );

  return { info, isReady, analyze, stop, reanalyze };
}
