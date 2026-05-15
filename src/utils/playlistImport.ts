/**
 * YouTube playlist import utilities.
 *
 * Fetches playlist metadata from Invidious/Piped public APIs (no API key required),
 * sanitizes names for filesystem compatibility, and creates library games.
 */

// ---------------------------------------------------------------------------
// URL Parsing
// ---------------------------------------------------------------------------

/** Extract a YouTube playlist ID from a URL, or null if not a playlist URL. */
export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtu.be') return null;
    return parsed.searchParams.get('list');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Name Sanitization
// ---------------------------------------------------------------------------

const UNSAFE_CHARS = /[<>:"/\\|?*#[\]]/g;
const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0E\uFE0F]/gu;
const UNICODE_WHITESPACE = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const SMART_SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B]/g;
const SMART_DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F]/g;
const UNICODE_DASHES = /[\u2013\u2014\u2015]/g;
const NON_ASCII_SYMBOLS = /[^\p{L}\p{M}\p{N}\x20-\x7E]/gu;
const CONSECUTIVE_SPACES = /\s{2,}/g;
const MAX_NAME_LENGTH = 200;

/** Sanitize a string for use as a folder or game name. */
export function sanitizeName(raw: string): string {
  let name = raw
    .replace(UNICODE_WHITESPACE, ' ')
    .replace(SMART_SINGLE_QUOTES, "'")
    .replace(SMART_DOUBLE_QUOTES, '')
    .replace(UNICODE_DASHES, '-')
    .replace(UNSAFE_CHARS, '')
    .replace(EMOJI, '')
    .replace(NON_ASCII_SYMBOLS, '')
    .replace(CONSECUTIVE_SPACES, ' ')
    .trim();
  if (name.length > MAX_NAME_LENGTH) {
    name = name.slice(0, MAX_NAME_LENGTH);
    const lastSpace = name.lastIndexOf(' ');
    if (lastSpace > MAX_NAME_LENGTH * 0.5) {
      name = name.slice(0, lastSpace);
    }
    name = name.trim();
  }
  return name;
}

// ---------------------------------------------------------------------------
// Invidious / Piped API Client
// ---------------------------------------------------------------------------

export interface PlaylistVideo {
  title: string;
  videoId: string;
  index: number;
  lengthSeconds: number;
  publishedAt?: number; // Unix timestamp (seconds)
}

export interface PlaylistData {
  title: string;
  author: string;
  videoCount: number;
  videos: PlaylistVideo[];
}

const INVIDIOUS_INSTANCES = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de', 'https://invidious.jing.rocks'];

const PIPED_INSTANCES = ['https://pipedapi.kavin.rocks', 'https://api.piped.yt'];

const FETCH_TIMEOUT = 8000;

const LAST_INSTANCE_KEY = 'ch3ssvid5-last-api-instance';

function getLastInstance(): string | null {
  try {
    return localStorage.getItem(LAST_INSTANCE_KEY);
  } catch {
    return null;
  }
}

