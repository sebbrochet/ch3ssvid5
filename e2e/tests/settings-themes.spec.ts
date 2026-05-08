import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';
import { mockYouTubePlayer } from '../fixtures/youtube-mock';

/** Helper: create a game via localStorage (fast, no UI interaction) and wait for board */
async function setupWithGame(page: import('@playwright/test').Page) {
  const app = new AppPage(page);
  await mockYouTubePlayer(page);
  await app.clearAndGoto();
  await app.createGameViaStorage('Theme Test');
  await app.openLibrary();
  await page.locator('.library-game .game-name:text("Theme Test")').click();
  await app.waitForBoard();
  return app;
}

/** Helper: reload and re-select the game (reload goes back to welcome screen) */
async function reloadAndSelectGame(page: import('@playwright/test').Page, app: AppPage) {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await app.openLibrary();
  await page.locator('.library-game .game-name:text("Theme Test")').click();
  await app.waitForBoard();
}

test.describe('Board Theme', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('default board theme is brown', async ({ page }) => {
    await setupWithGame(page);
    await expect(page.locator('[data-board-theme="brown"]')).toBeVisible();
  });

  test('switch board theme to blue', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    await page.locator('.theme-swatch').nth(1).click();
    await page.locator('.settings-btn').click();

    await expect(page.locator('[data-board-theme="blue"]')).toBeVisible();
  });

  test('all 5 board themes can be selected', async ({ page }) => {
    await setupWithGame(page);
    const themes = ['brown', 'blue', 'green', 'purple', 'ic'];

    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    for (let i = 0; i < themes.length; i++) {
      await page.locator('.theme-swatch').nth(i).click();
      await expect(page.locator(`[data-board-theme="${themes[i]}"]`)).toBeVisible();
    }
  });

  test('board theme persists across page reload', async ({ page }) => {
    const app = await setupWithGame(page);

    await page.locator('.settings-btn').click();
    await page.locator('.theme-swatch').nth(2).click(); // green
    await page.locator('.settings-btn').click();
    await expect(page.locator('[data-board-theme="green"]')).toBeVisible();

    await reloadAndSelectGame(page, app);
    await expect(page.locator('[data-board-theme="green"]')).toBeVisible();
  });

  test('board theme saved to localStorage', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await page.locator('.theme-swatch').nth(3).click(); // purple
    await page.locator('.settings-btn').click();

    const stored = await page.evaluate(() => localStorage.getItem('ch3ssvid5-board-theme'));
    expect(stored).toBe('purple');
  });
});

test.describe('Piece Theme', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('default piece theme is cburnett (no style injection)', async ({ page }) => {
    await setupWithGame(page);
    const styleEl = await page.$('#piece-theme-style');
    expect(styleEl).toBeNull();
  });

  test('switch to non-default piece theme injects style element', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    await page.locator('.piece-swatch').nth(2).click(); // maestro
    await page.locator('.settings-btn').click();

    await page.waitForSelector('#piece-theme-style', { state: 'attached' });

    const css = await page.evaluate(() => document.getElementById('piece-theme-style')?.textContent || '');
    expect(css).toContain('maestro');
    expect(css).toContain('wK.svg');
  });

  test('switching back to cburnett removes style element', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();

    await page.locator('.piece-swatch').nth(1).click(); // alpha
    await page.waitForSelector('#piece-theme-style', { state: 'attached' });

    await page.locator('.piece-swatch').nth(0).click(); // cburnett
    await page.waitForSelector('#piece-theme-style', { state: 'detached' });
  });

  test('piece swatch shows active state', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();

    await expect(page.locator('.piece-swatch').first()).toHaveClass(/active/);

    await page.locator('.piece-swatch').nth(1).click();
    await expect(page.locator('.piece-swatch').nth(1)).toHaveClass(/active/);
    await expect(page.locator('.piece-swatch').first()).not.toHaveClass(/active/);
  });

  test('piece theme persists across page reload', async ({ page }) => {
    const app = await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await page.locator('.piece-swatch').nth(1).click(); // alpha
    await page.locator('.settings-btn').click();

    const stored = await page.evaluate(() => localStorage.getItem('ch3ssvid5-piece-theme'));
    expect(stored).toBe('alpha');

    await reloadAndSelectGame(page, app);

    const css = await page.evaluate(() => document.getElementById('piece-theme-style')?.textContent || '');
    expect(css).toContain('alpha');
  });

  test('all 12 piece themes can be selected', async ({ page }) => {
    await setupWithGame(page);
    const themes = [
      'cburnett',
      'alpha',
      'maestro',
      'tatiana',
      'companion',
      'merida',
      'california',
      'staunty',
      'icpieces',
      'horsey',
      'kosal',
      'letter',
    ];

    await page.locator('.settings-btn').click();

    for (let i = 0; i < themes.length; i++) {
      await page.locator('.piece-swatch').nth(i).click();
      await expect(page.locator('.piece-swatch').nth(i)).toHaveClass(/active/);

      if (themes[i] === 'cburnett') {
        await page.waitForFunction(() => !document.getElementById('piece-theme-style'));
      } else {
        const css = await page.evaluate(() => document.getElementById('piece-theme-style')?.textContent || '');
        expect(css).toContain(themes[i]);
      }
    }
  });
});

