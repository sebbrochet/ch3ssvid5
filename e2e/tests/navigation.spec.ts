import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Move Navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();

    // Import the sample PGN to have moves to navigate
    const fileInput = await page.locator('input[type="file"][accept=".pgn"]').first();
    await fileInput.setInputFiles(path.resolve(__dirname, '../fixtures/sample.pgn'));
    await app.waitForBoard();

    // Go to starting position (video sync may have auto-navigated)
    await app.pressKey('Home');
    // Wait for navigation to starting position
    await expect(page.locator('.tree-move.active')).toHaveCount(0, { timeout: 5000 });
  });

  test('arrow right advances to next move', async () => {
    await app.pressKey('ArrowRight');
    await expect(app.activeMove).toBeVisible();
    await expect(app.activeMove).toContainText('e4');
  });

  test('arrow left goes back', async () => {
    // Go forward twice
    await app.pressKey('ArrowRight');
    await app.pressKey('ArrowRight');
    await expect(app.activeMove).toContainText('e5');

    // Go back once
    await app.pressKey('ArrowLeft');
    await expect(app.activeMove).toContainText('e4');
  });

  test('Home goes to start', async () => {
    // Go forward
    await app.pressKey('ArrowRight');
    await app.pressKey('ArrowRight');

    // Home returns to start
    await app.pressKey('Home');
    // Start position has no active tree-move, but tree-start is active
    const startActive = app.page.locator('.tree-start.active');
    await expect(startActive).toBeVisible();
  });

  test('End goes to last move', async () => {
    await app.pressKey('End');
    await expect(app.activeMove).toContainText('Nf6');
  });

  test('F flips the board', async ({ page }) => {
    // Check initial orientation class
    const boardWrap = page.locator('.cg-wrap');
    const classBefore = await boardWrap.getAttribute('class');

    await app.pressKey('f');
    await page.waitForTimeout(100);

    const classAfter = await boardWrap.getAttribute('class');
    // Chessground adds/changes orientation class
    expect(classBefore).not.toBe(classAfter);
  });

  test('E toggles engine', async () => {
    await expect(app.engineToggle).not.toContainText('ON');

    await app.pressKey('e');
    await expect(app.engineToggle).toContainText('ON');

    await app.pressKey('e');
    await expect(app.engineToggle).not.toContainText('ON');
  });

  test('click move in tree navigates', async () => {
    await app.clickMove('Nf3');
    await expect(app.activeMove).toContainText('Nf3');
  });

  test('shortcuts disabled in text input', async ({ page }) => {
    // Navigate to a move first
    await app.pressKey('ArrowRight');
    await expect(app.activeMove).toContainText('e4');

    // Click "Add comment" to open textarea
    await page.locator('.comment-add-btn').click();
    const commentInput = page.locator('.comment-input');
    await expect(commentInput).toBeVisible();

    // Type 'f' in the comment — should NOT flip the board
    await commentInput.type('f');
    await expect(commentInput).toHaveValue('f');
  });

  test('navigation buttons work', async () => {
    // Next button
    await app.btnNext.click();
    await expect(app.activeMove).toContainText('e4');

    // Next again
    await app.btnNext.click();
    await expect(app.activeMove).toContainText('e5');

    // Prev
    await app.btnPrev.click();
    await expect(app.activeMove).toContainText('e4');

    // First
    await app.btnFirst.click();
    const startActive = app.page.locator('.tree-start.active');
    await expect(startActive).toBeVisible();

    // Last
    await app.btnLast.click();
    await expect(app.activeMove).toContainText('Nf6');
  });
});
