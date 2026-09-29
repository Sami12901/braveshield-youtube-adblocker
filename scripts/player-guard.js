/**
 * BraveShield Real-Time Player & Anti-Enforcement Guard
 * Layer 2: MAIN World Player Watchdog
 *
 * Runs in the MAIN world to monitor #movie_player, <video> elements, and DOM dialogs.
 * Instantly neutralizes and fast-forwards ads, auto-clicks skip buttons, destroys
 * anti-adblock enforcement dialogs, and skips sponsored YouTube Shorts.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__BRAVE_SHIELD_PLAYER_GUARD_ACTIVE__) {
    return;
  }
  window.__BRAVE_SHIELD_PLAYER_GUARD_ACTIVE__ = true;

  /* ==========================================================================
     1. Bridge Event Dispatcher
     ========================================================================== */
  function notifyBridge(action, count = 1) {
    try {
      const targetOrigin =
        window.location.origin && window.location.origin !== 'null'
          ? window.location.origin
          : 'https://www.youtube.com';

      window.postMessage(
        {
          source: 'BRAVE_SHIELD_INTERCEPTOR',
          action: action,
          count: count
        },
        targetOrigin
      );
    } catch (e) {}
  }

  /* ==========================================================================
     2. Skip Button Selectors
     ========================================================================== */
  const SKIP_BUTTON_SELECTORS = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button-container button',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-overlay-close-button',
    'button.ytp-ad-overlay-close-button',
    '.ytp-ad-preview-container .ytp-ad-skip-button',
    '[id^="skip-button:"] button'
  ];

  /* ==========================================================================
     3. Fast Ad Neutralizer & Skip Engine
     ========================================================================== */
  let lastAdSkipTimestamp = 0;

  function triggerFastAdSkip(player, video) {
    try {
      // 1. Instantly mute audio so user doesn't hear a split-second ad blip
      if (video && !video.muted) {
        video.muted = true;
      }

      // 2. Accelerate video playback rate to 16x (maximum browser speed)
      if (video && video.playbackRate < 16) {
        video.playbackRate = 16.0;
      }

      // 3. Fast-forward video directly to duration / end
      if (video && isFinite(video.duration) && video.duration > 0) {
        const targetTime = video.duration - 0.05;
        if (video.currentTime < targetTime) {
          video.currentTime = targetTime;
        }
      }

      // 4. Click all available skip buttons immediately
      for (let i = 0; i < SKIP_BUTTON_SELECTORS.length; i++) {
        const btn = document.querySelector(SKIP_BUTTON_SELECTORS[i]);
        if (btn && typeof btn.click === 'function') {
          btn.click();
        }
      }

      // 5. Use YouTube Player API if accessible
      if (player) {
        if (typeof player.skipAd === 'function') {
          player.skipAd();
        } else if (
          typeof player.cancelPlayback === 'function' &&
          video &&
          video.currentTime >= (video.duration || 1)
        ) {
          player.cancelPlayback();
        }
      }

      // Throttle postMessage notification to once every 400ms per ad encounter
      const now = Date.now();
      if (now - lastAdSkipTimestamp > 400) {
        lastAdSkipTimestamp = now;
        notifyBridge('AD_SKIPPED', 1);
      }
    } catch (err) {}
  }

  /* ==========================================================================
     4. Anti-Adblock Enforcement Popup Destroyer
     ========================================================================== */
  const ENFORCEMENT_WARNING_TEXTS = [
    "Ad blockers violate YouTube's Terms of Service",
    'Ad blockers are not allowed',
    'Ad blockers are not allowed on YouTube',
    'Please allow ads on YouTube',
    'Video player will be blocked after 3 videos'
  ];

  function destroyAntiAdblockPopups() {
    try {
      // 1. Target custom enforcement message renderers
      const enforcementViewModels = document.querySelectorAll(
        'ytd-enforcement-message-view-model'
      );
      if (enforcementViewModels.length > 0) {
        enforcementViewModels.forEach((el) => {
          const dialog = el.closest('tp-yt-paper-dialog') || el;
          dialog.remove();
        });
        cleanModalStateAndResume();
        notifyBridge('POPUP_DESTROYED', 1);
        return;
      }

      // 2. Target tp-yt-paper-dialog modals containing enforcement text
      const dialogs = document.querySelectorAll('tp-yt-paper-dialog');
      for (let i = 0; i < dialogs.length; i++) {
        const dialog = dialogs[i];
        const textContent = dialog.textContent || '';
        const isEnforcementDialog = ENFORCEMENT_WARNING_TEXTS.some((msg) =>
          textContent.includes(msg)
        );

        if (isEnforcementDialog) {
          dialog.remove();
          cleanModalStateAndResume();
          notifyBridge('POPUP_DESTROYED', 1);
          break;
        }
      }

      // 3. Remove YouTube playability error renderers that block playback
      const errorRenderers = document.querySelectorAll(
        '.yt-playability-error-supported-renderers'
      );
      for (let i = 0; i < errorRenderers.length; i++) {
        const errorEl = errorRenderers[i];
        if (
          errorEl.textContent &&
          ENFORCEMENT_WARNING_TEXTS.some((msg) => errorEl.textContent.includes(msg))
        ) {
          errorEl.remove();
          cleanModalStateAndResume();
          notifyBridge('POPUP_DESTROYED', 1);
        }
      }
    } catch (err) {}
  }

  function cleanModalStateAndResume() {
    try {
      // Remove modal backdrops that darken and block UI interaction
      const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
      backdrops.forEach((backdrop) => backdrop.remove());

      // Restore scrolling to document body
      if (document.body) {
        document.body.style.overflow = 'auto';
        document.body.removeAttribute('aria-hidden');
      }
      if (document.documentElement) {
        document.documentElement.style.overflow = 'auto';
      }

      // Resume video playback automatically
      const player = document.getElementById('movie_player');
      if (player && typeof player.playVideo === 'function') {
        player.playVideo();
      }

      const video = document.querySelector('video') || document.querySelector('#movie_player video');
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    } catch (e) {}
  }

  /* ==========================================================================
     5. YouTube Shorts Sponsored Ad Auto-Skipper
     ========================================================================== */
  let lastShortsSkipTimestamp = 0;

  function checkShortsAds() {
    try {
      const activeShort = document.querySelector('ytd-reel-video-renderer[is-active]');
      if (!activeShort) return;

      const hasAdSlot = activeShort.querySelector(
        'ytd-ad-slot-renderer, #promoted-sparkles-web-renderer, .ytd-reel-player-overlay-renderer ytd-ad-slot-renderer'
      );

      const hasSponsoredBadge =
        activeShort.querySelector('.badge-shape-wiz--thumbnail-badge') ||
        activeShort.textContent.includes('Sponsored');

      if (hasAdSlot || hasSponsoredBadge) {
        const now = Date.now();
        if (now - lastShortsSkipTimestamp > 1000) {
          lastShortsSkipTimestamp = now;

          // Attempt to click the Next Short navigation button
          const downBtn = document.querySelector(
            '#navigation-button-down button, ytd-shorts #navigation-button-down button'
          );
          if (downBtn && typeof downBtn.click === 'function') {
            downBtn.click();
          } else {
            // Fallback: Dispatch ArrowDown keyboard event
            window.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                code: 'ArrowDown',
                keyCode: 40,
                which: 40,
                bubbles: true,
                cancelable: true
              })
            );
          }

          notifyBridge('SHORTS_AD_SKIPPED', 1);
        }
      }
    } catch (err) {}
  }

  /* ==========================================================================
     6. High-Frequency Real-Time Player Heartbeat & MutationObserver
     ========================================================================== */
  let isMitigatingAd = false;
  let userPlaybackRate = 1.0;
  let userMutedState = false;

  function runPlayerWatchdogCycle() {
    const player = document.getElementById('movie_player');
    const video = document.querySelector('video') || document.querySelector('#movie_player video');

    // 1. Check for in-player ads
    if (player) {
      const hasAdClass =
        player.classList.contains('ad-showing') ||
        player.classList.contains('ad-interrupting');

      const hasAdOverlay = Boolean(document.querySelector('.ytp-ad-player-overlay'));

      if (hasAdClass || hasAdOverlay) {
        if (!isMitigatingAd) {
          isMitigatingAd = true;
          if (video) {
            userPlaybackRate =
              video.playbackRate && video.playbackRate < 16
                ? video.playbackRate
                : 1.0;
            userMutedState = video.muted;
          }
        }
        triggerFastAdSkip(player, video);
      } else if (isMitigatingAd) {
        // Ad has finished: Restore user's normal playback rate and unmuted audio
        isMitigatingAd = false;
        if (video) {
          video.playbackRate = userPlaybackRate || 1.0;
          if (!userMutedState && video.muted) {
            video.muted = false;
          }
        }
      }
    }

    // 2. Check for anti-adblock enforcement dialogs
    destroyAntiAdblockPopups();

    // 3. Check for Shorts sponsored ads
    if (window.location.pathname.startsWith('/shorts')) {
      checkShortsAds();
    }
  }

  // Fast interval check (every 50ms) ensures near-instant response before user notices
  setInterval(runPlayerWatchdogCycle, 50);

  // MutationObserver monitors DOM mutations immediately as elements are inserted
  const observer = new MutationObserver(() => {
    runPlayerWatchdogCycle();
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'is-active']
      });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'is-active']
          });
        }
      });
    }
  }

  startObserver();

})();
