import { useTranslation } from 'react-i18next';
import type { GameData } from '../types';
import './GameSelector.css';

interface Props {
  games: GameData[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAddGame?: () => void;
  onEditGameInfo?: () => void;
  onDeleteGame?: () => void;
  hasFile: boolean;
}

function gameLabel(game: GameData, index: number): string {
  const white = game.headers['White'] || '?';
  const black = game.headers['Black'] || '?';
  const event = game.headers['Event'];
  const label = `${white} vs ${black}`;
  if (event && event !== '?' && event !== white && event !== black) {
    return `${label} (${event})`;
  }
  return label || `Game ${index + 1}`;
}

export function GameSelector({
  games,
  selectedIndex,
  onSelect,
  onAddGame,
  onEditGameInfo,
  onDeleteGame,
  hasFile,
}: Props) {
  const { t } = useTranslation();

  if (!hasFile && games.length <= 1) return null;

  return (
    <div className="game-selector">
      <span className="game-selector-label">
        {t('gameSelector.gameLabel', { current: selectedIndex + 1, total: games.length })}
      </span>
      <select value={selectedIndex} onChange={(e) => onSelect(Number(e.target.value))}>
        {games.map((game, i) => (
          <option key={i} value={i}>
            {gameLabel(game, i)}
          </option>
        ))}
      </select>
      {hasFile && onEditGameInfo && (
        <button className="edit-game-btn" onClick={onEditGameInfo} title={t('gameSelector.editGameInfo')}>
          ✏️
        </button>
      )}
      {hasFile && onAddGame && (
        <button className="add-game-btn" onClick={onAddGame} title={t('gameSelector.addGameTitle')}>
          {t('gameSelector.addGame')}
        </button>
      )}
      {hasFile && onDeleteGame && games.length > 1 && (
        <button className="delete-game-btn" onClick={onDeleteGame} title={t('gameSelector.deleteGameTitle')}>
          🗑️
        </button>
      )}
    </div>
  );
}
