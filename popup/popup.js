/**
 * BraveShield Popup Controller
 * Layer 6: Popup Dashboard Logic
 *
 * Manages user interactions, dynamic settings toggling, live statistic updates,
 * and quick YouTube tab reloads.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const masterShieldToggle = document.getElementById('masterShieldToggle');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const totalBlockedCount = document.getElementById('totalBlockedCount');
  const scriptletBlockedCount = document.getElementById('scriptletBlockedCount');
  const sessionBlockedCount = document.getElementById('sessionBlockedCount');
  const networkBlockedCount = document.getElementById('networkBlockedCount');
  const toggleVideoAds = document.getElementById('toggleVideoAds');
  const toggleFeedAds = document.getElementById('toggleFeedAds');
  const toggleShortsAds = document.getElementById('toggleShortsAds');
  const refreshBtn = document.getElementById('refreshBtn');

  /* ==========================================================================
     1. Status Badge Formatter
     ========================================================================== */
  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusBadge.className = 'status-badge status-active';
      statusText.textContent = 'PROTECTED';
      masterShieldToggle.checked = true;
      enableSubToggles(true);
    } else {
      statusBadge.className = 'status-badge status-inactive';
      statusText.textContent = 'SHIELDS DOWN';
      masterShieldToggle.checked = false;
      enableSubToggles(false);
    }
  }

  function enableSubToggles(enabled) {
    toggleVideoAds.disabled = !enabled;
    toggleFeedAds.disabled = !enabled;
    toggleShortsAds.disabled = !enabled;

    const op = enabled ? '1' : '0.4';
    toggleVideoAds.closest('.control-row').style.opacity = op;
    toggleFeedAds.closest('.control-row').style.opacity = op;
    toggleShortsAds.closest('.control-row').style.opacity = op;
  }

  function formatCount(num) {
    if (!num || isNaN(num)) return '0';
    return Number(num).toLocaleString();
  }

  /* ==========================================================================
     2. Load Current Settings & Statistics
     ========================================================================== */
  function loadState() {
    chrome.storage.local.get(
      [
        'shieldEnabled',
        'blockVideoAds',
        'blockFeedAds',
        'blockShortsAds',
        'totalBlocked',
        'sessionBlocked',
        'scriptletBlocked',
        'networkBlocked'
      ],
      (data) => {
        const isShieldActive = data.shieldEnabled !== false;
        updateStatusUI(isShieldActive);

        toggleVideoAds.checked = data.blockVideoAds !== false;
        toggleFeedAds.checked = data.blockFeedAds !== false;
        toggleShortsAds.checked = data.blockShortsAds !== false;

        totalBlockedCount.textContent = formatCount(data.totalBlocked || 0);
        scriptletBlockedCount.textContent = formatCount(data.scriptletBlocked || 0);
        sessionBlockedCount.textContent = formatCount(data.sessionBlocked || 0);
        networkBlockedCount.textContent = formatCount(data.networkBlocked || 0);
      }
    );
  }

  loadState();

  /* ==========================================================================
     3. Event Listeners for Toggles
     ========================================================================== */
  masterShieldToggle.addEventListener('change', () => {
    const isEnabled = masterShieldToggle.checked;
    updateStatusUI(isEnabled);

    chrome.storage.local.set({ shieldEnabled: isEnabled });

    // Inform background service worker to update declarativeNetRequest rules
    chrome.runtime.sendMessage({
      type: 'TOGGLE_RULES_ENGINE',
      enabled: isEnabled
    });
  });

  toggleVideoAds.addEventListener('change', () => {
    chrome.storage.local.set({ blockVideoAds: toggleVideoAds.checked });
  });

  toggleFeedAds.addEventListener('change', () => {
    chrome.storage.local.set({ blockFeedAds: toggleFeedAds.checked });
  });

  toggleShortsAds.addEventListener('change', () => {
    chrome.storage.local.set({ blockShortsAds: toggleShortsAds.checked });
  });

  /* ==========================================================================
     4. Quick Refresh Button
     ========================================================================== */
  refreshBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });

  /* ==========================================================================
     5. Real-Time Storage Listener
     ========================================================================== */
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.totalBlocked) {
        totalBlockedCount.textContent = formatCount(changes.totalBlocked.newValue || 0);
      }
      if (changes.scriptletBlocked) {
        scriptletBlockedCount.textContent = formatCount(changes.scriptletBlocked.newValue || 0);
      }
      if (changes.sessionBlocked) {
        sessionBlockedCount.textContent = formatCount(changes.sessionBlocked.newValue || 0);
      }
      if (changes.networkBlocked) {
        networkBlockedCount.textContent = formatCount(changes.networkBlocked.newValue || 0);
      }
      if (changes.shieldEnabled) {
        updateStatusUI(changes.shieldEnabled.newValue);
      }
    }
  });
});
