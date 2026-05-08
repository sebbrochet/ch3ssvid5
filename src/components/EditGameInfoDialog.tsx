import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../components/SaveGameDialog.css';

export interface GameHeaders {
  White: string;
  Black: string;
  Event: string;
  Site: string;
  Date: string;
  Result: string;
  VideoURL?: string;
  WhiteElo?: string;
  BlackElo?: string;
  Round?: string;
  Tags?: string;
  Difficulty?: string;
  Language?: string;
  Annotator?: string;
  VideoTitle?: string;
}

interface Props {
  headers: Record<string, string>;
  previousVideoUrl?: string;
  gameName?: string;
  onSave: (headers: GameHeaders) => void;
  onCancel: () => void;
}

export function EditGameInfoDialog({ headers, previousVideoUrl, gameName, onSave, onCancel }: Props) {
  const { t } = useTranslation();

  // Tab state
  const [activeTab, setActiveTab] = useState<'game' | 'community'>('game');

  // Section 1: Core game info
  const [white, setWhite] = useState(headers['White'] || '?');
  const [whiteElo, setWhiteElo] = useState(headers['WhiteElo'] || '');
  const [black, setBlack] = useState(headers['Black'] || '?');
  const [blackElo, setBlackElo] = useState(headers['BlackElo'] || '');
  const [event, setEvent] = useState(headers['Event'] || '?');
  const [round, setRound] = useState(headers['Round'] || '');
  const [site, setSite] = useState(headers['Site'] || '?');
  const [date, setDate] = useState(headers['Date'] || '????.??.??');
  const [result, setResult] = useState(headers['Result'] || '*');
  const hasOwnVideo = !!headers['VideoURL'];
  const [sameVideo, setSameVideo] = useState(!hasOwnVideo && !!previousVideoUrl);
  const [videoUrl, setVideoUrl] = useState(headers['VideoURL'] || '');

  // Section 2: Community sharing
  const [tags, setTags] = useState(headers['Tags'] || '');
  const [difficulty, setDifficulty] = useState(headers['Difficulty'] || '');
  const [language, setLanguage] = useState(headers['Language'] || '');
  const [annotator, setAnnotator] = useState(headers['Annotator'] || localStorage.getItem('ch3ssvid5-annotator') || '');
  const [videoTitle, setVideoTitle] = useState(headers['VideoTitle'] || '');

  // Read-only fields
  const variant = headers['Variant'];
  const opening = headers['Opening'];
  const eco = headers['ECO'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (annotator.trim()) {
      localStorage.setItem('ch3ssvid5-annotator', annotator.trim());
    }
    const result_: GameHeaders = {
      White: white.trim() || '?',
      Black: black.trim() || '?',
      Event: event.trim() || '?',
      Site: site.trim() || '?',
      Date: date.trim() || '????.??.??',
      Result: result,
      VideoURL: sameVideo ? undefined : videoUrl.trim() || undefined,
      WhiteElo: whiteElo.trim() || undefined,
      BlackElo: blackElo.trim() || undefined,
      Round: round.trim() || undefined,
      Tags: tags.trim() || undefined,
      Difficulty: difficulty || undefined,
      Language: language || undefined,
      Annotator: annotator.trim() || undefined,
      VideoTitle: videoTitle.trim() && videoTitle.trim() !== gameName ? videoTitle.trim() : undefined,
    };
    onSave(result_);
  };

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog dialog-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{t('dialog.editGameInfo')}</h3>

        <div className="dialog-tabs">
          <button
            type="button"
            className={`dialog-tab ${activeTab === 'game' ? 'active' : ''}`}
            onClick={() => setActiveTab('game')}
          >
            {t('dialog.gameTab', 'Game')}
          </button>
          <button
            type="button"
            className={`dialog-tab ${activeTab === 'community' ? 'active' : ''}`}
            onClick={() => setActiveTab('community')}
          >
            {t('dialog.communitySharing', 'Community')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {activeTab === 'game' && (
            <div className="dialog-tab-content">
              <div className="dialog-field dialog-field-inline">
                <div className="dialog-field-grow">
                  <label>{t('dialog.white')}</label>
                  <input
                    type="text"
                    value={white}
                    onChange={(e) => setWhite(e.target.value)}
                    placeholder={t('dialog.playerPlaceholder')}
                    autoFocus
                  />
                </div>
                <div className="dialog-field-elo">
                  <label>{t('dialog.elo', 'Elo')}</label>
                  <input
                    type="number"
                    value={whiteElo}
                    onChange={(e) => setWhiteElo(e.target.value)}
                    placeholder="—"
                    min="0"
                    max="9999"
                  />
                </div>
              </div>
              <div className="dialog-field dialog-field-inline">
                <div className="dialog-field-grow">
                  <label>{t('dialog.black')}</label>
                  <input
                    type="text"
                    value={black}
                    onChange={(e) => setBlack(e.target.value)}
                    placeholder={t('dialog.playerPlaceholder')}
                  />
                </div>
                <div className="dialog-field-elo">
                  <label>{t('dialog.elo', 'Elo')}</label>
                  <input
                    type="number"
                    value={blackElo}
                    onChange={(e) => setBlackElo(e.target.value)}
                    placeholder="—"
                    min="0"
                    max="9999"
                  />
                </div>
              </div>
              <div className="dialog-field dialog-field-inline">
                <div className="dialog-field-grow">
                  <label>{t('dialog.event')}</label>
                  <input
                    type="text"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    placeholder={t('dialog.eventPlaceholderEdit')}
                  />
                </div>
                <div className="dialog-field-elo">
                  <label>{t('dialog.round', 'Round')}</label>
                  <input type="text" value={round} onChange={(e) => setRound(e.target.value)} placeholder="—" />
                </div>
              </div>
              <div className="dialog-field">
                <label>{t('dialog.site')}</label>
                <input
                  type="text"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder={t('dialog.sitePlaceholder')}
                />
              </div>
              <div className="dialog-field">
                <label>{t('dialog.date')}</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder={t('dialog.datePlaceholder')}
                />
              </div>
              <div className="dialog-field">
                <label>{t('dialog.result')}</label>
                <select value={result} onChange={(e) => setResult(e.target.value)}>
                  <option value="*">{t('dialog.resultOngoing')}</option>
                  <option value="1-0">{t('dialog.resultWhiteWins')}</option>
                  <option value="0-1">{t('dialog.resultBlackWins')}</option>
                  <option value="1/2-1/2">{t('dialog.resultDraw')}</option>
                </select>
              </div>
              {previousVideoUrl && (
                <div className="dialog-field">
                  <label className="dialog-checkbox">
                    <input type="checkbox" checked={sameVideo} onChange={(e) => setSameVideo(e.target.checked)} />
                    {t('dialog.sameVideo')}
                  </label>
                </div>
              )}
              {!sameVideo && (
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
              {(variant || opening || eco) && (
                <div className="dialog-field dialog-field-readonly">
                  {variant && (
                    <span>
                      <strong>{t('editor.variant', 'Variant')}:</strong> {variant}
                    </span>
                  )}
                  {(opening || eco) && (
                    <span>
                      {opening && (
                        <>
                          <strong>{t('dialog.opening', 'Opening')}:</strong> {opening}
                        </>
                      )}
                      {eco && (
                        <>
                          {' '}
                          <strong>{t('dialog.eco', 'ECO')}:</strong> {eco}
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="dialog-tab-content">
              <div className="dialog-field">
                <label>{t('dialog.tags', 'Tags')}</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder={t('dialog.tagsPlaceholder', 'endgame, rook, technique')}
                />
              </div>
              <div className="dialog-field">
                <label>{t('dialog.difficulty', 'Difficulty')}</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">—</option>
                  <option value="beginner">{t('dialog.difficultyBeginner', 'Beginner')}</option>
                  <option value="intermediate">{t('dialog.difficultyIntermediate', 'Intermediate')}</option>
                  <option value="advanced">{t('dialog.difficultyAdvanced', 'Advanced')}</option>
                </select>
              </div>
              <div className="dialog-field">
                <label>{t('dialog.commentLanguage', 'Language')}</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="">—</option>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="pt">Português</option>
                </select>
              </div>
              <div className="dialog-field">
                <label>{t('dialog.annotator', 'Annotator')}</label>
                <input
                  type="text"
                  value={annotator}
                  onChange={(e) => setAnnotator(e.target.value)}
                  placeholder={t('dialog.annotatorPlaceholder', 'Your name or alias')}
                />
              </div>
              <div className="dialog-field">
                <label>{t('dialog.videoTitle', 'Video title')}</label>
                <input
                  type="text"
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder={gameName || t('dialog.videoTitlePlaceholder', 'Display name for the video')}
                />
              </div>
            </div>
          )}

          <div className="dialog-actions">
            <button type="button" className="dialog-cancel" onClick={onCancel}>
              {t('dialog.cancel')}
            </button>
            <button type="submit" className="dialog-submit">
              {t('dialog.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
