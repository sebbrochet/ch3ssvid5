import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';

test.describe('Game Lifecycle', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('create new PGN file', async ({ page }) => {
    await app.createNewGame('My Test Game');
    // Game should be loaded — board visible
    await app.waitForBoard();
    // Game name should appear in header
    await expect(app.currentGameName).toContainText('My Test Game');
  });

  test('create new PGN file with video', async ({ page }) => {
    await app.createNewGame('Video Game', 'https://youtube.com/watch?v=test123');
    await app.waitForBoard();
    // Video panel should appear (not the "No video" placeholder)
    await expect(app.videoPanel).toBeVisible();
    await expect(app.noVideo).not.toBeVisible();
  });

  test('load game from library', async ({ page }) => {
    // Create a game first
    await app.createNewGame('Library Game');
    await app.waitForBoard();

    // Go home
    await app.appTitle.click();
    await expect(app.welcomeHeading).toBeVisible();

    // Open library and select the game
    await app.openLibrary();
    await app.selectGameInLibrary('Library Game');
    await app.waitForBoard();
    await expect(app.currentGameName).toContainText('Library Game');
  });

  test('rename game', async ({ page }) => {
    await app.createNewGame('Original Name');
    await app.waitForBoard();

    await app.openLibrary();
    await app.rightClickGame('Original Name');
    // Click Rename
    await app.contextMenu.locator('button').first().click();
    // Clear and type new name
    const renameInput = page.locator('.rename-input');
    await renameInput.fill('Renamed Game');
    await renameInput.press('Enter');
    // Verify new name
    await expect(page.locator('.game-name:text("Renamed Game")')).toBeVisible();
  });

  test('clone game', async ({ page }) => {
    await app.createNewGame('Clone Source');
    await app.waitForBoard();

    await app.openLibrary();
    await app.rightClickGame('Clone Source');
    // Click Clone (second button)
    await app.contextMenu.locator('button').nth(1).click();
    // Verify clone appears
    await expect(page.locator('.game-name:text("Clone Source (copy)")')).toBeVisible();
  });

  test('delete game', async ({ page }) => {
    await app.createNewGame('To Delete');
    await app.waitForBoard();

    await app.openLibrary();
    await app.rightClickGame('To Delete');
    // Click Delete (third button)
    page.on('dialog', (dialog) => dialog.accept());
    await app.contextMenu.locator('button').nth(2).click();
    // Game should be gone, welcome screen visible
    await expect(app.welcomeHeading).toBeVisible();
  });

  test('go home by clicking title', async () => {
    await app.createNewGame('Temp Game');
    await app.waitForBoard();
    await app.appTitle.click();
    await expect(app.welcomeHeading).toBeVisible();
  });

  test('go home by clicking close button', async () => {
    await app.createNewGame('Temp Game 2');
    await app.waitForBoard();
    const closeBtn = app.currentGameName.locator('.close-game-btn');
    await closeBtn.click();
    await expect(app.welcomeHeading).toBeVisible();
  });
});
