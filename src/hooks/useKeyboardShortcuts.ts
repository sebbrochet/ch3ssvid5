import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  goToStart: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  goToLast: () => void;
  toggleEngine: () => void;
  togglePlayPause: () => void;
}

/**
 * Keyboard shortcuts for the app.
 * Returns refs for deferred handlers (capture, flip, playlist nav) that are defined
 * after this hook but need to be callable from keyboard events.
 */
export function useKeyboardShortcuts({
  goToStart,
  goToPrev,
  goToNext,
  goToLast,
  toggleEngine,
  togglePlayPause,
}: UseKeyboardShortcutsOptions) {
  const handleCaptureRef = useRef<() => void>(() => {});
  const handleFlipRef = useRef<() => void>(() => {});
  const playlistNextRef = useRef<(() => void) | undefined>(undefined);
  const playlistPrevRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'Home':
          e.preventDefault();
          goToStart();
          break;
        case 'End':
          e.preventDefault();
          goToLast();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey && playlistPrevRef.current) playlistPrevRef.current();
          else goToStart();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey && playlistNextRef.current) playlistNextRef.current();
          else goToLast();
          break;
        case 'c':
          e.preventDefault();
          handleCaptureRef.current();
          break;
        case 'f':
          e.preventDefault();
          handleFlipRef.current();
          break;
        case 'e':
          e.preventDefault();
          toggleEngine();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToStart, goToPrev, goToNext, goToLast, toggleEngine, togglePlayPause]);

  return { handleCaptureRef, handleFlipRef, playlistNextRef, playlistPrevRef };
}
