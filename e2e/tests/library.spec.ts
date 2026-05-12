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

  test('drag game into folder', async ({ page }) => {
    // Create a game and a folder
    await app.createNewGame('Drag Me');
    await app.waitForBoard();
    await app.openLibrary();
    await page.locator('.library-actions button').first().click();
    const folderInput = page.locator('.new-folder-row input');
    await folderInput.fill('Target');
    await folderInput.press('Enter');
    await expect(page.locator('.library-folder .folder-name:text("Target")')).toBeVisible();

    // Drag game onto folder
    const game = page.locator('.library-game .game-name:text("Drag Me")');
    const folder = page.locator('.library-folder .folder-name:text("Target")').locator('..');
    await game.dragTo(folder);

    // Game should no longer be visible at root
    await expect(page.locator('.library-game .game-name:text("Drag Me")')).not.toBeVisible();

    // Navigate into folder — game should be there
    await page.locator('.library-folder .folder-name:text("Target")').click();
    await expect(page.locator('.library-game .game-name:text("Drag Me")')).toBeVisible();
  });

  test('drag folder into another folder', async ({ page }) => {
    await app.openLibrary();

    // Create two folders
    await page.locator('.library-actions button').first().click();
    const folderInput = page.locator('.new-folder-row input');
    await folderInput.fill('Parent');
    await folderInput.press('Enter');
    await expect(page.locator('.library-folder .folder-name:text("Parent")')).toBeVisible();

    await page.locator('.library-actions button').first().click();
    const folderInput2 = page.locator('.new-folder-row input');
    await folderInput2.fill('Child');
    await folderInput2.press('Enter');
    await expect(page.locator('.library-folder .folder-name:text("Child")')).toBeVisible();

    // Drag Child onto Parent
    const child = page.locator('.library-folder:has(.folder-name:text("Child"))');
    const parent = page.locator('.library-folder:has(.folder-name:text("Parent"))');
    await child.dragTo(parent);

    // Child should no longer be visible at root
    await expect(page.locator('.library-folder .folder-name:text("Child")')).not.toBeVisible();

    // Navigate into Parent — Child should be there
    await page.locator('.library-folder .folder-name:text("Parent")').click();
    await expect(page.locator('.library-folder .folder-name:text("Child")')).toBeVisible();
  });

  test('drag folder to parent via breadcrumb', async ({ page }) => {
    await app.openLibrary();

    // Create nested structure: Parent/Child
    await page.locator('.library-actions button').first().click();
    const folderInput = page.locator('.new-folder-row input');
    await folderInput.fill('Parent');
    await folderInput.press('Enter');

    // Navigate into Parent and create Child
    await page.locator('.library-folder .folder-name:text("Parent")').click();
    await page.locator('.library-actions button').first().click();
    const folderInput2 = page.locator('.new-folder-row input');
    await folderInput2.fill('Child');
    await folderInput2.press('Enter');
    await expect(page.locator('.library-folder .folder-name:text("Child")')).toBeVisible();

    // Drag Child onto root breadcrumb to move it to root
    const child = page.locator('.library-folder:has(.folder-name:text("Child"))');
    const rootBreadcrumb = page.locator('.breadcrumb-item:text("All")');
    await child.dragTo(rootBreadcrumb);

    // Navigate back to root
    await rootBreadcrumb.click();

    // Child should now be at root level alongside Parent
    await expect(page.locator('.library-folder .folder-name:text("Child")')).toBeVisible();
    await expect(page.locator('.library-folder .folder-name:text("Parent")')).toBeVisible();
  });
});
