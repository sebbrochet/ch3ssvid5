import { describe, it, expect } from 'vitest';
import { parseImportParams, isAllowedDomain, sanitizeFolder, deriveGameName } from './urlImport';

describe('parseImportParams', () => {
  it('parses pgn and folder parameters', () => {
    const result = parseImportParams(
      '?pgn=https://raw.githubusercontent.com/user/repo/main/game.pgn&folder=GothamChess/Italian',
    );
    expect(result).toEqual({
      pgnUrl: 'https://raw.githubusercontent.com/user/repo/main/game.pgn',
      folder: '/GothamChess/Italian',
    });
  });

  it('returns null when no pgn parameter', () => {
    expect(parseImportParams('?folder=test')).toBeNull();
    expect(parseImportParams('')).toBeNull();
  });

  it('defaults folder to / when not provided', () => {
    const result = parseImportParams('?pgn=https://raw.githubusercontent.com/user/repo/main/game.pgn');
    expect(result?.folder).toBe('/');
  });

  it('sanitizes the folder parameter', () => {
    const result = parseImportParams('?pgn=https://example.com/game.pgn&folder=../../../etc/passwd');
    expect(result?.folder).not.toContain('..');
  });
});

describe('isAllowedDomain', () => {
  it('allows raw.githubusercontent.com', () => {
    expect(isAllowedDomain('https://raw.githubusercontent.com/user/repo/main/game.pgn')).toBe(true);
  });

  it('allows gist.githubusercontent.com', () => {
    expect(isAllowedDomain('https://gist.githubusercontent.com/user/abc/raw/game.pgn')).toBe(true);
  });

  it('allows self-hosted domain (sebbrochet.github.io)', () => {
    expect(isAllowedDomain('https://sebbrochet.github.io/ChessVideoPlayer/samples/game.pgn')).toBe(true);
  });

  it('allows localhost for development', () => {
    expect(isAllowedDomain('http://localhost:5173/samples/game.pgn')).toBe(true);
  });

  it('allows private IP addresses (RFC1918)', () => {
    expect(isAllowedDomain('http://192.168.0.31:5173/samples/game.pgn')).toBe(true);
    expect(isAllowedDomain('http://192.168.1.42:5173/samples/game.pgn')).toBe(true);
    expect(isAllowedDomain('http://10.0.0.1:5173/samples/game.pgn')).toBe(true);
    expect(isAllowedDomain('http://172.16.0.1:5173/samples/game.pgn')).toBe(true);
    expect(isAllowedDomain('http://172.31.255.255:5173/samples/game.pgn')).toBe(true);
    expect(isAllowedDomain('http://127.0.0.1:5173/samples/game.pgn')).toBe(true);
  });

  it('rejects non-private IP addresses', () => {
    expect(isAllowedDomain('http://8.8.8.8/game.pgn')).toBe(false);
    expect(isAllowedDomain('http://172.32.0.1/game.pgn')).toBe(false);
  });

  it('rejects other domains', () => {
    expect(isAllowedDomain('https://evil.com/game.pgn')).toBe(false);
    expect(isAllowedDomain('https://github.com/user/repo/blob/main/game.pgn')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedDomain('not-a-url')).toBe(false);
    expect(isAllowedDomain('')).toBe(false);
  });

  it('rejects file:// URLs', () => {
    expect(isAllowedDomain('file:///etc/passwd')).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isAllowedDomain('javascript:alert(1)')).toBe(false);
  });
});

describe('sanitizeFolder', () => {
  it('adds leading slash', () => {
    expect(sanitizeFolder('GothamChess/Italian')).toBe('/GothamChess/Italian');
  });

  it('strips path traversal', () => {
    expect(sanitizeFolder('../../etc/passwd')).toBe('/etc/passwd');
    expect(sanitizeFolder('/normal/../sneaky')).toBe('/normal/sneaky');
  });

  it('strips control characters', () => {
    expect(sanitizeFolder('/test\x00\x01folder')).toBe('/testfolder');
  });

  it('collapses multiple slashes', () => {
    expect(sanitizeFolder('//a///b//c')).toBe('/a/b/c');
  });

  it('strips trailing slash', () => {
    expect(sanitizeFolder('/folder/')).toBe('/folder');
  });

  it('returns root for empty input', () => {
    expect(sanitizeFolder('')).toBe('/');
    expect(sanitizeFolder('   ')).toBe('/');
  });

  it('preserves normal folder hierarchy', () => {
    expect(sanitizeFolder('Levy/Caro-Kann')).toBe('/Levy/Caro-Kann');
    expect(sanitizeFolder('/Daniel Naroditsky/Speed Run')).toBe('/Daniel Naroditsky/Speed Run');
  });
});

describe('deriveGameName', () => {
  it('extracts filename without extension', () => {
    expect(deriveGameName('https://raw.githubusercontent.com/user/repo/main/Italian-Game.pgn')).toBe('Italian-Game');
  });

  it('uses last path segment if no extension', () => {
    expect(deriveGameName('https://raw.githubusercontent.com/user/repo/main/game')).toBe('game');
  });

  it('returns default for invalid URL', () => {
    expect(deriveGameName('not-a-url')).toBe('Imported Game');
  });

  it('returns default for empty path', () => {
    expect(deriveGameName('https://example.com/')).toBe('Imported Game');
  });
});
