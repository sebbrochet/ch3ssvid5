import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';

test.describe('Welcome Screen', () => {
  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.clearAndGoto();
  });

  test('shows welcome heading', async () => {
    await expect(app.welcomeHeading).toBeVisible();
    await expect(app.welcomeHeading).toContainText('Ch3ssVid5');
  });

  test('shows sample game buttons', async () => {
    await expect(app.sampleButtons).toHaveCount(2);
    await expect(app.sampleButtons.first()).toContainText('Jobava London');
    await expect(app.sampleButtons.last()).toContainText('Caro-Kann');
  });

  test('sample game click opens import dialog', async ({ page }) => {
    await app.sampleButtons.first().click();
    await expect(page.locator('.dialog-overlay')).toBeVisible();
  });
});

test.describe('Welcome Screen — Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.clearAndGoto();
  });

  test('shows "Start from video" and "Import" cards', async () => {
    await expect(app.welcomeCards).toHaveCount(2);
  });

  test('shows keyboard shortcuts grid', async () => {
    await expect(app.shortcutsGrid).toBeVisible();
  });
});

test.describe('Welcome Screen — Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.clearAndGoto();
  });

  test('shows Receive card instead of Start/Import', async () => {
    // Mobile should have the Receive card
    await expect(app.welcomeCards).toHaveCount(1);
    const card = app.welcomeCards.first();
    await expect(card).toContainText('📲');
  });

  test('does not show keyboard shortcuts', async () => {
    await expect(app.shortcutsGrid).not.toBeVisible();
  });
});
