import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { estimateStorage } from '../utils/storage';
import i18n from '../i18n';
import '../components/BoardThemes.css';
import '../components/PieceThemes.css';

const THEMES = [
  { id: 'brown', light: '#f0d9b5', dark: '#b58863', label: 'Brown' },
  { id: 'blue', light: '#dee3e6', dark: '#8ca2ad', label: 'Blue' },
  { id: 'green', light: '#ffffdd', dark: '#86a666', label: 'Green' },
  { id: 'purple', light: '#e8daf0', dark: '#9070a0', label: 'Purple' },
  { id: 'ic', light: '#ececec', dark: '#c1c18e', label: 'Grey' },
];

const PIECE_SETS = [
  { id: 'cburnett', label: 'CBurnett' },
  { id: 'alpha', label: 'Alpha' },
  { id: 'maestro', label: 'Maestro' },
  { id: 'tatiana', label: 'Tatiana' },
  { id: 'companion', label: 'Companion' },
  { id: 'merida', label: 'Merida' },
  { id: 'california', label: 'California' },
  { id: 'staunty', label: 'Staunty' },
  { id: 'icpieces', label: 'ICC' },
  { id: 'horsey', label: 'Horsey' },
  { id: 'kosal', label: 'Kosal' },
  { id: 'letter', label: 'Letter' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
];

interface SettingsPanelProps {
  pgnText: string;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onVideoUrlSubmit: () => void;
  onExportLibrary: () => void;
  onImportLibrary: (e: React.ChangeEvent<HTMLInputElement>) => void;
  boardTheme: string;
  onBoardThemeChange: (theme: string) => void;
  pieceTheme: string;
  onPieceThemeChange: (theme: string) => void;
  showSquareLabels: boolean;
  onSquareLabelsChange: (v: boolean) => void;
  moveAnimationsEnabled: boolean;
  onMoveAnimationsChange: (v: boolean) => void;
  soundEnabled: boolean;
  onSoundChange: (v: boolean) => void;
  gameCount: number;
  playlistCount: number;
  isMobile?: boolean;
}

export function SettingsPanel({
  pgnText,
  videoUrl,
  onVideoUrlChange,
  onVideoUrlSubmit,
  onExportLibrary,
  onImportLibrary,
  boardTheme,
  onBoardThemeChange,
  pieceTheme,
  onPieceThemeChange,
  showSquareLabels,
  onSquareLabelsChange,
  moveAnimationsEnabled,
  onMoveAnimationsChange,
  soundEnabled,
  onSoundChange,
  gameCount,
  playlistCount,
  isMobile,
}: SettingsPanelProps) {
  const { t } = useTranslation();

  const fmt = useMemo(
    () => (b: number) =>
      b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`,
    [],
  );

  const [storageInfo, setStorageInfo] = useState({ totalBytes: 0, quota: 0, percent: 0 });
  useEffect(() => {
    estimateStorage().then(({ usage, quota }) => {
      const percent = quota > 0 ? Math.min(100, Math.round((usage / quota) * 100)) : 0;
      setStorageInfo({ totalBytes: usage, quota, percent });
    });
  }, []);

  return (
    <div className="settings-panel">
      {!isMobile && (
        <div className="settings-row">
          <label>{t('settings.youtubeUrl')}</label>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
          />
          <button onClick={onVideoUrlSubmit}>{t('settings.loadVideo')}</button>
        </div>
      )}
      <div className="settings-row">
        <label>{t('settings.boardTheme', 'Board theme')}</label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {THEMES.map((th) => (
            <div
              key={th.id}
              className={`theme-swatch ${boardTheme === th.id ? 'active' : ''}`}
              onClick={() => onBoardThemeChange(th.id)}
              title={th.label}
            >
              <div className="theme-swatch-light" style={{ backgroundColor: th.light }} />
              <div className="theme-swatch-dark" style={{ backgroundColor: th.dark }} />
            </div>
          ))}
        </div>
      </div>
      <div className="settings-row">
        <label>{t('settings.pieceTheme', 'Piece style')}</label>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {PIECE_SETS.map((ps) => (
            <div
              key={ps.id}
              className={`piece-swatch ${pieceTheme === ps.id ? 'active' : ''}`}
              onClick={() => onPieceThemeChange(ps.id)}
              title={ps.label}
              style={{
                backgroundImage:
                  ps.id === 'cburnett' ? undefined : `url(${import.meta.env.BASE_URL}pieces/${ps.id}/wN.svg)`,
              }}
            >
              {ps.id === 'cburnett' && <span style={{ fontSize: '22px', lineHeight: 1 }}>♞</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="settings-row">
        <label className="settings-checkbox">
          <input type="checkbox" checked={showSquareLabels} onChange={(e) => onSquareLabelsChange(e.target.checked)} />
          {t('settings.squareLabels', 'Square coordinates')}
        </label>
      </div>
      <div className="settings-row">
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={moveAnimationsEnabled}
            onChange={(e) => onMoveAnimationsChange(e.target.checked)}
          />
          {t('settings.moveAnimations', 'Move animations')}
        </label>
      </div>
      <div className="settings-row">
        <label className="settings-checkbox">
          <input type="checkbox" checked={soundEnabled} onChange={(e) => onSoundChange(e.target.checked)} />
          {t('settings.sound', 'Move sounds')}
        </label>
      </div>
      <div className="settings-row storage-row">
        <label>{t('settings.storage', 'Storage')}</label>
        <div className="storage-usage">
          <div className="storage-bar">
            <div
              className={`storage-bar-fill${storageInfo.percent >= 90 ? ' critical' : storageInfo.percent >= 70 ? ' warning' : ''}`}
              style={{ width: `${storageInfo.percent}%` }}
            />
          </div>
          <span className="storage-text">
            {fmt(storageInfo.totalBytes)}
            {storageInfo.quota > 0 ? ` / ${fmt(storageInfo.quota)}` : ''} ({gameCount}{' '}
            {t('settings.storageGames', 'games')}, {playlistCount} {t('settings.storagePlaylists', 'playlists')})
          </span>
        </div>
      </div>
      <div className="settings-row">
        <label>{t('settings.language', 'Language')}</label>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-option-btn ${i18n.language === lang.code ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage(lang.code)}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
      {!isMobile && (
        <div className="settings-row pgn-row">
          <label>{t('settings.pgn')}</label>
          <textarea value={pgnText} readOnly rows={12} spellCheck={false} />
        </div>
      )}
      {!isMobile && (
        <div className="settings-row library-row">
          <label>{t('settings.library')}</label>
          <button onClick={onExportLibrary}>{t('settings.exportLibrary')}</button>
          <label className="header-btn import-label">
            {t('settings.importLibrary')}
            <input type="file" accept=".json" onChange={onImportLibrary} hidden />
          </label>
        </div>
      )}
    </div>
  );
}
