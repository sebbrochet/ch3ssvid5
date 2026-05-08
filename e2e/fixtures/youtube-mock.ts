import type { Page } from '@playwright/test';

/**
 * Mock the YouTube IFrame API to enable offline, deterministic E2E tests.
 * Call this before navigating to the app.
 */
export async function mockYouTubePlayer(page: Page) {
  await page.route('**/www.youtube.com/iframe_api', (route) => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.YT = {
          PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
          Player: function(container, opts) {
            var self = this;
            self._currentTime = 0;
            self._state = -1;
            self._opts = opts;
            self._interval = null;

            var el = typeof container === 'string'
              ? document.getElementById(container)
              : container;
            if (el) el.innerHTML = '<div class="yt-mock" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;color:#888;">Mock Player</div>';

            // Expose for test control
            window.__ytPlayer = self;

            setTimeout(function() {
              if (opts.events && opts.events.onReady) {
                opts.events.onReady({ target: self });
              }
            }, 50);

            self.getCurrentTime = function() { return self._currentTime; };
            self.getDuration = function() { return 600; };
            self.seekTo = function(t) { self._currentTime = t; };
            self.playVideo = function() {
              self._state = 1;
              if (opts.events && opts.events.onStateChange) {
                opts.events.onStateChange({ data: 1 });
              }
              if (self._interval) clearInterval(self._interval);
              self._interval = setInterval(function() { self._currentTime += 0.2; }, 200);
            };
            self.pauseVideo = function() {
              self._state = 2;
              if (self._interval) clearInterval(self._interval);
              self._interval = null;
              if (opts.events && opts.events.onStateChange) {
                opts.events.onStateChange({ data: 2 });
              }
            };
            self.destroy = function() {
              if (self._interval) clearInterval(self._interval);
              self._interval = null;
            };
            self.getPlayerState = function() { return self._state; };
          }
        };
        if (window.onYouTubeIframeAPIReady) {
          window.onYouTubeIframeAPIReady();
        } else {
          // App may not have registered the callback yet — poll briefly
          var attempts = 0;
          var poll = setInterval(function() {
            attempts++;
            if (window.onYouTubeIframeAPIReady) {
              clearInterval(poll);
              window.onYouTubeIframeAPIReady();
            } else if (attempts > 50) {
              clearInterval(poll);
            }
          }, 50);
        }
      `,
    });
  });

  // Also block actual YouTube embed requests
  await page.route('**/www.youtube.com/embed/**', (route) => {
    route.fulfill({ contentType: 'text/html', body: '<html><body>Mock</body></html>' });
  });
}
