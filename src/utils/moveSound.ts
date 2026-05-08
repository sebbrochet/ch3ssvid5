/**
 * Move sound effects.
 * Determines the correct sound (move vs capture) from SAN notation and plays it.
 */

const BASE = import.meta.env.BASE_URL || '/';
let moveAudio: HTMLAudioElement | null = null;
let captureAudio: HTMLAudioElement | null = null;

function ensureAudio() {
  if (!moveAudio) {
    moveAudio = new Audio(`${BASE}sounds/move.mp3`);
    captureAudio = new Audio(`${BASE}sounds/capture.mp3`);
  }
}

/** Play the appropriate sound for a move based on its SAN notation. */
export function playMoveSound(san: string): void {
  ensureAudio();
  const isCapture = san.includes('x');
  const audio = isCapture ? captureAudio! : moveAudio!;
  audio.currentTime = 0;
  audio.play().catch(() => {
    /* ignore autoplay restrictions */
  });
}
