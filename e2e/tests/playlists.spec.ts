import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';

test.describe('Playlists', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await mockYouTubePlayer(page);
    await app.clearAndGoto();
  });

  test.describe('Playlist creation and browsing', () => {
    test('create a new playlist from library sidebar', async ({ page }) => {
      await app.openLibrary();
      await expect(app.playlistSection).toBeVisible();

      await app.createPlaylist('My Study Plan');

      await expect(app.playlistItems).toHaveCount(1);
      await expect(page.locator('.playlist-name')).toHaveText('My Study Plan');
    });

    test('playlist shows correct game count', async ({ page }) => {
      // Create two games
      await app.createNewGame('Game A');
      await app.openLibrary();
      await app.createNewGame('Game B');
      await app.openLibrary();

      // Create playlist and add games
      await app.createPlaylist('Counted');
      await expect(page.locator('.playlist-count')).toHaveText('(0)');
    });

    test('cancel playlist creation', async ({ page }) => {
      await app.openLibrary();
      await app.playlistAddBtn.click();
      await expect(app.playlistCreateInput).toBeVisible();
      await app.playlistCreateCancel.click();
      await expect(app.playlistCreateInput).not.toBeVisible();
    });

    test('click playlist opens playlist view', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('View Test');
      await app.openPlaylist('View Test');

      await expect(app.playlistView).toBeVisible();
      await expect(page.locator('.playlist-view-title')).toContainText('View Test');
    });

    test('back button returns to library', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Back Test');
      await app.openPlaylist('Back Test');
      await expect(app.playlistView).toBeVisible();

      await app.playlistBackBtn.click();
      await expect(app.playlistView).not.toBeVisible();
      await expect(app.playlistSection).toBeVisible();
    });

    test('empty playlist shows message', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Empty PL');
      await app.openPlaylist('Empty PL');

      await expect(page.locator('.playlist-empty-view')).toBeVisible();
    });

    test('duplicate playlist name is auto-suffixed', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Dup');
      await app.createPlaylist('Dup');

      const names = app.page.locator('.playlist-name');
      await expect(names).toHaveCount(2);
      await expect(names.nth(0)).toHaveText('Dup');
      await expect(names.nth(1)).toHaveText('Dup (2)');
    });
  });

  test.describe('Adding games to playlist', () => {
    test('add games via game picker', async ({ page }) => {
      // Create games first
      await app.createNewGame('Alpha');
      await app.openLibrary();
      await app.createNewGame('Beta');
      await app.openLibrary();

      // Create playlist and open it
      await app.createPlaylist('Picker Test');
      await app.openPlaylist('Picker Test');

      // Click "Add Games" button
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      await expect(app.gamePickerDialog).toBeVisible();

      // Select both games
      await app.gamePickerDialog.locator('.game-picker-item').nth(0).locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('.game-picker-item').nth(1).locator('input[type="checkbox"]').check();

      // Confirm
      await app.gamePickerDialog.locator('button:has-text("Add")').click();
      await expect(app.gamePickerDialog).not.toBeVisible();

      // Games should appear in the playlist
      await expect(app.playlistGameItems).toHaveCount(2);
    });

    test('game picker filter works', async ({ page }) => {
      await app.createNewGame('Sicilian');
      await app.openLibrary();
      await app.createNewGame('French');
      await app.openLibrary();

      await app.createPlaylist('Filter PL');
      await app.openPlaylist('Filter PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();

      // Type filter
      await page.locator('.game-picker-filter').fill('Sic');
      const items = app.gamePickerDialog.locator('.game-picker-item');
      await expect(items).toHaveCount(1);
      await expect(items.first().locator('.game-picker-name')).toHaveText('Sicilian');
    });

    test('add to playlist via game context menu', async ({ page }) => {
      await app.createNewGame('Context Game');
      await app.openLibrary();

      // Create a playlist first
      await app.createPlaylist('Context PL');

      // Right-click the game
      await app.rightClickGame('Context Game');

      // Hover over "Add to playlist" to reveal submenu
      await page.locator('.context-submenu-trigger').hover();
      await page.locator('.context-submenu button:has-text("Context PL")').click();

      // Toast should confirm
      await expect(app.toast).toBeVisible({ timeout: 5000 });

      // Open the playlist and verify
      await app.openPlaylist('Context PL');
      await expect(app.playlistGameItems).toHaveCount(1);
    });
  });

  test.describe('Playlist playback', () => {
    test('Play All loads first game and shows Now Playing bar', async ({ page }) => {
      // Create games
      await app.createNewGame('First Game');
      await app.openLibrary();
      await app.createNewGame('Second Game');
      await app.openLibrary();

      // Create playlist with games
      await app.createPlaylist('Play PL');
      await app.openPlaylist('Play PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      await app.gamePickerDialog.locator('.game-picker-item').nth(0).locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('.game-picker-item').nth(1).locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('button:has-text("Add")').click();

      // Play all
      await app.playlistPlayAllBtn.click();

      // Now Playing bar should be visible
      await expect(app.nowPlayingBar).toBeVisible();
      await expect(app.nowPlayingName).toHaveText('Play PL');
      await expect(app.nowPlayingPosition).toHaveText('1/2');
    });

    test('next/prev navigation updates position', async ({ page }) => {
      await app.createNewGame('Nav A');
      await app.openLibrary();
      await app.createNewGame('Nav B');
      await app.openLibrary();
      await app.createNewGame('Nav C');
      await app.openLibrary();

      await app.createPlaylist('Nav PL');
      await app.openPlaylist('Nav PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      for (let i = 0; i < 3; i++) {
        await app.gamePickerDialog.locator('.game-picker-item').nth(i).locator('input[type="checkbox"]').check();
      }
      await app.gamePickerDialog.locator('button:has-text("Add")').click();
      await app.playlistPlayAllBtn.click();

      await expect(app.nowPlayingPosition).toHaveText('1/3');

      // Next
      await app.nowPlayingNext.click();
      await expect(app.nowPlayingPosition).toHaveText('2/3');

      // Next again
      await app.nowPlayingNext.click();
      await expect(app.nowPlayingPosition).toHaveText('3/3');

      // Next at end should stay (button disabled)
      await expect(app.nowPlayingNext).toBeDisabled();

      // Prev
      await app.nowPlayingPrev.click();
      await expect(app.nowPlayingPosition).toHaveText('2/3');
    });

    test('exit playlist hides Now Playing bar', async ({ page }) => {
      await app.createNewGame('Exit Game');
      await app.openLibrary();

      await app.createPlaylist('Exit PL');
      await app.openPlaylist('Exit PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      await app.gamePickerDialog.locator('.game-picker-item').first().locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('button:has-text("Add")').click();
      await app.playlistPlayAllBtn.click();

      await expect(app.nowPlayingBar).toBeVisible();

      // Exit
      await app.nowPlayingExit.click();
      await expect(app.nowPlayingBar).not.toBeVisible();
    });
  });

  test.describe('Playlist editing', () => {
    test('remove game from playlist', async ({ page }) => {
      await app.createNewGame('Remove Me');
      await app.openLibrary();

      await app.createPlaylist('Remove PL');
      await app.openPlaylist('Remove PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      await app.gamePickerDialog.locator('.game-picker-item').first().locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('button:has-text("Add")').click();

      await expect(app.playlistGameItems).toHaveCount(1);

      // Hover to reveal remove button, then click
      await app.playlistGameItems.first().hover();
      await page.locator('.playlist-remove-btn').first().click();

      await expect(app.playlistGameItems).toHaveCount(0);
    });

    test('delete playlist via context menu', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Delete Me');
      await expect(app.playlistItems).toHaveCount(1);

      await app.rightClickPlaylist('Delete Me');
      await app.contextMenu.locator('button:has-text("Delete")').click();

      await expect(app.playlistItems).toHaveCount(0);
    });

    test('rename playlist via context menu', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Old Name');

      await app.rightClickPlaylist('Old Name');
      await app.contextMenu.locator('button:has-text("Rename")').click();

      const renameInput = page.locator('.playlist-rename-input');
      await expect(renameInput).toBeVisible();
      await renameInput.fill('New Name');
      await renameInput.press('Enter');

      await expect(page.locator('.playlist-name')).toHaveText('New Name');
    });
  });

  test.describe('Edge cases', () => {
    test('deleted library game is removed from playlist on open', async ({ page }) => {
      await app.createNewGame('Stale Game');
      await app.openLibrary();

      await app.createPlaylist('Stale PL');
      await app.openPlaylist('Stale PL');
      await page.locator('.playlist-action-btn:has-text("Add Games")').click();
      await app.gamePickerDialog.locator('.game-picker-item').first().locator('input[type="checkbox"]').check();
      await app.gamePickerDialog.locator('button:has-text("Add")').click();
      await expect(app.playlistGameItems).toHaveCount(1);

      // Go back and delete the game
      await app.playlistBackBtn.click();
      await app.rightClickGame('Stale Game');
      page.on('dialog', (dialog) => dialog.accept());
      await app.contextMenu.locator('button:has-text("Delete")').click();

      // Re-open playlist — stale entry should be cleaned up
      await app.openLibrary();
      await app.openPlaylist('Stale PL');
      await expect(page.locator('.playlist-empty-view')).toBeVisible();
    });

    test('playlists persist across page reload', async ({ page }) => {
      await app.openLibrary();
      await app.createPlaylist('Persist PL');
      await expect(app.playlistItems).toHaveCount(1);

      // Reload
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await app.openLibrary();

      await expect(app.playlistItems).toHaveCount(1);
      await expect(page.locator('.playlist-name')).toHaveText('Persist PL');
    });
  });
});