function saveLastInstance(url: string): void {
  try {
    localStorage.setItem(LAST_INSTANCE_KEY, url);
  } catch {
    /* ignore */
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

function isPrivateVideo(title: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase();
  return lower === '[private video]' || lower === '[deleted video]';
}

/** Fetch playlist data from an Invidious instance. */
async function fetchFromInvidious(instance: string, playlistId: string): Promise<PlaylistData> {
  const allVideos: PlaylistVideo[] = [];
  let page = 1;
  let title = '';
  let author = '';
  let videoCount = 0;

  // Paginate until we get all videos
  while (true) {
    const url = `${instance}/api/v1/playlists/${encodeURIComponent(playlistId)}?page=${page}`;
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (page === 1) {
      title = data.title ?? '';
      author = data.author ?? '';
      videoCount = data.videoCount ?? 0;
    }

    const videos: PlaylistVideo[] = (data.videos ?? [])
      .filter((v: { title?: string }) => !isPrivateVideo(v.title ?? ''))
      .map((v: { title?: string; videoId?: string; index?: number; lengthSeconds?: number; published?: number }) => ({
        title: v.title ?? '',
        videoId: v.videoId ?? '',
        index: v.index ?? 0,
        lengthSeconds: v.lengthSeconds ?? 0,
        publishedAt: v.published ?? undefined,
      }));

    if (videos.length === 0) break;
    allVideos.push(...videos);

    // Invidious returns empty videos array when there are no more pages
    if (allVideos.length >= videoCount) break;
    page++;
  }

  return { title, author, videoCount, videos: allVideos };
}

/** Fetch playlist data from a Piped instance. */
async function fetchFromPiped(instance: string, playlistId: string): Promise<PlaylistData> {
  const url = `${instance}/playlists/${encodeURIComponent(playlistId)}`;
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  const videos: PlaylistVideo[] = (data.relatedStreams ?? [])
    .filter((v: { title?: string }) => !isPrivateVideo(v.title ?? ''))
    .map((v: { title?: string; url?: string; duration?: number; uploaded?: number }, i: number) => ({
      title: v.title ?? '',
      videoId: (v.url ?? '').replace('/watch?v=', ''),
      index: i,
      lengthSeconds: v.duration ?? 0,
      publishedAt: v.uploaded ? Math.floor(v.uploaded / 1000) : undefined,
    }));

  return {
    title: data.name ?? '',
    author: data.uploaderName ?? data.uploader ?? '',
    videoCount: videos.length,
    videos,
  };
}

/** Fetch playlist data, trying Invidious instances first, then Piped as fallback.
 *  Remembers the last working instance and tries it first on subsequent calls. */
export async function fetchPlaylist(playlistId: string, onProgress?: (message: string) => void): Promise<PlaylistData> {
  const errors: string[] = [];
  const lastInstance = getLastInstance();

  // Build ordered list: last successful instance first, then remaining
  const invidiousOrdered =
    lastInstance && INVIDIOUS_INSTANCES.includes(lastInstance)
      ? [lastInstance, ...INVIDIOUS_INSTANCES.filter((i) => i !== lastInstance)]
      : INVIDIOUS_INSTANCES;
  const pipedOrdered =
    lastInstance && PIPED_INSTANCES.includes(lastInstance)
      ? [lastInstance, ...PIPED_INSTANCES.filter((i) => i !== lastInstance)]
      : PIPED_INSTANCES;

  for (const instance of invidiousOrdered) {
    try {
      onProgress?.(`Trying ${new URL(instance).hostname}...`);
      const result = await fetchFromInvidious(instance, playlistId);
      saveLastInstance(instance);
      return result;
    } catch (e) {
      errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  for (const instance of pipedOrdered) {
    try {
      onProgress?.(`Trying ${new URL(instance).hostname}...`);
      const result = await fetchFromPiped(instance, playlistId);
      saveLastInstance(instance);
      return result;
    } catch (e) {
      errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(`All API instances failed:\n${errors.join('\n')}`);
}

// ---------------------------------------------------------------------------
// Duplicate Detection
// ---------------------------------------------------------------------------

/** Check if a VideoURL already exists among games in a specific folder. */
export function findExistingVideoUrl(
  games: { pgn: string; folder: string }[],
  videoId: string,
  folder: string,
): boolean {
  return games.some(
    (g) =>
      g.folder === folder &&
      (g.pgn.includes(`youtu.be/${videoId}`) || g.pgn.includes(`youtube.com/watch?v=${videoId}`)),
  );
}

/** Format a unix timestamp (seconds) to PGN date format YYYY.MM.DD. */
export function formatPgnDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

/** Build the PGN for an imported video with full Seven Tag Roster + metadata headers. */
export function buildVideoPgn(
  videoId: string,
  options?: { publishedAt?: number; videoTitle?: string; playlistTitle?: string },
): string {
  const date = options?.publishedAt ? formatPgnDate(options.publishedAt) : '????.??.??';
  const headers = [
    '[Event "?"]',
    '[Site "?"]',
    `[Date "${date}"]`,
    '[White "?"]',
    '[Black "?"]',
    '[Result "*"]',
    `[VideoURL "https://youtu.be/${videoId}"]`,
  ];
  if (options?.videoTitle) {
    headers.push(`[VideoTitle "${options.videoTitle}"]`);
  }
  if (options?.playlistTitle) {
    headers.push(`[VideoPlaylist "${options.playlistTitle}"]`);
  }
  return headers.join('\n') + '\n\n*';
}
