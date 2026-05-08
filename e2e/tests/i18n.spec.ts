import { test, expect } from '@playwright/test';
import { AppPage } from '../pages/app.page';

test.describe('Language Switching', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  let app: AppPage;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.clearAndGoto();
  });

  test('displays in English by default', async () => {
    await expect(app.welcomeHeading).toContainText('Welcome to Ch3ssVid5');
  });

  test('switch to French via settings', async () => {
    await app.switchLanguage('Français');
    await expect(app.welcomeHeading).toContainText('Bienvenue sur Ch3ssVid5');
  });

  test('switch to Spanish via settings', async () => {
    await app.switchLanguage('Español');
    await expect(app.welcomeHeading).toContainText('Bienvenido a Ch3ssVid5');
  });

  test('switch to German via settings', async () => {
    await app.switchLanguage('Deutsch');
    await expect(app.welcomeHeading).toContainText('Willkommen bei Ch3ssVid5');
  });

  test('switch to Portuguese via settings', async () => {
    await app.switchLanguage('Português');
    await expect(app.welcomeHeading).toContainText('Bem-vindo ao Ch3ssVid5');
  });

  test('switch back to English', async () => {
    await app.switchLanguage('Français');
    await expect(app.welcomeHeading).toContainText('Bienvenue');

    await app.switchLanguage('English');
    await expect(app.welcomeHeading).toContainText('Welcome to Ch3ssVid5');
  });

  test('language preference is saved to localStorage', async ({ page }) => {
    await app.switchLanguage('Español');
    await expect(app.welcomeHeading).toContainText('Bienvenido');

    const lang = await page.evaluate(() => localStorage.getItem('ch3ssvid5-lang'));
    expect(lang).toBe('es');
  });

  test('dialog labels are translated in French', async ({ page }) => {
    await app.switchLanguage('Français');

    await app.openLibrary();
    await page.locator('.library-actions button').last().click();
    await page.waitForSelector('.dialog');

    const dialogTitle = page.locator('.dialog h3');
    await expect(dialogTitle).toContainText('Nouveau fichier PGN');
  });
});

test.describe('Language Detection from Browser', () => {
  test.use({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' });

  test('detects French from browser locale', async ({ page }) => {
    const app = new AppPage(page);
    await app.clearAndGoto();
    await expect(app.welcomeHeading).toContainText('Bienvenue sur Ch3ssVid5');
  });
});

test.describe('Language Detection — German', () => {
  test.use({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' });

  test('detects German from browser locale', async ({ page }) => {
    const app = new AppPage(page);
    await app.clearAndGoto();
    await expect(app.welcomeHeading).toContainText('Willkommen bei Ch3ssVid5');
  });
});

test.describe('Language Detection — English fallback', () => {
  test.use({ viewport: { width: 1280, height: 800 }, locale: 'ja-JP' });

  test('falls back to English for unsupported locale', async ({ page }) => {
    const app = new AppPage(page);
    await app.clearAndGoto();
    await expect(app.welcomeHeading).toContainText('Welcome to Ch3ssVid5');
  });
});
