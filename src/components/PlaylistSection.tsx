import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Playlist } from '../hooks/usePlaylist';
import type { StoredGame } from '../types';
import './PlaylistSection.css';

interface Props {
  playlists: Playlist[];
  games: StoredGame[];
  activePlaylistId: string | null;
  onCreatePlaylist: (name: string, description?: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
}

export function PlaylistSection({
  playlists,
  games,
  activePlaylistId,
  onCreatePlaylist,
  onSelectPlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
}: Props) {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    onCreatePlaylist(name);
    setNewName('');
    setShowCreate(false);
  };

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const handleRenameStart = (playlist: Playlist) => {
    setRenamingId(playlist.id);
    setRenameValue(playlist.name);
    setContextMenu(null);
  };

  const handleRenameConfirm = () => {
    if (renamingId && renameValue.trim()) {
      onRenamePlaylist(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const gameCount = (playlist: Playlist) => {
    const gameIdSet = new Set(games.map((g) => g.id));
    return playlist.gameIds.filter((id) => gameIdSet.has(id)).length;
  };

  return (
    <div className="playlist-section">
      <div className="playlist-section-header">
        <span className="playlist-section-title">{t('playlist.heading', 'Playlists')}</span>
        <button
          className="playlist-add-btn"
          title={t('playlist.create', 'New Playlist')}
          onClick={() => setShowCreate(!showCreate)}
        >
          ＋
        </button>
      </div>

      {showCreate && (
        <div className="playlist-create-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowCreate(false);
            }}
            placeholder={t('playlist.namePlaceholder', 'Playlist name')}
            autoFocus
          />
          <div className="playlist-create-buttons">
            <button
              className="inline-icon-btn confirm"
              onClick={handleCreate}
              disabled={!newName.trim()}
              title={t('playlist.createBtn', 'Create')}
            >
              ✓
            </button>
            <button
              className="inline-icon-btn cancel"
              onClick={() => {
                setShowCreate(false);
                setNewName('');
              }}
              title={t('dialog.cancel', 'Cancel')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {playlists.length === 0 && !showCreate && (
        <div className="playlist-empty">{t('playlist.noPlaylists', 'No playlists yet')}</div>
      )}

      {playlists.map((pl) => (
        <div
          key={pl.id}
          className={`playlist-item${activePlaylistId === pl.id ? ' active' : ''}`}
          onClick={() => onSelectPlaylist(pl)}
          onContextMenu={(e) => handleContextMenu(e, pl.id)}
        >
          {renamingId === pl.id ? (
            <input
              className="playlist-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onBlur={handleRenameConfirm}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <span className="playlist-icon">🎬</span>
              <span className="playlist-name">{pl.name}</span>
              <span className="playlist-count">({gameCount(pl)})</span>
            </>
          )}
        </div>
      ))}

      {contextMenu && (
        <div className="folder-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button
            onClick={() => {
              handleRenameStart(playlists.find((p) => p.id === contextMenu.id)!);
            }}
          >
            {t('playlist.rename', 'Rename')}
          </button>
          <button
            onClick={() => {
              onDeletePlaylist(contextMenu.id);
              setContextMenu(null);
            }}
          >
            {t('playlist.delete', 'Delete')}
          </button>
        </div>
      )}
    </div>
  );
}
