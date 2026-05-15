import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';

const MOCK_PLAYLIST = {
  title: 'Caro-Kann Masterclass',
  author: 'ChessGeek',
  videoCount: 3,
  videos: [
    { title: 'Chapter 1 - Advanced 4.c3', videoId: 'vid001', index: 0, lengthSeconds: 600, published: 1710460800 },
    { title: 'Chapter 2 - Exchange 3. exd5', videoId: 'vid002', index: 1, lengthSeconds: 500, published: 1710547200 },
    { title: 'Chapter 3 - Fantasy 3. f3', videoId: 'vid003', index: 2, lengthSeconds: 450, published: 1710633600 },
  ],
};

const MOCK_PIPED_PLAYLIST = {
  name: 'Caro-Kann Masterclass',
  uploaderName: 'ChessGeek',
  relatedStreams: [
    { title: 'Chapter 1 - Advanced 4.c3', url: '/watch?v=vid001', duration: 600, uploaded: 1710460800000 },
    { title: 'Chapter 2 - Exchange 3. exd5', url: '/watch?v=vid002', duration: 500, uploaded: 1710547200000 },
    { title: 'Chapter 3 - Fantasy 3. f3', url: '/watch?v=vid003', duration: 450, uploaded: 1710633600000 },
  ],
};

/** Intercept all Invidious and Piped API calls and return mock data via fetch override. */
async function mockPlaylistApi(app: AppPage) {
  const mockInvidious = JSON.stringify(MOCK_PLAYLIST);
  const mockPiped = JSON.stringify(MOCK_PIPED_PLAYLIST);
  await app.page.evaluate(
    ({ mockInvidious, mockPiped }) => {
      const originalFetch = window.fetch;
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/v1/playlists/')) {
          return new Response(mockInvidious, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('pipedapi') || url.includes('api.piped')) {
          return new Response(mockPiped, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return originalFetch.call(window, input, init);
      };
    },
    { mockInvidious, mockPiped },
  );
}

test.describe('Import Playlist — Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.clearAndGoto();
  });

  test('opens import dialog from welcome card', async ({ page }) => {
    // The "Import a playlist" card should be visible on desktop
    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await expect(playlistCard).toBeVisible();
    await playlistCard.click();

    // Dialog should appear
    await expect(page.locator('.import-playlist-dialog')).toBeVisible();
    await expect(page.locator('.import-playlist-dialog h2')).toBeVisible();
  });

  test('shows error for invalid URL', async ({ page }) => {
    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    const urlInput = page.locator('.import-playlist-dialog input[type="text"]').first();
    await urlInput.fill('not-a-valid-url');

    const fetchBtn = page.locator('.playlist-url-row button');
    await fetchBtn.click();

    await expect(page.locator('.import-url-error')).toBeVisible();
  });

  test('fetches playlist and shows preview', async ({ page }) => {
    await mockPlaylistApi(app);

    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    const urlInput = page.locator('.import-playlist-dialog input[type="text"]').first();
    await urlInput.fill('https://www.youtube.com/playlist?list=PLtest123');

    const fetchBtn = page.locator('.playlist-url-row button');
    await fetchBtn.click();

    // Wait for preview to appear
    await expect(page.locator('.playlist-video-list')).toBeVisible({ timeout: 15000 });

    // Channel and playlist names should be shown
    const channelInput = page.locator('.playlist-editable-name').first();
    await expect(channelInput).toHaveValue('ChessGeek');

    const playlistInput = page.locator('.playlist-editable-name').nth(1);
    await expect(playlistInput).toHaveValue('Caro-Kann Masterclass');

    // All 3 videos should be listed
    const videoItems = page.locator('.playlist-video-item');
    await expect(videoItems).toHaveCount(3);
  });

  test('imports selected games into library', async ({ page }) => {
    await mockPlaylistApi(app);

    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    const urlInput = page.locator('.import-playlist-dialog input[type="text"]').first();
    await urlInput.fill('https://www.youtube.com/playlist?list=PLtest123');
    await page.locator('.playlist-url-row button').click();

    // Wait for preview
    await expect(page.locator('.playlist-video-list')).toBeVisible({ timeout: 15000 });
    const importBtn = page.locator('.import-playlist-dialog .dialog-actions button.primary');
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    // Dialog should close
    await expect(page.locator('.import-playlist-dialog')).not.toBeVisible();

    // Open library and verify the channel folder was created with games
    await app.openLibrary();

    // Click into ChessGeek folder, then Caro-Kann Masterclass subfolder
    const channelFolder = page.locator('.library-folder:has-text("ChessGeek")');
    await expect(channelFolder).toBeVisible();
    await channelFolder.click();

    const playlistFolder = page.locator('.library-folder:has-text("Caro-Kann Masterclass")');
    await expect(playlistFolder).toBeVisible();
    await playlistFolder.click();

    // Games should now be visible
    await expect(app.libraryGames).toHaveCount(3);
  });

  test('editable channel name changes folder path', async ({ page }) => {
    await mockPlaylistApi(app);

    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    const urlInput = page.locator('.import-playlist-dialog input[type="text"]').first();
    await urlInput.fill('https://www.youtube.com/playlist?list=PLtest123');
    await page.locator('.playlist-url-row button').click();

    await expect(page.locator('.playlist-video-list')).toBeVisible({ timeout: 15000 });

    // Edit channel name
    const channelInput = page.locator('.playlist-editable-name').first();
    await channelInput.clear();
    await channelInput.fill('ChessGeek1');

    // Folder path should update
    const folderText = page.locator('.playlist-meta .dialog-field span').first();
    await expect(folderText).toContainText('/ChessGeek1/');
  });

  test('retry button appears on fetch error', async ({ page }) => {
    // Mock all API instances to fail via fetch override
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes('/api/v1/playlists/') || url.includes('pipedapi') || url.includes('api.piped')) {
          return new Response('Internal Server Error', { status: 500 });
        }
        return originalFetch.call(window, input, init);
      };
    });

    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    const urlInput = page.locator('.import-playlist-dialog input[type="text"]').first();
    await urlInput.fill('https://www.youtube.com/playlist?list=PLfail');
    await page.locator('.playlist-url-row button').click();

    // Error with retry button should appear (all 5 instances must fail first)
    await expect(page.locator('.import-url-error')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.playlist-retry-btn')).toBeVisible();
  });

  test('cancel closes the dialog', async ({ page }) => {
    const playlistCard = page.locator('.welcome-card:has-text("playlist")');
    await playlistCard.click();

    await expect(page.locator('.import-playlist-dialog')).toBeVisible();

    // Click cancel
    await page.locator('.import-playlist-dialog .dialog-actions button:not(.primary)').click();
    await expect(page.locator('.import-playlist-dialog')).not.toBeVisible();
  });
});
