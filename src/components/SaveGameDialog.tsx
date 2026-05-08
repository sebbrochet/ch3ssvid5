import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardEditor } from './BoardEditor';
import { validatePosition } from '../utils/boardValidation';
import { chess960NumberToFen, randomChess960Number } from '../utils/chess960';
import './SaveGameDialog.css';

export type Variant = 'standard' | 'chess960' | 'kingofthehill' | 'threecheck' | 'antichess';

export interface GameMetadata {
  white: string;
  black: string;
  event: string;
  videoUrl?: string;
  fen?: string;
  variant?: Variant;
}

interface Props {
  initialName?: string;
  initialVideoUrl?: string;
  currentVideoUrl?: string;
  folders: string[];
  initialFolder?: string;
  mode: 'new-file' | 'add-game';
  onSave: (name: string, folder: string, videoUrl?: string, fen?: string, variant?: Variant) => void;
  onAddGame?: (meta: GameMetadata) => void;
  onCancel: () => void;
}

export function SaveGameDialog({
  initialName = '',
  initialVideoUrl = '',
  currentVideoUrl,
  folders,
  initialFolder = '/',
  mode,
  onSave,
  onAddGame,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [folder, setFolder] = useState(initialFolder);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [newFolder, setNewFolder] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [white, setWhite] = useState('');
  const [black, setBlack] = useState('');
  const [event, setEvent] = useState('');
  const [sameVideo, setSameVideo] = useState(true);
  const [gameVideoUrl, setGameVideoUrl] = useState('');
  const [customPosition, setCustomPosition] = useState(false);
  const [editorFen, setEditorFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [variant, setVariant] = useState<Variant>('standard');
  const [chess960Input, setChess960Input] = useState('');
  const chess960Fen = chess960Input ? chess960NumberToFen(parseInt(chess960Input, 10)) : null;
  const { t } = useTranslation();

  const getEffectiveFen = (): string | undefined => {
    if (variant === 'chess960') return chess960Fen || undefined;
    if (customPosition) return editorFen;
    return undefined;
  };

  const getEffectiveVariant = (): Variant | undefined => {
    return variant !== 'standard' ? variant : undefined;
  };

  const isSubmitDisabled = (): boolean => {
    if (variant === 'chess960') return !chess960Fen;
    if (customPosition) return !validatePosition(editorFen.split(' ')[0]).valid;
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'add-game') {
      onAddGame?.({
        white: white.trim() || '?',
        black: black.trim() || '?',
        event: event.trim() || '?',
        videoUrl: sameVideo ? undefined : gameVideoUrl.trim() || undefined,
        fen: getEffectiveFen(),
        variant: getEffectiveVariant(),
      });
      return;
    }
    if (!name.trim()) return;
    const targetFolder =
      showNewFolder && newFolder.trim()
        ? folder === '/'
          ? '/' + newFolder.trim()
          : folder + '/' + newFolder.trim()
        : folder;
    onSave(name.trim(), targetFolder, videoUrl || undefined, getEffectiveFen(), getEffectiveVariant());
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{mode === 'new-file' ? t('dialog.newPgnFile') : t('dialog.addGameToFile')}</h3>

        {mode === 'add-game' ? (
          <form onSubmit={handleSubmit}>
            <p className="dialog-hint">{t('dialog.addGameHint')}</p>
            <div className="dialog-field">
              <label>{t('dialog.white')}</label>
              <input
                type="text"
                value={white}
                onChange={(e) => setWhite(e.target.value)}
                placeholder={t('dialog.playerPlaceholder')}
                autoFocus
              />
            </div>
            <div className="dialog-field">
              <label>{t('dialog.black')}</label>
              <input
                type="text"
                value={black}
                onChange={(e) => setBlack(e.target.value)}
                placeholder={t('dialog.playerPlaceholder')}
              />
            </div>
            <div className="dialog-field">
              <label>{t('dialog.eventOptional')}</label>
              <input
                type="text"
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder={t('dialog.eventPlaceholder')}
              />
            </div>
            {currentVideoUrl && (
              <div className="dialog-field">
                <label className="dialog-checkbox">
                  <input type="checkbox" checked={sameVideo} onChange={(e) => setSameVideo(e.target.checked)} />
                  {t('dialog.sameVideo')}
                </label>
              </div>
            )}
            {(!sameVideo || !currentVideoUrl) && (
              <div className="dialog-field">
                <label>{t('dialog.youtubeUrl')}</label>
                <input
                  type="text"
                  value={gameVideoUrl}
                  onChange={(e) => setGameVideoUrl(e.target.value)}
                  placeholder={t('dialog.youtubePlaceholder')}
                />
              </div>
            )}
            <div className="dialog-field">
              <label>{t('editor.variant', 'Variant')}</label>
              <select value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
                <option value="standard">{t('editor.standard', 'Standard')}</option>
                <option value="chess960">{t('editor.chess960', 'Chess960')}</option>
                <option value="kingofthehill">{t('editor.kingOfTheHill', 'King of the Hill')}</option>
                <option value="threecheck">{t('editor.threeCheck', 'Three-check')}</option>
                <option value="antichess">{t('editor.antichess', 'Antichess')}</option>
                <option value="kingofthehill">{t('editor.kingOfTheHill', 'King of the Hill')}</option>
                <option value="threecheck">{t('editor.threeCheck', 'Three-check')}</option>
                <option value="antichess">{t('editor.antichess', 'Antichess')}</option>
              </select>
            </div>
            {variant === 'chess960' && (
              <div className="dialog-field chess960-field">
                <label>{t('editor.positionNumber', 'Position # (0–959)')}</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="959"
                    value={chess960Input}
                    onChange={(e) => setChess960Input(e.target.value)}
                    placeholder="518"
                    style={{ width: '100px' }}
                  />
                  <button type="button" onClick={() => setChess960Input(String(randomChess960Number()))}>
                    🎲 {t('editor.random', 'Random')}
                  </button>
                </div>
                {chess960Fen && (
                  <code
                    style={{
                      fontSize: '11px',
                      color: '#aaa',
                      marginTop: '4px',
                      display: 'block',
                      wordBreak: 'break-all',
                    }}
                  >
                    {chess960Fen}
                  </code>
                )}
              </div>
            )}
            {variant === 'standard' && (
              <div className="dialog-field">
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={customPosition}
                    onChange={(e) => setCustomPosition(e.target.checked)}
                  />
                  {t('editor.customPosition', 'Custom position')}
                </label>
              </div>
            )}
            {variant === 'standard' && customPosition && <BoardEditor fen={editorFen} onFenChange={setEditorFen} />}
            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={onCancel}>
                {t('dialog.cancel')}
              </button>
              <button type="submit" className="dialog-submit" disabled={isSubmitDisabled()}>
                {t('dialog.addGame')}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="dialog-field">
              <label>{t('dialog.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('dialog.namePlaceholder')}
                autoFocus
              />
            </div>

            {mode === 'new-file' && (
              <div className="dialog-field">
                <label>{t('dialog.youtubeUrl')}</label>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder={t('dialog.youtubePlaceholder')}
                />
              </div>
            )}

            <div className="dialog-field">
              <label>{t('editor.variant', 'Variant')}</label>
              <select value={variant} onChange={(e) => setVariant(e.target.value as Variant)}>
                <option value="standard">{t('editor.standard', 'Standard')}</option>
                <option value="chess960">{t('editor.chess960', 'Chess960')}</option>
                <option value="kingofthehill">{t('editor.kingOfTheHill', 'King of the Hill')}</option>
                <option value="threecheck">{t('editor.threeCheck', 'Three-check')}</option>
                <option value="antichess">{t('editor.antichess', 'Antichess')}</option>
              </select>
            </div>

            {variant === 'chess960' && (
              <div className="dialog-field chess960-field">
                <label>{t('editor.positionNumber', 'Position # (0–959)')}</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="959"
                    value={chess960Input}
                    onChange={(e) => setChess960Input(e.target.value)}
                    placeholder="518"
                    style={{ width: '100px' }}
                  />
                  <button type="button" onClick={() => setChess960Input(String(randomChess960Number()))}>
                    🎲 {t('editor.random', 'Random')}
                  </button>
                </div>
                {chess960Fen && (
                  <code
                    style={{
                      fontSize: '11px',
                      color: '#aaa',
                      marginTop: '4px',
                      display: 'block',
                      wordBreak: 'break-all',
                    }}
                  >
                    {chess960Fen}
                  </code>
                )}
                {chess960Input && !chess960Fen && (
                  <span style={{ color: '#ff6b6b', fontSize: '12px' }}>
                    {t('editor.invalidPosition', 'Invalid position number')}
                  </span>
                )}
              </div>
            )}

            {variant === 'standard' && mode === 'new-file' && (
              <div className="dialog-field">
                <label className="dialog-checkbox">
                  <input
                    type="checkbox"
                    checked={customPosition}
                    onChange={(e) => setCustomPosition(e.target.checked)}
                  />
                  {t('editor.customPosition', 'Custom position')}
                </label>
              </div>
            )}

            {variant === 'standard' && customPosition && <BoardEditor fen={editorFen} onFenChange={setEditorFen} />}

            <div className="dialog-field">
              <label>{t('dialog.folder')}</label>
              <select value={folder} onChange={(e) => setFolder(e.target.value)}>
                {folders.map((f) => (
                  <option key={f} value={f}>
                    {f === '/' ? t('dialog.rootFolder') : f}
                  </option>
                ))}
              </select>
              <button type="button" className="new-folder-toggle" onClick={() => setShowNewFolder(!showNewFolder)}>
                {showNewFolder ? '✕' : t('dialog.newFolderBtn')}
              </button>
            </div>

            {showNewFolder && (
              <div className="dialog-field">
                <label>{t('dialog.newSubfolder')}</label>
                <input
                  type="text"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder={t('library.folderPlaceholder')}
                />
              </div>
            )}

            <div className="dialog-actions">
              <button type="button" className="dialog-cancel" onClick={onCancel}>
                {t('dialog.cancel')}
              </button>
              <button type="submit" className="dialog-submit" disabled={!name.trim() || isSubmitDisabled()}>
                {mode === 'new-file' ? t('dialog.createFile') : t('dialog.addGame')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
