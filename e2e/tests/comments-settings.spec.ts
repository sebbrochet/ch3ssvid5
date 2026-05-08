import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Comments', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();

    // Import sample PGN
    const fileInput = page.locator('input[type="file"][accept=".pgn"]').first();
    await fileInput.setInputFiles(path.resolve(__dirname, '../fixtures/sample.pgn'));
    await app.waitForBoard();
    await app.pressKey('Home');
    // Wait for navigation to starting position
    await expect(page.locator('.tree-move.active')).toHaveCount(0, { timeout: 5000 });
  });

  test('add comment to a move', async ({ page }) => {
    // Navigate to first move
    await app.pressKey('ArrowRight');
    await expect(app.activeMove).toContainText('e4');

    // Click add comment button
    const addBtn = page.locator('.comment-add-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Type a comment
    const commentInput = page.locator('.comment-input');
    await expect(commentInput).toBeVisible();
    await commentInput.fill('Great opening move!');

    // Save with Enter
    await commentInput.press('Enter');

    // Comment should be displayed
    const commentText = page.locator('.comment-text');
    await expect(commentText).toContainText('Great opening move!');
  });

  test('edit existing comment', async ({ page }) => {
    // Navigate to first move and add a comment
    await app.pressKey('ArrowRight');
    const addBtn = page.locator('.comment-add-btn');
    await addBtn.click();
    const commentInput = page.locator('.comment-input');
    await commentInput.fill('Initial comment');
    await commentInput.press('Enter');

    // Click to edit
    await page.locator('.comment-panel').click();
    const editInput = page.locator('.comment-input');
    await expect(editInput).toBeVisible();
    await editInput.fill('Updated comment');
    await editInput.press('Enter');

    await expect(page.locator('.comment-text')).toContainText('Updated comment');
  });

  test('cancel comment edit with Escape', async ({ page }) => {
    // Navigate and add a comment
    await app.pressKey('ArrowRight');
    const addBtn = page.locator('.comment-add-btn');
    await addBtn.click();
    const commentInput = page.locator('.comment-input');
    await commentInput.fill('Test comment');
    await commentInput.press('Enter');

    // Click to edit, then cancel
    await page.locator('.comment-panel').click();
    const editInput = page.locator('.comment-input');
    await editInput.fill('Should be discarded');
    await editInput.press('Escape');

    // Original comment should remain
    await expect(page.locator('.comment-text')).toContainText('Test comment');
  });

  test('no comment panel when at starting position', async () => {
    // At start, no comment panel should be visible
    const commentPanel = app.page.locator('.comment-panel');
    await expect(commentPanel).not.toBeVisible();
  });
});

test.describe('Settings & Video URL', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('settings panel opens and closes', async ({ page }) => {
    // Create a game first
    await app.createNewGame('Settings Test');
    await app.waitForBoard();

    // Open settings
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    // Close settings
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });

  test('load video via settings', async ({ page }) => {
    // Create a game without video
    await app.createNewGame('No Video Game');
    await app.waitForBoard();

    // Should show "No video" placeholder
    await expect(app.noVideo).toBeVisible();

    // Open settings and enter a video URL
    await page.locator('.settings-btn').click();
    const urlInput = page.locator('.settings-panel input[type="text"]');
    await urlInput.fill('https://www.youtube.com/watch?v=test456');
    await page.locator('.settings-panel button:has-text("Load")').click();

    // Close settings panel
    await page.locator('.settings-btn').click();

    // Video panel should appear (mock player may take time to render)
    await expect(page.locator('.video-panel')).toBeVisible({ timeout: 10000 });
    await expect(app.noVideo).not.toBeVisible();
  });
});
