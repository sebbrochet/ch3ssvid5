import type { Page } from '@playwright/test';

/**
 * Page Object Model for the Ch3ssVid5 app.
 * Provides reusable helpers for common interactions.
 */
export class AppPage {
  constructor(public page: Page) {}

  // --- Navigation ---

  async clearAndGoto() {
    await this.page.goto('/');
    await this.page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
    // Wait for React to render — either the welcome screen or the app shell
    await this.page
      .locator('.welcome-content, .app-body, .library-toggle')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 });
  }

  async waitForBoard() {
    await this.page.waitForSelector('.cg-wrap');
  }

  // --- Welcome Screen ---

  get welcomeHeading() {
    return this.page.locator('.welcome-content h2');
  }

  get sampleButtons() {
    return this.page.locator('.sample-btn');
  }

  get welcomeCards() {
    return this.page.locator('.welcome-card');
  }

  get shortcutsGrid() {
    return this.page.locator('.shortcuts-grid');
  }

  // --- Header ---

  get libraryToggle() {
    return this.page.locator('.library-toggle');
  }

  get appTitle() {
    return this.page.locator('.app-title');
  }

  get langToggle() {
    return this.page.locator('.lang-switcher .lang-toggle');
  }

  get currentGameName() {
    return this.page.locator('.current-game-name');
  }

  // --- Library ---

  async openLibrary() {
    const sidebar = this.page.locator('.game-library');
    if (await sidebar.isVisible().catch(() => false)) return;
    await this.libraryToggle.waitFor({ state: 'visible', timeout: 10000 });
    await this.libraryToggle.click();
    await sidebar.waitFor({ state: 'visible', timeout: 10000 });
  }

  async closeLibrary() {
    await this.page.locator('.sidebar-backdrop').click();
  }

  async createNewGame(name: string, videoUrl?: string) {
    await this.openLibrary();
    // Click the + button
    await this.page.locator('.library-actions button').last().click();
    // Fill in the dialog
    await this.page.waitForSelector('.dialog');
    const nameInput = this.page.locator('.dialog input[type="text"]').first();
    await nameInput.fill(name);
    if (videoUrl) {
      const urlInput = this.page.locator('.dialog input[type="text"]').nth(1);
      await urlInput.fill(videoUrl);
    }
    await this.page.locator('.dialog-submit').click();
    await this.page.waitForSelector('.dialog', { state: 'detached' });
  }

  async selectGameInLibrary(name: string) {
    await this.page.locator(`.library-game .game-name:text("${name}")`).click();
  }

  get libraryGames() {
    return this.page.locator('.library-game');
  }

  get libraryEmpty() {
    return this.page.locator('.library-empty');
  }

  async rightClickGame(name: string) {
    await this.page.locator(`.library-game .game-name:text("${name}")`).click({ button: 'right' });
    await this.page.waitForSelector('.folder-context-menu');
  }

  get contextMenu() {
    return this.page.locator('.folder-context-menu');
  }

  // --- Board ---

  get board() {
    return this.page.locator('.cg-wrap');
  }

  // --- Move Tree ---

  get moveTree() {
    return this.page.locator('.move-tree');
  }

  async clickMove(san: string) {
    await this.page.locator(`.tree-move:has-text("${san}")`).first().click();
  }

  get activeMove() {
    return this.page.locator('.tree-move.active');
  }

  // --- Navigation Controls ---

  get btnFirst() {
    return this.page.locator('.nav-row button').first();
  }

  get btnPrev() {
    return this.page.locator('.nav-row button').nth(1);
  }

  get btnNext() {
    return this.page.locator('.nav-row button').nth(3);
  }

  get btnLast() {
    return this.page.locator('.nav-row button').nth(4);
  }

  get flipBtn() {
    return this.page.locator('.flip-btn');
  }

  get playPauseBtn() {
    return this.page.locator('.play-pause-btn');
  }

  // --- Engine ---

  get engineToggle() {
    return this.page.locator('.engine-toggle');
  }

  get engineRow() {
    return this.page.locator('.engine-row');
  }

  // --- Sync ---

  get syncToggle() {
    return this.page.locator('.sync-toggle');
  }

  get syncRow() {
    return this.page.locator('.sync-row');
  }

  // --- Video ---

  get videoPanel() {
    return this.page.locator('.video-panel');
  }

  get noVideo() {
    return this.page.locator('.no-video');
  }

  // --- Dialogs ---

  get dialog() {
    return this.page.locator('.dialog');
  }

  get importDialog() {
    return this.page.locator('.dialog-overlay .dialog');
  }

  // --- Game Selector ---

  get gameSelector() {
    return this.page.locator('.game-selector');
  }

  // --- Toast ---

  get toast() {
    return this.page.locator('.toast');
  }

  // --- Helpers ---

  async clearLocalStorage() {
    await this.page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* ignore if not available */
      }
    });
  }

  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }

  /** Switch language via the Settings panel */
  async switchLanguage(langLabel: string) {
    // Open settings if not already open
    const settingsPanel = this.page.locator('.settings-panel');
    if (!(await settingsPanel.isVisible().catch(() => false))) {
      await this.page.locator('.settings-btn').click();
      await settingsPanel.waitFor({ state: 'visible', timeout: 5000 });
    }
    await this.page.locator(`.lang-option-btn:text("${langLabel}")`).click();
    // Close settings
    await this.page.locator('.settings-btn').click();
    await settingsPanel.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /** Create a game directly in localStorage (useful for mobile tests where dialog overlays conflict).
   *  Triggers a full page reload to pick up the new data. */
  async createGameViaStorage(name: string, videoUrl?: string) {
    await this.page.evaluate(
      ({ name, videoUrl }) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const videoId = videoUrl?.match(/[?&]v=([^&]+)/)?.[1];
        const pgn = `[Event "?"]\n[Site "?"]\n[Date "????.??.??"]\n[White "?"]\n[Black "?"]\n[Result "*"]${videoUrl ? `\n[VideoURL "${videoUrl}"]` : ''}\n\n*`;
        const game = { id, name, pgn, videoId, folder: '/', timestamps: {}, createdAt: now, updatedAt: now };
        const games = JSON.parse(localStorage.getItem('ch3ssvid5-library') || '[]');
        games.push(game);
        localStorage.setItem('ch3ssvid5-library', JSON.stringify(games));
      },
      { name, videoUrl },
    );
    // Reload (not goto) to avoid triggering addInitScript which would clear localStorage
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // --- Playlists ---

  get playlistSection() {
    return this.page.locator('.playlist-section');
  }

  get playlistItems() {
    return this.page.locator('.playlist-item');
  }

  get playlistAddBtn() {
    return this.page.locator('.playlist-add-btn');
  }

  get playlistCreateInput() {
    return this.page.locator('.playlist-create-form input');
  }

  get playlistCreateConfirm() {
    return this.page.locator('.playlist-create-form .inline-icon-btn.confirm');
  }

  get playlistCreateCancel() {
    return this.page.locator('.playlist-create-form .inline-icon-btn.cancel');
  }

  get playlistView() {
    return this.page.locator('.playlist-view');
  }

  get playlistBackBtn() {
    return this.page.locator('.playlist-back-btn');
  }

  get playlistGameItems() {
    return this.page.locator('.playlist-game-item');
  }

  get playlistPlayAllBtn() {
    return this.page.locator('.playlist-action-btn.primary');
  }

  get nowPlayingBar() {
    return this.page.locator('.now-playing-bar');
  }

  get nowPlayingName() {
    return this.page.locator('.now-playing-name');
  }

  get nowPlayingPosition() {
    return this.page.locator('.now-playing-position');
  }

  get nowPlayingPrev() {
    return this.page.locator('.now-playing-btn').first();
  }

  get nowPlayingNext() {
    return this.page.locator('.now-playing-btn').nth(1);
  }

  get nowPlayingExit() {
    return this.page.locator('.now-playing-btn.exit');
  }

  get gamePickerDialog() {
    return this.page.locator('.game-picker-dialog');
  }

  async createPlaylist(name: string) {
    await this.playlistAddBtn.click();
    await this.playlistCreateInput.waitFor({ state: 'visible' });
    await this.playlistCreateInput.fill(name);
    await this.playlistCreateConfirm.click();
  }

  async openPlaylist(name: string) {
    await this.page.locator(`.playlist-item .playlist-name:text("${name}")`).click();
    await this.playlistView.waitFor({ state: 'visible' });
  }

  async rightClickPlaylist(name: string) {
    await this.page.locator(`.playlist-item .playlist-name:text("${name}")`).click({ button: 'right' });
    await this.page.waitForSelector('.folder-context-menu');
  }
}
