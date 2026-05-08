import { useTranslation } from 'react-i18next';
import type { Playlist } from '../hooks/usePlaylist';
import './NowPlayingBar.css';

interface Props {
  playlist: Playlist;
  currentIndex: number;
  totalGames: number;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  canPrev: boolean;
  canNext: boolean;
  autoAdvanceCountdown: number | null;
  onCancelAutoAdvance: () => void;
}

export function NowPlayingBar({
  playlist,
  currentIndex,
  totalGames,
  onPrev,
  onNext,
  onExit,
  canPrev,
  canNext,
  autoAdvanceCountdown,
  onCancelAutoAdvance,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="now-playing-bar">
      <span className="now-playing-icon">🎬</span>
      <span className="now-playing-name">{playlist.name}</span>
      <span className="now-playing-position">
        {currentIndex + 1}/{totalGames}
      </span>
      {autoAdvanceCountdown !== null && (
        <span className="now-playing-auto-advance">
          {t('playlist.autoAdvance', { count: autoAdvanceCountdown })}
          <button
            className="now-playing-btn cancel-auto-advance"
            onClick={onCancelAutoAdvance}
            title={t('playlist.cancelAutoAdvance', 'Cancel')}
          >
            ✕
          </button>
        </span>
      )}
      <div className="now-playing-controls">
        <button
          className="now-playing-btn"
          onClick={onPrev}
          disabled={!canPrev}
          title={t('playlist.prevGame', 'Previous game')}
        >
          ⏮
        </button>
        <button
          className="now-playing-btn"
          onClick={onNext}
          disabled={!canNext}
          title={t('playlist.nextGame', 'Next game')}
        >
          ⏭
        </button>
        <button className="now-playing-btn exit" onClick={onExit} title={t('playlist.exit', 'Exit playlist')}>
          ✕
        </button>
      </div>
    </div>
  );
}