test.describe('Square Labels', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('square labels off by default', async ({ page }) => {
    await setupWithGame(page);
    await expect(page.locator('.square-labels-overlay')).not.toBeVisible();
  });

  test('toggle square labels on via settings', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();

    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').first();
    await checkbox.check();
    await page.locator('.settings-btn').click();

    await expect(page.locator('.square-labels-overlay')).toBeVisible();
  });

  test('toggle square labels off again', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').first();
    await checkbox.check();
    await page.locator('.settings-btn').click();
    await expect(page.locator('.square-labels-overlay')).toBeVisible();

    await page.locator('.settings-btn').click();
    await checkbox.uncheck();
    await page.locator('.settings-btn').click();
    await expect(page.locator('.square-labels-overlay')).not.toBeVisible();
  });

  test('square labels persist across page reload', async ({ page }) => {
    const app = await setupWithGame(page);
    await page.locator('.settings-btn').click();
    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').first();
    await checkbox.check();
    await page.locator('.settings-btn').click();

    const stored = await page.evaluate(() => localStorage.getItem('ch3ssvid5-square-labels'));
    expect(stored).toBe('true');

    await reloadAndSelectGame(page, app);
    await expect(page.locator('.square-labels-overlay')).toBeVisible();
  });
});

test.describe('Move Animations', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('move animations enabled by default', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel')).toBeVisible();
    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1);
    await expect(checkbox).toBeChecked();
  });

  test('toggle move animations off', async ({ page }) => {
    await setupWithGame(page);
    await page.locator('.settings-btn').click();
    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1);
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('move animations setting persists across page reload', async ({ page }) => {
    const app = await setupWithGame(page);
    await page.locator('.settings-btn').click();
    const checkbox = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1);
    await checkbox.uncheck();
    await page.locator('.settings-btn').click();

    const stored = await page.evaluate(() => localStorage.getItem('ch3ssvid5-move-animations'));
    expect(stored).toBe('false');

    await reloadAndSelectGame(page, app);

    await page.locator('.settings-btn').click();
    const checkboxAfter = page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1);
    await expect(checkboxAfter).not.toBeChecked();
  });
});

test.describe('Combined Settings Persistence', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('multiple settings persist together across reload', async ({ page }) => {
    const app = await setupWithGame(page);
    await page.locator('.settings-btn').click();

    // Board theme → purple
    await page.locator('.theme-swatch').nth(3).click();
    // Piece theme → staunty
    await page.locator('.piece-swatch').nth(7).click();
    // Square labels → on
    await page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').first().check();
    // Move animations → off
    await page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1).uncheck();

    await page.locator('.settings-btn').click();

    const values = await page.evaluate(() => ({
      board: localStorage.getItem('ch3ssvid5-board-theme'),
      piece: localStorage.getItem('ch3ssvid5-piece-theme'),
      labels: localStorage.getItem('ch3ssvid5-square-labels'),
      anims: localStorage.getItem('ch3ssvid5-move-animations'),
    }));
    expect(values.board).toBe('purple');
    expect(values.piece).toBe('staunty');
    expect(values.labels).toBe('true');
    expect(values.anims).toBe('false');

    await reloadAndSelectGame(page, app);

    await expect(page.locator('[data-board-theme="purple"]')).toBeVisible();
    const css = await page.evaluate(() => document.getElementById('piece-theme-style')?.textContent || '');
    expect(css).toContain('staunty');
    await expect(page.locator('.square-labels-overlay')).toBeVisible();

    await page.locator('.settings-btn').click();
    await expect(page.locator('.settings-panel .settings-checkbox input[type="checkbox"]').nth(1)).not.toBeChecked();
  });
});
