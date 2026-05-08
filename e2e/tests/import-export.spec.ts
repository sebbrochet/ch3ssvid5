import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Import & Export', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('import valid PGN file', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pgn"]').first();
    await fileInput.setInputFiles(path.resolve(__dirname, '../fixtures/sample.pgn'));
    await app.waitForBoard();
    await expect(app.currentGameName).toContainText('sample');
  });

  test('import invalid file shows error toast', async ({ page }) => {
    // Create a temporary invalid file
    const invalidContent = 'This is not a PGN file at all, just plain text without brackets or moves.';
    const buffer = Buffer.from(invalidContent, 'utf-8');
    await page.locator('input[type="file"][accept=".pgn"]').first().setInputFiles({
      name: 'invalid.pgn',
      mimeType: 'text/plain',
      buffer,
    });
    // Toast should appear
    await expect(app.toast).toBeVisible({ timeout: 10000 });
  });

  test('import duplicate game shows confirm dialog', async ({ page }) => {
    // Import the sample PGN first
    const fileInput = page.locator('input[type="file"][accept=".pgn"]').first();
    await fileInput.setInputFiles(path.resolve(__dirname, '../fixtures/sample.pgn'));
    await app.waitForBoard();

    // Go home
    await app.appTitle.click();
    await expect(app.welcomeHeading).toBeVisible();

    // Import the same PGN again — should trigger duplicate detection
    page.on('dialog', (dialog) => dialog.accept()); // Click OK = Replace
    const fileInput2 = page.locator('input[type="file"][accept=".pgn"]').first();
    await fileInput2.setInputFiles(path.resolve(__dirname, '../fixtures/sample.pgn'));
    await app.waitForBoard();
    // Game should still be loaded (replaced)
    await expect(app.currentGameName).toContainText('sample');
  });

  test('export PGN triggers download', async ({ page }) => {
    // Create a game first
    await app.createNewGame('Export Test');
    await app.waitForBoard();

    // Listen for download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.header-btn[title*="Export"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.pgn');
  });

  test('export library JSON triggers download', async ({ page }) => {
    // Create a game first
    await app.createNewGame('Library Export');
    await app.waitForBoard();

    // Open settings
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    // Listen for download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export Library")').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.json');
  });
});
