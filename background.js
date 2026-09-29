/**
 * BraveShield Background Service Worker
 * Layer 6: State, Telemetry, DNR Management, & Badge Manager
 *
 * Handles live extension badge text, persistent statistics in chrome.storage.local,
 * dynamic ruleset enabling/disabling, and per-tab counter tracking.
 */

// In-memory per-tab statistics
const tabBlockCounts = new Map();

// Default configuration
const DEFAULT_SETTINGS = {
  shieldEnabled: true,
  blockVideoAds: true,
  blockFeedAds: true,
  blockShortsAds: true,
  totalBlocked: 0,
  sessionBlocked: 0,
  networkBlocked: 0,
  scriptletBlocked: 0
};

/* ==========================================================================
   1. Initialization & Install Handler
   ========================================================================== */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), (result) => {
    const toSet = {};
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      if (result[key] === undefined) {
        toSet[key] = defaultValue;
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });

  // Ensure DNR ruleset is enabled
  if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['ruleset_1']
    });
  }
});

/* ==========================================================================
   2. Badge Text Management
   ========================================================================== */
function updateTabBadge(tabId, count) {
  if (!tabId || tabId < 0) return;

  const badgeText = count > 0 ? (count > 999 ? '999+' : count.toString()) : '';

  chrome.action.setBadgeText({
    tabId: tabId,
    text: badgeText
  });

  chrome.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: '#ff5500' // Brave Lion Orange
  });
}

/* ==========================================================================
   3. Message Handling from Content Script & Popup
   ========================================================================== */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  const tabId = sender && sender.tab ? sender.tab.id : null;

  switch (message.type) {
    case 'RECORD_BLOCK': {
      const incCount =
        typeof message.count === 'number' &&
        Number.isFinite(message.count) &&
        message.count > 0 &&
        message.count <= 1000
          ? Math.floor(message.count)
          : 1;

      const ALLOWED_CATEGORIES = new Set([
        'AD_PRUNED',
        'AD_SKIPPED',
        'POPUP_DESTROYED',
        'SHORTS_AD_SKIPPED',
        'NETWORK_RULE'
      ]);
      const category = ALLOWED_CATEGORIES.has(message.category)
        ? message.category
        : 'AD_PRUNED';

      // Update per-tab in-memory counter
      if (tabId) {
        const currentTabCount = (tabBlockCounts.get(tabId) || 0) + incCount;
        tabBlockCounts.set(tabId, currentTabCount);
        updateTabBadge(tabId, currentTabCount);
      }

      // Update persistent counters in chrome.storage.local
      chrome.storage.local.get(
        ['totalBlocked', 'sessionBlocked', 'scriptletBlocked', 'networkBlocked'],
        (stats) => {
          const updates = {
            totalBlocked: (stats.totalBlocked || 0) + incCount,
            sessionBlocked: (stats.sessionBlocked || 0) + incCount
          };

          if (category === 'NETWORK_RULE') {
            updates.networkBlocked = (stats.networkBlocked || 0) + incCount;
          } else {
            updates.scriptletBlocked = (stats.scriptletBlocked || 0) + incCount;
          }

          chrome.storage.local.set(updates);
        }
      );

      sendResponse({ status: 'ok' });
      break;
    }

    case 'GET_CURRENT_TAB_STATS': {
      if (tabId) {
        sendResponse({ tabBlocked: tabBlockCounts.get(tabId) || 0 });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTabId = tabs[0] ? tabs[0].id : null;
          const count = activeTabId ? tabBlockCounts.get(activeTabId) || 0 : 0;
          sendResponse({ tabBlocked: count });
        });
        return true; // Keep channel open for async response
      }
      break;
    }

    case 'TOGGLE_RULES_ENGINE': {
      const enabled = Boolean(message.enabled);
      if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
        chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: enabled ? ['ruleset_1'] : [],
          disableRulesetIds: enabled ? [] : ['ruleset_1']
        });
      }
      sendResponse({ status: 'ok' });
      break;
    }

    default:
      break;
  }

  return true;
});

/* ==========================================================================
   4. Tab Lifecycle & Cleanup
   ========================================================================== */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlockCounts.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Reset badge if tab navigates away from youtube.com
  if (changeInfo.status === 'loading' && tab.url) {
    if (!tab.url.includes('youtube.com')) {
      tabBlockCounts.delete(tabId);
      updateTabBadge(tabId, 0);
    }
  }
});

/* ==========================================================================
   5. DeclarativeNetRequest Rule Match Listener (Debug & Analytics)
   ========================================================================== */
if (
  chrome.declarativeNetRequest &&
  chrome.declarativeNetRequest.onRuleMatchedDebug
) {
  try {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      const tabId = info.request ? info.request.tabId : null;

      if (tabId && tabId > 0) {
        const currentTabCount = (tabBlockCounts.get(tabId) || 0) + 1;
        tabBlockCounts.set(tabId, currentTabCount);
        updateTabBadge(tabId, currentTabCount);
      }

      chrome.storage.local.get(
        ['totalBlocked', 'sessionBlocked', 'networkBlocked'],
        (stats) => {
          chrome.storage.local.set({
            totalBlocked: (stats.totalBlocked || 0) + 1,
            sessionBlocked: (stats.sessionBlocked || 0) + 1,
            networkBlocked: (stats.networkBlocked || 0) + 1
          });
        }
      );
    });
  } catch (e) {}
}
