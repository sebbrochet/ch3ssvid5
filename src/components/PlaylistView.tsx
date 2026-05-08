import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Playlist } from '../hooks/usePlaylist';
import type { StoredGame } from '../types';
import './PlaylistView.css';

interface Props {
  playlist: Playlist;
  games: StoredGame[];
  activeIndex: number;
  isPlaying: boolean;
  isMobile?: boolean;
  onBack: () => void;
  onSelectGame: (gameId: string, index: number) => void;
  onPlayAll: (startIndex?: number) => void;
  onRemoveGame: (index: number) => void;
  onReorderGame: (fromIndex: number, toIndex: number) => void;
  onExport: () => void;
  onAddGames: () => void;
}

export function PlaylistView({
  playlist,
  games,
  activeIndex,
  isPlaying,
  isMobile,
  onBack,
  onSelectGame,
  onPlayAll,
  onRemoveGame,
  onReorderGame,
  onExport,
  onAddGames,
}: Props) {
  const { t } = useTranslation();
  const gameMap = new Map(games.map((g) => [g.id, g]));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const resolvedGames = playlist.gameIds.map((id, i) => ({
    index: i,
    game: gameMap.get(id),
    id,
  }));

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragStartRef.current = index;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (dragStartRef.current !== null && dragStartRef.current !== toIndex) {
      onReorderGame(dragStartRef.current, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragStartRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragStartRef.current = null;
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) onReorderGame(index, index - 1);
  };

  const handleMoveDown = (index: number) => {
    if (index < playlist.gameIds.length - 1) onReorderGame(index, index + 1);
  };

  return (
    <div className="playlist-view">
      <button className="playlist-back-btn" onClick={onBack}>
        ← {t('playlist.backToLibrary', 'Back to Library')}
      </button>

      <div className="playlist-view-header">
        <h3 className="playlist-view-title">🎬 {playlist.name}</h3>
        {playlist.description && <p className="playlist-view-desc">{playlist.description}</p>}
      </div>

      {resolvedGames.length === 0 ? (
        <div className="playlist-empty-view">
          <p>{t('playlist.noGames', 'No games in this playlist')}</p>
          <button className="playlist-action-btn" onClick={onAddGames}>
            {t('playlist.addGames', 'Add Games')}
          </button>
        </div>
      ) : (
        <>
          <div className="playlist-game-list">
            {resolvedGames.map(({ index, game, id }) => (
              <div
                key={`${id}-${index}`}
                className={`playlist-game-item${isPlaying && index === activeIndex ? ' now-playing' : ''}${dragIndex === index ? ' dragging' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
                onClick={() => game && onSelectGame(game.id, index)}
                draggable={!isMobile}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {!isMobile && <span className="playlist-drag-handle">≡</span>}
                <span className="playlist-game-number">
                  {isPlaying && index === activeIndex ? '▶' : `${index + 1}.`}
                </span>
                <span className="playlist-game-name">
                  {game ? game.name : t('playlist.gameNotFound', '(game not found)')}
                </span>
                <span className="playlist-game-actions">
                  {isMobile && (
                    <>
                      <button
                        className="playlist-move-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveUp(index);
                        }}
                        disabled={index === 0}
                        title={t('playlist.moveUp', 'Move up')}
                      >
                        ▲
                      </button>
                      <button
                        className="playlist-move-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDown(index);
                        }}
                        disabled={index === resolvedGames.length - 1}
                        title={t('playlist.moveDown', 'Move down')}
                      >
                        ▼
                      </button>
                    </>
                  )}
                  <button
                    className="playlist-remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveGame(index);
                    }}
                    title={t('playlist.removeGame', 'Remove from playlist')}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="playlist-view-actions">
            <button className="playlist-action-btn primary" onClick={() => onPlayAll()}>
              ▶ {t('playlist.playAll', 'Play All')}
            </button>
            <button className="playlist-action-btn" onClick={onAddGames}>
              {t('playlist.addGames', 'Add Games')}
            </button>
            <button className="playlist-action-btn" onClick={onExport}>
              📤 {t('playlist.export', 'Export')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
