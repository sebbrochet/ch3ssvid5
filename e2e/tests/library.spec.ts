import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';

test.describe('Library Folders', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test('create folder', async ({ page }) => {
    await app.openLibrary();

    // Click folder creation button
    await page.locator('.library-actions button').first().click();

    // Type folder name and create
    const folderInput = page.locator('.new-folder-row input');
    await expect(folderInput).toBeVisible();
    await folderInput.fill('My Folder');
    await folderInput.press('Enter');

    // Folder should appear
    await expect(page.locator('.library-folder .folder-name:text("My Folder")')).toBeVisible();
  });

  test('navigate into folder and back', async ({ page }) => {
    await app.openLibrary();

    // Create a folder
    await page.locator('.library-actions button').first().click();
    const folderInput = page.locator('.new-folder-row input');
    await folderInput.fill('Sub Folder');
    await folderInput.press('Enter');

    // Navigate into it
    await page.locator('.library-folder .folder-name:text("Sub Folder")').click();

    // Breadcrumb should show the folder
    await expect(page.locator('.library-breadcrumb')).toContainText('Sub Folder');

    // Navigate back via parent (..)
    await page.locator('.library-folder .folder-name:text("..")').click();
    await expect(page.locator('.library-breadcrumb')).not.toContainText('Sub Folder');
  });

  test('folder name with slash is rejected', async ({ page }) => {
    await app.openLibrary();

    // Click folder creation button
    await page.locator('.library-actions button').first().click();
    const folderInput = page.locator('.new-folder-row input');
    await folderInput.fill('invalid/name');
    await folderInput.press('Enter');

    // Toast should appear with error
    await expect(app.toast).toBeVisible({ timeout: 5000 });
  });

  test('delete the only game returns to welcome', async ({ page }) => {
    // Create a game
    await app.createNewGame('Only Game');
    await app.waitForBoard();

    // Open library and delete it
    await app.openLibrary();
    await app.rightClickGame('Only Game');
    page.on('dialog', (dialog) => dialog.accept());
    // Delete is the last context menu button
    await app.contextMenu.locator('button').last().click();

    // Should return to welcome screen
    await expect(app.welcomeHeading).toBeVisible();
  });

  test('keyboard shortcuts with no game loaded', async ({ page }) => {
    // On welcome screen, press navigation keys — should not crash
    await app.pressKey('ArrowRight');
    await app.pressKey('ArrowLeft');
    await app.pressKey('Home');
    await app.pressKey('End');
    await app.pressKey('f');
    await app.pressKey('e');
    await app.pressKey(' ');

    // App should still be on welcome screen, not crashed
    await expect(app.welcomeHeading).toBeVisible();
  });
});
