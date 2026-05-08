import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Mobile — Portrait', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('board is view-only (no sync/engine controls)', async ({ page }) => {
    await app.createGameViaStorage('Mobile Game');
    await app.openLibrary();
    // On mobile, the library overlays everything — use force for clicks
    await page.locator('.library-game .game-name:text("Mobile Game")').click({ force: true });
    await app.waitForBoard();

    // Sync row should not be visible on mobile
    await expect(app.syncRow).not.toBeVisible();

    // Engine row should not be visible on mobile
    await expect(app.engineRow).not.toBeVisible();
  });

  test('library sidebar opens as overlay with backdrop', async ({ page }) => {
    await app.openLibrary();

    // Backdrop should be visible
    const backdrop = page.locator('.sidebar-backdrop');
    await expect(backdrop).toBeVisible();

    // Library should be visible
    const library = page.locator('.game-library');
    await expect(library).toBeVisible();
  });

  test('library closes on toggle click', async ({ page }) => {
    await app.openLibrary();
    await expect(page.locator('.game-library')).toBeVisible();

    // On mobile, the sidebar overlaps the toggle — use dispatchEvent
    await app.libraryToggle.dispatchEvent('click');

    // Library should be hidden
    await expect(page.locator('.game-library')).not.toBeVisible();
  });

  test('game select auto-closes library sidebar', async ({ page }) => {
    await app.createGameViaStorage('Auto Close Test');

    // Open library and select the game
    await app.openLibrary();
    await page.locator('.library-game .game-name:text("Auto Close Test")').click({ force: true });

    // Library should auto-close on mobile
    await expect(page.locator('.game-library')).not.toBeVisible({ timeout: 3000 });
  });

  test('header shows only icon buttons on mobile', async ({ page }) => {
    const headerActions = page.locator('.header-actions');
    await expect(headerActions).toBeVisible();

    // Share and Receive buttons should be visible
    const shareBtn = page.locator('.header-btn:has-text("🔗")');
    await expect(shareBtn).toBeVisible();
    const receiveBtn = page.locator('.header-btn:has-text("📲")');
    await expect(receiveBtn).toBeVisible();
  });

  test('library hides create buttons on mobile', async ({ page }) => {
    await app.openLibrary();

    // Create folder and create PGN buttons should not be visible
    const libraryActions = page.locator('.library-actions');
    await expect(libraryActions).not.toBeVisible();
  });

  test('game context menu has only Delete on mobile', async ({ page }) => {
    await app.createGameViaStorage('Context Menu Test');
    await app.openLibrary();

    // Long press / right-click the game
    const gameEl = page.locator('.library-game .game-name:text("Context Menu Test")');
    await gameEl.click({ button: 'right', force: true });
    await page.waitForSelector('.folder-context-menu');

    // Only Delete should be visible (no Rename, no Clone)
    const menuButtons = page.locator('.folder-context-menu button');
    await expect(menuButtons).toHaveCount(1);
    await expect(menuButtons.first()).toContainText('Delete');
  });
});

test.describe('Mobile — Landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, isMobile: true });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('landscape layout renders', async ({ page }) => {
    await app.createGameViaStorage('Landscape Game');
    await app.openLibrary();
    await page.locator('.library-game .game-name:text("Landscape Game")').click({ force: true });
    await app.waitForBoard();

    // Board should be visible
    await expect(app.board).toBeVisible();

    // Sync/engine should be hidden in landscape mobile too
    await expect(app.syncRow).not.toBeVisible();
    await expect(app.engineRow).not.toBeVisible();
  });
});
