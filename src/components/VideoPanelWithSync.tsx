import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

interface VideoPanelWithSyncProps {
  videoId: string;
  onTimeUpdate: (time: number) => void;
  seekToRef: React.MutableRefObject<((seconds: number) => void) | null>;
  getCurrentTimeRef: React.MutableRefObject<(() => number) | null>;
  playRef: React.MutableRefObject<(() => void) | null>;
  pauseRef: React.MutableRefObject<(() => void) | null>;
  onPlayingChange: (playing: boolean) => void;
}

/** Wrapper that exposes seekTo and getCurrentTime via ref callbacks */
export function VideoPanelWithSync({
  videoId,
  onTimeUpdate,
  seekToRef,
  getCurrentTimeRef,
  playRef,
  pauseRef,
  onPlayingChange,
}: VideoPanelWithSyncProps) {
  const { containerRef, seekTo, play, pause, getCurrentTime, isReady } = useYouTubePlayer({
    videoId,
    onTimeUpdate,
    onStateChange: (state) => {
      onPlayingChange(state === 1); // YT.PlayerState.PLAYING === 1
    },
  });
  const { t } = useTranslation();

  // Expose seekTo, getCurrentTime, play, pause to parent
  useEffect(() => {
    seekToRef.current = seekTo;
    getCurrentTimeRef.current = getCurrentTime;
    playRef.current = play;
    pauseRef.current = pause;
    return () => {
      seekToRef.current = null;
      getCurrentTimeRef.current = null;
      playRef.current = null;
      pauseRef.current = null;
    };
  }, [seekTo, getCurrentTime, play, pause, seekToRef, getCurrentTimeRef, playRef, pauseRef]);

  return (
    <div className="video-panel">
      <div ref={containerRef} className="video-container" />
      {!isReady && <div className="video-loading">{t('video.loading')}</div>}
    </div>
  );
}
