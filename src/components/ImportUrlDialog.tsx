import { useTranslation } from 'react-i18next';
import './SaveGameDialog.css';

interface Props {
  pgnUrl: string;
  folder: string;
  gameName: string;
  isLoading: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportUrlDialog({ pgnUrl, folder, gameName, isLoading, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('importUrl.heading')}</h2>

        <div className="dialog-field">
          <label>{t('importUrl.source')}</label>
          <div className="import-url-display">{pgnUrl}</div>
        </div>

        <div className="dialog-field">
          <label>{t('importUrl.gameName')}</label>
          <div className="import-url-display">{gameName}</div>
        </div>

        <div className="dialog-field">
          <label>{t('importUrl.libraryFolder')}</label>
          <div className="import-url-display">{folder === '/' ? t('importUrl.rootFolder') : folder}</div>
        </div>

        {error && <div className="import-url-error">{error}</div>}

        <div className="dialog-actions">
          <button onClick={onCancel} disabled={isLoading}>
            {t('dialog.cancel')}
          </button>
          <button className="primary" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? t('importUrl.importing') : t('importUrl.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
