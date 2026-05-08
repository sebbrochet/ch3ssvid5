import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePeerShare, usePeerReceive } from '../hooks/usePeerShare';
import './PeerShareDialog.css';

interface ShareDialogProps {
  gameName: string;
  pgn: string;
  videoId?: string;
  folder?: string;
  onClose: () => void;
}

export function PeerShareDialog({ gameName, pgn, videoId, folder, onClose }: ShareDialogProps) {
  const { t } = useTranslation();
  const { shareStatus, shareCode, shareError, startSharing, stopSharing } = usePeerShare();

  const handleStart = () => {
    startSharing({ name: gameName, pgn, videoId, folder });
  };

  const handleClose = () => {
    stopSharing();
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog peer-share-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('share.shareGame', 'Share Game')}</h2>

        {shareStatus === 'idle' && (
          <div className="peer-share-body">
            <p className="peer-share-desc">
              {t(
                'share.shareDesc',
                'Share this game with another device on any network. The other device needs to open Ch3ssVid5 and enter the code.',
              )}
            </p>
            <button className="peer-share-start" onClick={handleStart}>
              {t('share.startSharing', '📤 Start Sharing')}
            </button>
          </div>
        )}

        {shareStatus === 'waiting' && (
          <div className="peer-share-body">
            <p className="peer-share-desc">
              {t('share.waitingDesc', 'On the other device, open Ch3ssVid5 and click "Receive".')}
            </p>
            <div className="peer-share-code">
              <span className="peer-code-label">{t('share.code', 'Code:')}</span>
              <span className="peer-code-value">{shareCode}</span>
            </div>
            <p className="peer-share-game-name">♟ {gameName}</p>
            <div className="peer-share-waiting">{t('share.waitingForConnection', 'Waiting for connection...')}</div>
          </div>
        )}

        {shareStatus === 'connected' && (
          <div className="peer-share-body">
            <div className="peer-share-sending">{t('share.sending', 'Sending...')}</div>
          </div>
        )}

        {shareStatus === 'transferred' && (
          <div className="peer-share-body">
            <div className="peer-share-success">✅ {t('share.transferred', 'Game transferred successfully!')}</div>
          </div>
        )}

        {shareStatus === 'error' && (
          <div className="peer-share-body">
            <div className="peer-share-error">❌ {shareError}</div>
            <button className="peer-share-start" onClick={handleStart}>
              {t('share.retry', 'Retry')}
            </button>
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={handleClose}>
            {shareStatus === 'transferred' ? t('dialog.ok', 'OK') : t('dialog.cancel', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReceiveDialogProps {
  onReceive: (data: { name: string; pgn: string; videoId?: string; folder?: string }) => void;
  onClose: () => void;
}

export function PeerReceiveDialog({ onReceive, onClose }: ReceiveDialogProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const { receiveStatus, receiveError, receivedData, connectToCode, cancelReceive } = usePeerReceive();

  const handleConnect = () => {
    if (code.length === 4) {
      connectToCode(code);
    }
  };

  const importedRef = useRef(false);

  const handleClose = () => {
    cancelReceive();
    onClose();
  };

  // Auto-import when received (only once)
  useEffect(() => {
    if (receiveStatus === 'received' && receivedData && !importedRef.current) {
      importedRef.current = true;
      onReceive(receivedData);
    }
  }, [receiveStatus, receivedData, onReceive]);

  return (
    <div className="dialog-overlay" onClick={handleClose}>
      <div className="dialog peer-share-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('share.receiveGame', 'Receive Game')}</h2>

        {(receiveStatus === 'idle' || receiveStatus === 'error') && (
          <div className="peer-share-body">
            <p className="peer-share-desc">
              {t('share.receiveDesc', 'Enter the 4-digit code shown on the sharing device.')}
            </p>
            <div className="peer-receive-input">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="0000"
                autoFocus
                className="peer-code-input"
              />
              <button className="peer-share-start" onClick={handleConnect} disabled={code.length !== 4}>
                {t('share.connect', 'Connect')}
              </button>
            </div>
            {receiveStatus === 'error' && <div className="peer-share-error">❌ {receiveError}</div>}
          </div>
        )}

        {receiveStatus === 'connecting' && (
          <div className="peer-share-body">
            <div className="peer-share-waiting">{t('share.connecting', 'Connecting...')}</div>
          </div>
        )}

        {receiveStatus === 'receiving' && (
          <div className="peer-share-body">
            <div className="peer-share-waiting">{t('share.receiving', 'Receiving game...')}</div>
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={handleClose}>{t('dialog.cancel', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}
