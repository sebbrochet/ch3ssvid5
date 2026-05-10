const ALLOWED_DOMAINS = [
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'sebbrochet.github.io',
  'ch3ssvid5.sebbrochet.com',
  'ch3ssvid5hub.sebbrochet.com',
  'localhost',
];

const MAX_PGN_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Parse import parameters from the URL query string.
 * Expected format: ?pgn=URL&folder=YouTuber/VideoName
 */
export function parseImportParams(search: string): { pgnUrl: string; folder: string } | null {
  const params = new URLSearchParams(search);
  const pgnUrl = params.get('pgn');
  if (!pgnUrl) return null;

  const folder = sanitizeFolder(params.get('folder') || '');
  return { pgnUrl, folder };
}

/**
 * Check if a hostname is a private/RFC1918 IP address.
 */
function isPrivateIP(hostname: string): boolean {
  // 10.x.x.x
  if (/^10\./.test(hostname)) return true;
  // 172.16.x.x – 172.31.x.x
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  // 192.168.x.x
  if (/^192\.168\./.test(hostname)) return true;
  // 127.x.x.x (loopback)
  if (/^127\./.test(hostname)) return true;
  return false;
}

/**
 * Validate that a PGN URL is from an allowed domain.
 */
export function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (ALLOWED_DOMAINS.includes(parsed.hostname)) return true;
    if (isPrivateIP(parsed.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Sanitize a folder path from URL parameter.
 * - Strips path traversal (..)
 * - Strips control characters
 * - Trims whitespace
 * - Ensures leading /
 * - Strips trailing /
 * - Replaces multiple consecutive / with single /
 */
export function sanitizeFolder(raw: string): string {
  let folder = raw
    .trim()
    // Remove control characters (U+0000-U+001F, U+007F)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    // Remove path traversal
    .replace(/\.\./g, '')
    // Collapse multiple slashes
    .replace(/\/+/g, '/')
    // Trim trailing slash
    .replace(/\/$/, '');

  // Ensure leading /
  if (!folder.startsWith('/')) {
    folder = '/' + folder;
  }

  // If empty after sanitization, use root
  if (folder === '' || folder === '/') {
    return '/';
  }

  return folder;
}

/**
 * Derive a game name from the PGN URL.
 * Uses the filename without extension, or the last path segment.
 */
export function deriveGameName(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'Imported Game';
    return decodeURIComponent(last.replace(/\.pgn$/i, ''));
  } catch {
    return 'Imported Game';
  }
}

/**
 * Fetch a PGN file from a URL with safety checks.
 * Returns the PGN text or throws an error.
 */
export async function fetchPgn(url: string): Promise<string> {
  if (!isAllowedDomain(url)) {
    throw new Error(`Domain not allowed. Only GitHub raw content URLs are supported.`);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch PGN: ${response.status} ${response.statusText}`);
  }

  // Check content length if available
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_PGN_SIZE) {
    throw new Error('PGN file is too large (max 10MB).');
  }

  const text = await response.text();

  if (text.length > MAX_PGN_SIZE) {
    throw new Error('PGN file is too large (max 10MB).');
  }

  // Basic PGN validation
  if (!text.trim() || (!text.includes('[') && !/\d+\./.test(text))) {
    throw new Error('The fetched content does not appear to be a valid PGN file.');
  }

  return text;
}
