import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredGame } from '../types';
import './PlaylistGamePicker.css';

interface Props {
  games: StoredGame[];
  onAdd: (gameIds: string[]) => void;
  onClose: () => void;
}

export function PlaylistGamePicker({ games, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const filtered = games.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()));

  const toggleGame = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onAdd(Array.from(selected));
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog game-picker-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{t('playlist.pickGames', 'Add Games to Playlist')}</h3>
        <input
          className="game-picker-filter"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('playlist.filterGames', 'Filter games...')}
          autoFocus
        />
        <div className="game-picker-list">
          {filtered.map((game) => (
            <label key={game.id} className="game-picker-item">
              <input type="checkbox" checked={selected.has(game.id)} onChange={() => toggleGame(game.id)} />
              <span className="game-picker-name">{game.name}</span>
              {game.videoId && <span className="game-picker-video">🎬</span>}
            </label>
          ))}
          {filtered.length === 0 && (
            <div className="game-picker-empty">{t('playlist.noGamesFound', 'No games found')}</div>
          )}
        </div>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel', 'Cancel')}
          </button>
          <button type="button" onClick={handleConfirm} disabled={selected.size === 0}>
            {t('playlist.addSelected', 'Add')} ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
