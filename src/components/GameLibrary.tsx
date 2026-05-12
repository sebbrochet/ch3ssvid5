import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredGame } from '../types';
import type { Playlist } from '../hooks/usePlaylist';
import { PlaylistSection } from './PlaylistSection';
import { showToast } from './Toast';
import './GameLibrary.css';

interface Props {
  games: StoredGame[];
  currentGameId: string | null;
  getGamesInFolder: (folder: string) => StoredGame[];
  getSubfolders: (folder: string) => string[];
  onSelectGame: (game: StoredGame) => void;
  onNewGame: () => void;
  onDeleteGame: (id: string) => void;
  onCloneGame: (id: string) => void;
  onRenameGame: (id: string, newName: string) => void;
  onCreateFolder: (path: string) => void;
  onMoveGame: (id: string, folder: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFolder: (oldPath: string, newPath: string) => void;
  currentFolder: string;
  onCurrentFolderChange: (folder: string) => void;
  isMobile?: boolean;
  playlists: Playlist[];
  activePlaylistId: string | null;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onAddToPlaylist: (playlistId: string, gameId: string) => void;
}

function folderDisplayName(path: string): string {
  if (path === '/') return 'All Games';
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function GameLibrary({
  games,
  currentGameId,
  getGamesInFolder,
  getSubfolders,
  onSelectGame,
  onNewGame,
  onDeleteGame,
  onCloneGame,
  onRenameGame,
  onCreateFolder,
  onMoveGame,
  onDeleteFolder,
  onRenameFolder,
  currentFolder,
  onCurrentFolderChange,
  isMobile,
  playlists,
  activePlaylistId,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onSelectPlaylist,
  onAddToPlaylist,
}: Props) {
  const setCurrentFolder = onCurrentFolderChange;
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folder: string } | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [gameContextMenu, setGameContextMenu] = useState<{ x: number; y: number; gameId: string } | null>(null);

  const subfolders = getSubfolders(currentFolder);
  const gamesInFolder = getGamesInFolder(currentFolder);

  const parentFolder =
    currentFolder === '/' ? null : '/' + currentFolder.split('/').filter(Boolean).slice(0, -1).join('/') || '/';

  const handleStartRename = (game: StoredGame) => {
    setEditingId(game.id);
    setEditName(game.name);
  };

  const handleFinishRename = () => {
    if (editingId && editName.trim()) {
      onRenameGame(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    if (name.includes('/')) {
      showToast(t('library.folderSlashError'));
      return;
    }
    const path = currentFolder === '/' ? '/' + name : currentFolder + '/' + name;
    onCreateFolder(path);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleDragStart = (e: React.DragEvent, gameId: string) => {
    e.dataTransfer.setData('text/plain', gameId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDragStart = (e: React.DragEvent, folder: string) => {
    e.dataTransfer.setData('text/plain', `folder:${folder}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folder);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data.startsWith('folder:')) {
      const sourceFolder = data.slice('folder:'.length);
      // Prevent dropping into itself or a subfolder of itself
      if (targetFolder === sourceFolder || targetFolder.startsWith(sourceFolder + '/')) {
        setDragOverFolder(null);
        return;
      }
      const folderName = sourceFolder.split('/').filter(Boolean).pop();
      if (!folderName) {
        setDragOverFolder(null);
        return;
      }
      const newPath = targetFolder === '/' ? '/' + folderName : targetFolder + '/' + folderName;
      if (newPath !== sourceFolder) {
        onRenameFolder(sourceFolder, newPath);
      }
    } else if (data) {
      onMoveGame(data, targetFolder);
    }
    setDragOverFolder(null);
  };

  // Close folder context menu on click anywhere
  useEffect(() => {
    if (!folderContextMenu && !gameContextMenu) return;
    const close = () => {
      setFolderContextMenu(null);
      setGameContextMenu(null);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [folderContextMenu, gameContextMenu]);

  const handleFolderContextMenu = (e: React.MouseEvent, folder: string) => {
    e.preventDefault();
    e.stopPropagation();
    setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
  };

  const handleStartFolderRename = () => {
    if (!folderContextMenu) return;
    setRenamingFolder(folderContextMenu.folder);
    setRenameFolderName(folderDisplayName(folderContextMenu.folder));
    setFolderContextMenu(null);
  };

  const handleFinishFolderRename = () => {
    const name = renameFolderName.trim();
    if (renamingFolder && name) {
      if (name.includes('/')) {
        showToast(t('library.folderSlashError'));
        return;
      }
      const parts = renamingFolder.split('/').filter(Boolean);
      parts[parts.length - 1] = name;
      const newPath = '/' + parts.join('/');
      onRenameFolder(renamingFolder, newPath);
      if (currentFolder === renamingFolder) {
        setCurrentFolder(newPath);
      }
    }
    setRenamingFolder(null);
  };

  const handleDeleteFolderAction = () => {
    if (!folderContextMenu) return;
    const folder = folderContextMenu.folder;
    const gameCount = getGamesInFolder(folder).length;
    const subCount = getSubfolders(folder).length;
    const msg =
      gameCount > 0 || subCount > 0
        ? t('library.confirmDeleteFolder', { name: folderDisplayName(folder), gameCount, subCount })
        : t('library.confirmDeleteEmptyFolder', { name: folderDisplayName(folder) });
    if (confirm(msg)) {
      onDeleteFolder(folder);
      if (currentFolder === folder || currentFolder.startsWith(folder + '/')) {
        setCurrentFolder('/');
      }
    }
    setFolderContextMenu(null);
  };

  return (
    <div className="game-library">
      <div className="library-header">
        <h2>{t('library.heading', 'Library')}</h2>
        {!isMobile && (
          <div className="library-actions">
            <button onClick={() => setShowNewFolder(!showNewFolder)} title={t('library.newFolder')}>
              📁
            </button>
            <button onClick={onNewGame} title={t('library.newFile')}>
              ＋
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="library-breadcrumb">
        <span
          className={`breadcrumb-item ${currentFolder === '/' ? 'active' : ''} ${dragOverFolder === '/' ? 'drag-over' : ''}`}
          onClick={() => setCurrentFolder('/')}
          onDragOver={isMobile ? undefined : (e) => handleDragOver(e, '/')}
          onDragLeave={isMobile ? undefined : handleDragLeave}
          onDrop={isMobile ? undefined : (e) => handleDrop(e, '/')}
        >
          {t('library.all')}
        </span>
        {currentFolder !== '/' &&
          currentFolder
            .split('/')
            .filter(Boolean)
            .map((part, i, arr) => {
              const path = '/' + arr.slice(0, i + 1).join('/');
              return (
                <span key={path}>
                  <span className="breadcrumb-sep"> / </span>
                  <span
                    className={`breadcrumb-item ${path === currentFolder ? 'active' : ''}`}
                    onClick={() => setCurrentFolder(path)}
                  >
                    {part}
                  </span>
                </span>
              );
            })}
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="new-folder-row">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder={t('library.folderPlaceholder')}
            autoFocus
          />
          <button
            className="inline-icon-btn confirm"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            title={t('library.create')}
          >
            ✓
          </button>
          <button
            className="inline-icon-btn cancel"
            onClick={() => setShowNewFolder(false)}
            title={t('dialog.cancel', 'Cancel')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Subfolders */}
      {parentFolder !== null && (
        <div
          className={`library-folder ${dragOverFolder === parentFolder ? 'drag-over' : ''}`}
          onClick={() => setCurrentFolder(parentFolder)}
          onDragOver={isMobile ? undefined : (e) => handleDragOver(e, parentFolder)}
          onDragLeave={isMobile ? undefined : handleDragLeave}
          onDrop={isMobile ? undefined : (e) => handleDrop(e, parentFolder)}
        >
          <span className="folder-icon">📁</span>
          <span className="folder-name">..</span>
        </div>
      )}
      {subfolders.map((folder) => (
        <div
          key={folder}
          className={`library-folder ${dragOverFolder === folder ? 'drag-over' : ''}`}
          onClick={() => setCurrentFolder(folder)}
          onContextMenu={(e) => handleFolderContextMenu(e, folder)}
          draggable={!isMobile}
          onDragStart={isMobile ? undefined : (e) => handleFolderDragStart(e, folder)}
          onDragOver={isMobile ? undefined : (e) => handleDragOver(e, folder)}
          onDragLeave={isMobile ? undefined : handleDragLeave}
          onDrop={isMobile ? undefined : (e) => handleDrop(e, folder)}
        >
          <span className="folder-icon">📁</span>
          {renamingFolder === folder ? (
            <input
              className="rename-input"
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onBlur={handleFinishFolderRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishFolderRename();
                if (e.key === 'Escape') setRenamingFolder(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <>
              <span className="folder-name">{folderDisplayName(folder)}</span>
              <span className="folder-count">{getGamesInFolder(folder).length}</span>
            </>
          )}
        </div>
      ))}

      {/* Games */}
      {gamesInFolder.map((game) => (
        <div
          key={game.id}
          className={`library-game ${game.id === currentGameId ? 'active' : ''}`}
          onClick={() => onSelectGame(game)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setGameContextMenu({ x: e.clientX, y: e.clientY, gameId: game.id });
          }}
          draggable={!isMobile}
          onDragStart={isMobile ? undefined : (e) => handleDragStart(e, game.id)}
        >
          {editingId === game.id ? (
            <input
              className="rename-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleFinishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div className="game-info">
              <span className="game-name">{game.name}</span>
              <span className="game-meta">
                {formatDate(game.updatedAt)}
                {game.videoId && ' 🎬'}
                {Object.keys(game.timestamps).length > 0 && ' ⏱'}
              </span>
            </div>
          )}
        </div>
      ))}

      {gamesInFolder.length === 0 && subfolders.length === 0 && (
        <div className="library-empty">{t('library.noGames')}</div>
      )}

      {folderContextMenu && (
        <div className="folder-context-menu" style={{ top: folderContextMenu.y, left: folderContextMenu.x }}>
          {!isMobile && <button onClick={handleStartFolderRename}>{t('library.rename')}</button>}
          <button onClick={handleDeleteFolderAction}>{t('library.delete')}</button>
        </div>
      )}

      {gameContextMenu && (
        <div className="folder-context-menu" style={{ top: gameContextMenu.y, left: gameContextMenu.x }}>
          {!isMobile && (
            <button
              onClick={() => {
                const game = gamesInFolder.find((g) => g.id === gameContextMenu.gameId);
                if (game) handleStartRename(game);
                setGameContextMenu(null);
              }}
            >
              {t('library.rename')}
            </button>
          )}
          {!isMobile && (
            <button
              onClick={() => {
                onCloneGame(gameContextMenu.gameId);
                setGameContextMenu(null);
              }}
            >
              {t('library.clone')}
            </button>
          )}
          <button
            onClick={() => {
              const game = gamesInFolder.find((g) => g.id === gameContextMenu.gameId);
              if (game && confirm(t('library.confirmDeleteGame', { name: game.name }))) {
                onDeleteGame(gameContextMenu.gameId);
              }
              setGameContextMenu(null);
            }}
          >
            {t('library.delete')}
          </button>
          {playlists.length > 0 && (
            <div className="context-menu-item-with-submenu">
              <button className="context-submenu-trigger">{t('playlist.addTo', 'Add to playlist')} ▸</button>
              <div className="context-submenu">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      onAddToPlaylist(pl.id, gameContextMenu.gameId);
                      setGameContextMenu(null);
                    }}
                  >
                    {pl.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PlaylistSection
        playlists={playlists}
        games={games}
        activePlaylistId={activePlaylistId}
        onCreatePlaylist={onCreatePlaylist}
        onSelectPlaylist={onSelectPlaylist}
        onDeletePlaylist={onDeletePlaylist}
        onRenamePlaylist={onRenamePlaylist}
      />
    </div>
  );
}
