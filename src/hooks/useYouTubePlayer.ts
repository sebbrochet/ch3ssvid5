/// <reference types="youtube" />
import { useEffect, useRef, useCallback, useState } from 'react';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiLoading = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (apiLoaded) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (apiLoading) return;
    apiLoading = true;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiReadyCallbacks.forEach((cb) => cb());
      apiReadyCallbacks.length = 0;
    };
  });
}

export interface UseYouTubePlayerOptions {
  videoId: string;
  onTimeUpdate?: (time: number) => void;
  onStateChange?: (state: number) => void;
}

export function useYouTubePlayer({ videoId, onTimeUpdate, onStateChange }: UseYouTubePlayerOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onStateChangeRef = useRef(onStateChange);
  const [isReady, setIsReady] = useState(false);

  // Keep refs up to date
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onStateChangeRef.current = onStateChange;
  });

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = window.setInterval(() => {
      if (playerRef.current && onTimeUpdateRef.current) {
        try {
          const time = playerRef.current.getCurrentTime();
          onTimeUpdateRef.current(time);
        } catch {
          // Player might not be ready
        }
      }
    }, 200);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Initialize player
  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !containerRef.current) return;

      // Clear container
      containerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (!destroyed) setIsReady(true);
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (destroyed) return;
            onStateChangeRef.current?.(event.data);
            if (event.data === window.YT.PlayerState.PLAYING) {
              startPolling();
            } else {
              stopPolling();
              // Send one final time update when paused
              if (playerRef.current && onTimeUpdateRef.current) {
                try {
                  onTimeUpdateRef.current(playerRef.current.getCurrentTime());
                } catch {
                  /* ignore */
                }
              }
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      stopPolling();
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
      }
      setIsReady(false);
    };
  }, [videoId, startPolling, stopPolling]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (playerRef.current && isReady) {
        playerRef.current.seekTo(seconds, true);
      }
    },
    [isReady],
  );

  const play = useCallback(() => {
    if (playerRef.current && isReady) {
      playerRef.current.playVideo();
    }
  }, [isReady]);

  const pause = useCallback(() => {
    if (playerRef.current && isReady) {
      playerRef.current.pauseVideo();
    }
  }, [isReady]);

  const getCurrentTime = useCallback((): number => {
    if (playerRef.current && isReady) {
      try {
        return playerRef.current.getCurrentTime();
      } catch {
        return 0;
      }
    }
    return 0;
  }, [isReady]);

  return { containerRef, seekTo, play, pause, getCurrentTime, isReady };
}
