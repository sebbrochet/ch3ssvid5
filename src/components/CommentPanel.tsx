import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CommentPanelProps {
  comment?: string;
  nodeId: string | null;
  onSave: (nodeId: string, comment: string) => void;
}

/** Editable comment panel below the board */
export function CommentPanel({ comment, nodeId, onSave }: CommentPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const { t } = useTranslation();

  const handleStartEdit = () => {
    setEditText(comment || '');
    setEditing(true);
  };

  const handleFinish = () => {
    if (nodeId) {
      onSave(nodeId, editText.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  // Don't render anything if no move is selected
  if (!nodeId) return null;

  // Show add button if no comment exists
  if (!comment && !editing) {
    return (
      <div className="comment-panel comment-empty">
        <button className="comment-add-btn" onClick={handleStartEdit}>
          {t('comment.addComment')}
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="comment-panel comment-editing">
        <textarea
          className="comment-input"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleFinish();
            }
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder={t('comment.commentPlaceholder')}
          autoFocus
          rows={2}
        />
        <div className="comment-edit-actions">
          <button onClick={handleFinish}>{t('dialog.save')}</button>
          <button onClick={handleCancel}>{t('dialog.cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="comment-panel" onClick={handleStartEdit} title={t('comment.clickToEdit')}>
      <span className="comment-icon">💬</span>
      <span className="comment-text">{comment}</span>
    </div>
  );
}
