import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  extractPlaylistId,
  fetchPlaylist,
  sanitizeName,
  findExistingVideoUrl,
  buildVideoPgn,
  type PlaylistData,
  type PlaylistVideo,
} from '../utils/playlistImport';
import type { StoredGame } from '../types';
import './SaveGameDialog.css';
import './ImportPlaylistDialog.css';

interface Props {
  games: StoredGame[];
  onImport: (imports: { name: string; pgn: string; folder: string; videoId: string }[]) => void;
  onCancel: () => void;
}

type DialogState = 'empty' | 'loading' | 'preview' | 'importing' | 'error';

export function ImportPlaylistDialog({ games, onImport, onCancel }: Props) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DialogState>('empty');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());

  // Advanced section
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxVideos, setMaxVideos] = useState('');
  const [filter, setFilter] = useState('');

  // Editable folder names (initialized from API, user can override)
  const [channelName, setChannelName] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const folder = channelName && playlistName ? `/${channelName}/${playlistName}` : '';

  const handleFetch = useCallback(async () => {
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      setError(t('importPlaylist.invalidUrl'));
      setState('error');
      return;
    }

    setState('loading');
    setError('');
    setProgress('');

    try {
      const data = await fetchPlaylist(playlistId, setProgress);

      if (data.videos.length === 0) {
        setError(t('importPlaylist.emptyPlaylist'));
        setState('error');
        return;
      }

      setPlaylist(data);

      // Initialize editable names from API
      const ch = sanitizeName(data.author);
      const pl = sanitizeName(data.title);
      setChannelName(ch);
      setPlaylistName(pl);

      // Determine which videos already exist in target folder
      const targetFolder = `/${ch}/${pl}`;
      const existing = new Set<string>();
      const selectable = new Set<string>();

      for (const video of data.videos) {
        if (findExistingVideoUrl(games, video.videoId, targetFolder)) {
          existing.add(video.videoId);
        } else {
          selectable.add(video.videoId);
        }
      }

      setExistingIds(existing);
      setSelected(selectable);
      setState('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('importPlaylist.fetchError'));
      setState('error');
    }
  }, [url, games, t]);

  const toggleVideo = (videoId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!playlist) return;
    const importable = playlist.videos.filter((v) => !existingIds.has(v.videoId));
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((v) => v.videoId)));
    }
  };

  const getFilteredVideos = (): PlaylistVideo[] => {
    if (!playlist) return [];
    let videos = playlist.videos;

    // Apply text filter
    if (filter.trim()) {
      try {
        // Try as regex if it looks like one
        if (filter.startsWith('/') && filter.lastIndexOf('/') > 0) {
          const lastSlash = filter.lastIndexOf('/');
          const pattern = filter.slice(1, lastSlash);
          const flags = filter.slice(lastSlash + 1) || 'i';
          // eslint-disable-next-line security/detect-non-literal-regexp
          const re = new RegExp(pattern, flags);
          videos = videos.filter((v) => re.test(v.title));
        } else {
          // Glob-like: convert * to .* for simple matching
          const pattern = filter
            .trim()
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*');
          // eslint-disable-next-line security/detect-non-literal-regexp
          const re = new RegExp(`^${pattern}$`, 'i');
          videos = videos.filter((v) => re.test(v.title));
        }
      } catch {
        // Invalid pattern — show all
      }
    }

    // Apply max videos cap
    const max = parseInt(maxVideos, 10);
    if (max > 0) {
      videos = videos.slice(0, max);
    }

    return videos;
  };

  const handleImport = () => {
    if (!playlist || !folder) return;

    const videosToImport = getFilteredVideos().filter((v) => selected.has(v.videoId) && !existingIds.has(v.videoId));

    if (videosToImport.length === 0) return;

    setState('importing');

    const imports = videosToImport.map((video) => ({
      name: video.title,
      pgn: buildVideoPgn(video.videoId, {
        publishedAt: video.publishedAt,
        videoTitle: video.title,
        playlistTitle: playlist?.title,
      }),
      folder,
      videoId: video.videoId,
    }));

    onImport(imports);
  };

  const filteredVideos = getFilteredVideos();
  const importableCount = filteredVideos.filter((v) => selected.has(v.videoId) && !existingIds.has(v.videoId)).length;

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog import-playlist-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{t('importPlaylist.heading')}</h2>

        {/* URL Input */}
        <div className="dialog-field">
          <label>{t('importPlaylist.playlistUrl')}</label>
          <div className="playlist-url-row">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('importPlaylist.urlPlaceholder')}
              disabled={state === 'loading' || state === 'importing'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetch();
              }}
            />
            <button onClick={handleFetch} disabled={!url.trim() || state === 'loading' || state === 'importing'}>
              {state === 'loading' ? t('importPlaylist.fetching') : t('importPlaylist.fetch')}
            </button>
          </div>
        </div>

        {/* Loading progress */}
        {state === 'loading' && progress && <div className="playlist-progress">{progress}</div>}

        {/* Error */}
        {state === 'error' && error && (
          <div className="import-url-error">
            {error}
            {url.trim() && (
              <button className="playlist-retry-btn" onClick={handleFetch}>
                {t('importPlaylist.retry')}
              </button>
            )}
          </div>
        )}

        {/* Preview */}
        {state === 'preview' && playlist && (
          <>
            <div className="playlist-meta">
              <div className="dialog-field">
                <label>{t('importPlaylist.channel')}</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(sanitizeName(e.target.value))}
                  className="playlist-editable-name"
                />
              </div>
              <div className="dialog-field">
                <label>{t('importPlaylist.playlist')}</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(sanitizeName(e.target.value))}
                  className="playlist-editable-name"
                />
              </div>
              <div className="dialog-field">
                <label>{t('importPlaylist.folder')}</label>
                <span>{folder}</span>
              </div>
              <div className="dialog-field">
                <label>{t('importPlaylist.videoCount')}</label>
                <span>
                  {playlist.videos.length}
                  {existingIds.size > 0 && ` (${existingIds.size} ${t('importPlaylist.existing')})`}
                </span>
              </div>
            </div>

            {/* Video list */}
            <div className="playlist-video-list">
              <label className="playlist-toggle-all">
                <input
                  type="checkbox"
                  checked={
                    selected.size === filteredVideos.filter((v) => !existingIds.has(v.videoId)).length &&
                    selected.size > 0
                  }
                  onChange={toggleAll}
                />
                {t('importPlaylist.selectAll')}
              </label>
              {filteredVideos.map((video) => {
                const exists = existingIds.has(video.videoId);
                return (
                  <label key={video.videoId} className={`playlist-video-item${exists ? ' exists' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(video.videoId)}
                      disabled={exists}
                      onChange={() => toggleVideo(video.videoId)}
                    />
                    <span className="playlist-video-title">
                      {video.title}
                      {exists && <span className="playlist-exists-badge">{t('importPlaylist.existsBadge')}</span>}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Advanced section */}
            <button className="playlist-advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? '▾' : '▸'} {t('importPlaylist.advanced')}
            </button>
            {showAdvanced && (
              <div className="playlist-advanced">
                <div className="dialog-field">
                  <label>{t('importPlaylist.maxVideos')}</label>
                  <input
                    type="number"
                    min="1"
                    value={maxVideos}
                    onChange={(e) => setMaxVideos(e.target.value)}
                    placeholder={t('importPlaylist.noLimit')}
                  />
                </div>
                <div className="dialog-field">
                  <label>{t('importPlaylist.filter')}</label>
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('importPlaylist.filterPlaceholder')}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div className="dialog-actions">
          <button onClick={onCancel} disabled={state === 'importing'}>
            {t('dialog.cancel')}
          </button>
          {state === 'preview' && (
            <button className="primary" onClick={handleImport} disabled={importableCount === 0}>
              {t('importPlaylist.importCount', { count: importableCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
