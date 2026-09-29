/**
 * BraveShield Isolated Bridge & State Manager
 * Layer 3: ISOLATED World Bridge
 *
 * Bridges the MAIN world scriptlet execution context and the Chrome Extension API
 * context (chrome.runtime, chrome.storage). Relays blocked ad metrics and
 * broadcasts settings changes in real time.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__BRAVE_SHIELD_BRIDGE_ACTIVE__) {
    return;
  }
  window.__BRAVE_SHIELD_BRIDGE_ACTIVE__ = true;

  /* ==========================================================================
     1. PostMessage Relay: MAIN World -> ISOLATED World -> Service Worker
     ========================================================================== */
  window.addEventListener('message', (event) => {
    // Only accept events from the current window and identified source
    if (event.source !== window || !event.data || event.data.source !== 'BRAVE_SHIELD_INTERCEPTOR') {
      return;
    }

    const { action, count } = event.data;

    try {
      if (chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
        chrome.runtime.sendMessage(
          {
            type: 'RECORD_BLOCK',
            category: action,
            count: typeof count === 'number' ? count : 1
          },
          () => {
            // Suppress benign connection errors if service worker is waking up
            if (chrome.runtime.lastError) {
              // Service worker will handle on wake
            }
          }
        );
      }
    } catch (e) {
      // Catch transient runtime context invalidations
    }
  });

  /* ==========================================================================
     2. Configuration Synchronization: Storage -> MAIN World
     ========================================================================== */
  function syncSettingsToPage() {
    try {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(
          ['shieldEnabled', 'blockVideoAds', 'blockFeedAds', 'blockShortsAds'],
          (settings) => {
            window.postMessage(
              {
                source: 'BRAVE_SHIELD_BRIDGE',
                action: 'SETTINGS_UPDATE',
                settings: settings || {}
              },
              '*'
            );
          }
        );
      }
    } catch (e) {}
  }

  // Initial synchronization on load
  syncSettingsToPage();

  // Listen for storage changes from the Popup Dashboard
  try {
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
          syncSettingsToPage();
        }
      });
    }
  } catch (e) {}

})();
