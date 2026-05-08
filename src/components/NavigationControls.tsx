import { formatTimestamp } from '../utils/moveTree';
import { useTranslation } from 'react-i18next';
import type { EngineInfo } from '../hooks/useStockfish';
import './NavigationControls.css';

interface Props {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  canPrev: boolean;
  canNext: boolean;
  isSynced: boolean;
  onToggleSync: () => void;
  onCaptureTimestamp: () => void;
  onUndoTimestamp: () => void;
  canCapture: boolean;
  canUndo: boolean;
  canSync: boolean;
  currentMoveTimestamp?: number;
  onFlipBoard: () => void;
  orientation: 'white' | 'black';
  engineEnabled: boolean;
  onToggleEngine: () => void;
  engineOverwrite: boolean;
  onToggleOverwrite: () => void;
  engineDepth: number;
  engineInfo?: EngineInfo;
  isVideoPlaying?: boolean;
  onPlayPause?: () => void;
  hasVideo?: boolean;
  isMobile?: boolean;
}

export function NavigationControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  canPrev,
  canNext,
  isSynced,
  onToggleSync,
  onCaptureTimestamp,
  onUndoTimestamp,
  canCapture,
  canUndo,
  canSync,
  currentMoveTimestamp,
  onFlipBoard,
  orientation,
  engineEnabled,
  onToggleEngine,
  engineOverwrite,
  onToggleOverwrite,
  engineDepth,
  engineInfo,
  isVideoPlaying,
  onPlayPause,
  hasVideo,
  isMobile,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="nav-controls">
      <div className="nav-row">
        <button onClick={onFirst} disabled={!canPrev} title={t('nav.firstMoveTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </button>
        <button onClick={onPrev} disabled={!canPrev} title={t('nav.prevMoveTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        {hasVideo && onPlayPause && (
          <button
            onClick={onPlayPause}
            className="play-pause-btn"
            title={isVideoPlaying ? t('nav.pause', 'Pause video') : t('nav.play', 'Play video')}
          >
            {isVideoPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M6 19h4V5H6zm8-14v14h4V5z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="currentColor" d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        )}
        <button onClick={onNext} disabled={!canNext} title={t('nav.nextMoveTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
        <button onClick={onLast} disabled={!canNext} title={t('nav.lastMoveTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z" />
          </svg>
        </button>
        <button onClick={onFlipBoard} title={t('nav.flipBoardTitle', { orientation })} className="flip-btn">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M7.11 8.53 5.7 7.11C4.8 8.27 4.24 9.61 4.07 11h2.02c.14-.87.49-1.72 1.02-2.47zM6.09 13H4.07c.17 1.39.72 2.73 1.62 3.89l1.41-1.42c-.52-.75-.87-1.59-1.01-2.47zm1.01 5.32c1.16.9 2.51 1.44 3.9 1.61V17.9c-.87-.15-1.71-.49-2.46-1.03L7.1 18.32zM13 4.07V1L8.45 5.55 13 10V6.09c2.84.48 5 2.94 5 5.91s-2.16 5.43-5 5.91v2.02c3.95-.49 7-3.85 7-7.93s-3.05-7.44-7-7.93z"
            />
          </svg>
        </button>
      </div>
      {!isMobile && (
        <div className="nav-row sync-row">
          <button
            className={`sync-toggle ${isSynced ? 'synced' : 'unsynced'}`}
            onClick={onToggleSync}
            disabled={!canSync}
            title={!canSync ? t('nav.syncDisabled') : isSynced ? t('nav.syncOn') : t('nav.syncOff')}
          >
            {isSynced ? t('nav.synced') : t('nav.unsynced')}
          </button>
          {!isSynced && (
            <button
              className="capture-btn"
              onClick={onCaptureTimestamp}
              disabled={!canCapture}
              title={t('nav.captureTitle')}
            >
              {t('nav.capture')}
            </button>
          )}
          {!isSynced && canUndo && (
            <button className="undo-btn" onClick={onUndoTimestamp} title={t('nav.undoTitle')}>
              {t('nav.undo')}
            </button>
          )}
          {currentMoveTimestamp !== undefined && (
            <span className="timestamp-display" title={t('nav.timestampTitle')}>
              ⏱ {formatTimestamp(currentMoveTimestamp)}
            </span>
          )}
        </div>
      )}
      {!isMobile && (
        <div className="nav-row engine-row">
          <button
            className={`engine-toggle ${engineEnabled ? 'on' : 'off'}`}
            onClick={onToggleEngine}
            title={engineEnabled ? t('nav.engineOnTitle') : t('nav.engineOffTitle')}
          >
            {engineEnabled ? t('nav.engineOn') : t('nav.engine')}
          </button>
          {engineEnabled && engineInfo && (
            <span className="engine-info">
              d{engineInfo.depth}
              {engineDepth > 0 ? `/${engineDepth}` : ''}
              {engineInfo.isThinking && ' …'}
            </span>
          )}
          {engineEnabled && (
            <label
              className="engine-overwrite"
              title={t('nav.overwriteTitle', 'Recalculate and overwrite existing eval values')}
            >
              <input type="checkbox" checked={engineOverwrite} onChange={onToggleOverwrite} />
              {t('nav.overwrite', 'Overwrite')}
            </label>
          )}
        </div>
      )}
    </div>
  );
}
