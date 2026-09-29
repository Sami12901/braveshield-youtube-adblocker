/**
 * BraveShield Native YouTube Interceptor & JSON Pruning Engine
 * Layer 1: MAIN World Scriptlet
 *
 * Runs before any YouTube scripts execute (run_at: document_start, world: MAIN).
 * Implements Function.prototype.toString stealth spoofing, Object.defineProperty
 * property traps, and real-time monkey-patching of JSON.parse, fetch, Response.json,
 * and XMLHttpRequest.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__BRAVE_SHIELD_INTERCEPTOR_ACTIVE__) {
    return;
  }
  window.__BRAVE_SHIELD_INTERCEPTOR_ACTIVE__ = true;

  /* ==========================================================================
     1. Stealth & Native Function Masquerade (toString Spoofing)
     ========================================================================== */
  const nativeToString = Function.prototype.toString;
  const wrappedFunctionMap = new WeakMap();

  function makeNative(wrapperFn, originalFn) {
    try {
      if (typeof wrapperFn === 'function' && typeof originalFn === 'function') {
        wrappedFunctionMap.set(wrapperFn, originalFn);
      }
    } catch (e) {}
    return wrapperFn;
  }

  try {
    const customToString = function () {
      if (typeof this === 'function' && wrappedFunctionMap.has(this)) {
        const original = wrappedFunctionMap.get(this);
        return nativeToString.call(original);
      }
      return nativeToString.call(this);
    };

    // Make customToString itself appear native
    wrappedFunctionMap.set(customToString, nativeToString);

    Object.defineProperty(Function.prototype, 'toString', {
      value: customToString,
      writable: true,
      configurable: true,
      enumerable: false
    });
  } catch (e) {
    // If strict environment restricts prototype overriding, continue silently
  }

  /* ==========================================================================
     2. Statistical Reporting Bridge
     ========================================================================== */
  let prunedCounterBatch = 0;
  let batchTimer = null;

  function reportPrunedAds(count) {
    if (count <= 0) return;
    prunedCounterBatch += count;
    if (batchTimer) return;

    batchTimer = setTimeout(() => {
      try {
        window.postMessage(
          {
            source: 'BRAVE_SHIELD_INTERCEPTOR',
            action: 'AD_PRUNED',
            count: prunedCounterBatch
          },
          '*'
        );
      } catch (err) {}
      prunedCounterBatch = 0;
      batchTimer = null;
    }, 100);
  }

  /* ==========================================================================
     3. Deep Recursive JSON Pruning Engine
     ========================================================================== */
  const AD_KEYS_TO_DELETE = new Set([
    'adPlacements',
    'playerAds',
    'adSlots',
    'adBreakParams',
    'adBreakHeartbeatParams',
    'adBreakService',
    'adPlacementRenderer',
    'instreamAdPlayerOverlayRenderer',
    'adLayoutLoggingData',
    'linearAdSequenceRenderer',
    'playerLegacyDesktopWatchAdsRenderer',
    'enforcementMessageViewModel',
    'bkaEnforcementMessageViewModel',
    'adSlotRenderer',
    'inFeedAdLayoutRenderer',
    'promotedItemRenderer',
    'statementBannerRenderer',
    'promotedSparklesWebRenderer',
    'brandVideoSingletonRenderer',
    'brandVideoShelfRenderer',
    'unpluggedBlackoutsContext'
  ]);

  function deepPruneAds(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 25) {
      return 0;
    }

    let prunedCount = 0;

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        const item = node[i];
        if (item && typeof item === 'object') {
          // Check if item contains prominent ad markers
          const isAdItem =
            item.adPlacementRenderer ||
            item.adSlotRenderer ||
            item.inFeedAdLayoutRenderer ||
            item.promotedItemRenderer ||
            item.promotedSparklesWebRenderer ||
            item.statementBannerRenderer ||
            item.brandVideoSingletonRenderer ||
            item.brandVideoShelfRenderer ||
            (item.richItemRenderer &&
              item.richItemRenderer.content &&
              (item.richItemRenderer.content.adSlotRenderer ||
                item.richItemRenderer.content.inFeedAdLayoutRenderer));

          if (isAdItem) {
            node.splice(i, 1);
            prunedCount++;
          } else {
            prunedCount += deepPruneAds(item, depth + 1);
          }
        }
      }
      return prunedCount;
    }

    // Inspect object keys
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      if (AD_KEYS_TO_DELETE.has(key)) {
        try {
          delete node[key];
          prunedCount++;
        } catch (e) {
          node[key] = undefined;
          prunedCount++;
        }
        continue;
      }

      // Check auxiliaryUi for anti-adblock message renderers
      if (key === 'auxiliaryUi' && node.auxiliaryUi && node.auxiliaryUi.messageRenderers) {
        if (node.auxiliaryUi.messageRenderers.enforcementMessageViewModel) {
          delete node.auxiliaryUi.messageRenderers.enforcementMessageViewModel;
          prunedCount++;
        }
      }

      // Check playbackContext.adContext
      if (key === 'playbackContext' && node.playbackContext && node.playbackContext.adContext) {
        delete node.playbackContext.adContext;
        prunedCount++;
      }

      const val = node[key];
      if (val && typeof val === 'object') {
        prunedCount += deepPruneAds(val, depth + 1);
      }
    }

    return prunedCount;
  }

  /* ==========================================================================
     4. Property Traps: ytInitialPlayerResponse & ytInitialData
     ========================================================================== */
  function setupPropertyTrap(propName) {
    try {
      let internalValue = window[propName];

      if (internalValue && typeof internalValue === 'object') {
        const pruned = deepPruneAds(internalValue);
        reportPrunedAds(pruned);
      }

      Object.defineProperty(window, propName, {
        get() {
          return internalValue;
        },
        set(newValue) {
          try {
            if (newValue && typeof newValue === 'object') {
              const pruned = deepPruneAds(newValue);
              reportPrunedAds(pruned);
            }
          } catch (e) {}
          internalValue = newValue;
        },
        configurable: true,
        enumerable: true
      });
    } catch (err) {
      // Property might be non-configurable, fallback to direct mutation
      if (window[propName] && typeof window[propName] === 'object') {
        try {
          const pruned = deepPruneAds(window[propName]);
          reportPrunedAds(pruned);
        } catch (e) {}
      }
    }
  }

  setupPropertyTrap('ytInitialPlayerResponse');
  setupPropertyTrap('ytInitialData');

  /* ==========================================================================
     5. JSON.parse Monkey-Patching
     ========================================================================== */
  try {
    const originalJSONParse = JSON.parse;

    const hookedJSONParse = function (text, reviver) {
      const parsed = originalJSONParse.call(this, text, reviver);
      if (parsed && typeof parsed === 'object') {
        try {
          // Fast check before doing deep traversal
          if (
            parsed.adPlacements ||
            parsed.playerAds ||
            parsed.adSlots ||
            parsed.enforcementMessageViewModel ||
            parsed.contents ||
            parsed.onResponseReceivedActions ||
            parsed.onResponseReceivedEndpoints ||
            parsed.responseContext
          ) {
            const pruned = deepPruneAds(parsed);
            reportPrunedAds(pruned);
          }
        } catch (e) {}
      }
      return parsed;
    };

    makeNative(hookedJSONParse, originalJSONParse);
    JSON.parse = hookedJSONParse;
  } catch (err) {}

  /* ==========================================================================
     6. Response.prototype.json Monkey-Patching
     ========================================================================== */
  try {
    const originalResponseJson = Response.prototype.json;

    const hookedResponseJson = function () {
      return originalResponseJson.apply(this, arguments).then((data) => {
        if (data && typeof data === 'object') {
          try {
            const pruned = deepPruneAds(data);
            reportPrunedAds(pruned);
          } catch (e) {}
        }
        return data;
      });
    };

    makeNative(hookedResponseJson, originalResponseJson);
    Response.prototype.json = hookedResponseJson;
  } catch (err) {}

  /* ==========================================================================
     7. window.fetch Interception Engine
     ========================================================================== */
  try {
    const originalFetch = window.fetch;

    const hookedFetch = function (input, init) {
      const url =
        typeof input === 'string'
          ? input
          : input && input.url
          ? input.url
          : '';

      const isTargetEndpoint =
        url &&
        (url.includes('/youtubei/v1/player') ||
          url.includes('/youtubei/v1/next') ||
          url.includes('/youtubei/v1/browse') ||
          url.includes('/youtubei/v1/reel/reel_item_watch') ||
          url.includes('/youtubei/v1/search'));

      if (!isTargetEndpoint) {
        return originalFetch.apply(this, arguments);
      }

      return originalFetch.apply(this, arguments).then(async (response) => {
        try {
          // Clone the response to sanitize payload
          const clone = response.clone();
          const rawText = await clone.text();
          let data = originalJSONParse(rawText);

          if (data && typeof data === 'object') {
            const pruned = deepPruneAds(data);
            reportPrunedAds(pruned);

            const sanitizedBody = JSON.stringify(data);
            const headers = new Headers(response.headers);
            headers.set('content-length', sanitizedBody.length.toString());

            return new Response(sanitizedBody, {
              status: response.status,
              statusText: response.statusText,
              headers: headers
            });
          }
        } catch (e) {
          // If streaming or parsing fails, return original response
        }
        return response;
      });
    };

    makeNative(hookedFetch, originalFetch);
    window.fetch = hookedFetch;
  } catch (err) {}

  /* ==========================================================================
     8. XMLHttpRequest Interception Engine
     ========================================================================== */
  try {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalResponseTextDesc = Object.getOwnPropertyDescriptor(
      XMLHttpRequest.prototype,
      'responseText'
    );
    const originalResponseDesc = Object.getOwnPropertyDescriptor(
      XMLHttpRequest.prototype,
      'response'
    );

    const hookedXHROpen = function (method, url) {
      try {
        this.__brave_url = typeof url === 'string' ? url : url ? url.toString() : '';
      } catch (e) {}
      return originalXHROpen.apply(this, arguments);
    };

    const hookedXHRSend = function () {
      const isTarget =
        this.__brave_url &&
        (this.__brave_url.includes('/youtubei/v1/player') ||
          this.__brave_url.includes('/youtubei/v1/next') ||
          this.__brave_url.includes('/youtubei/v1/browse'));

      if (isTarget) {
        this.addEventListener('load', () => {
          try {
            if (this.responseType === '' || this.responseType === 'text') {
              const parsed = originalJSONParse(this.responseText);
              if (parsed && typeof parsed === 'object') {
                const pruned = deepPruneAds(parsed);
                reportPrunedAds(pruned);
                this.__brave_sanitized_text = JSON.stringify(parsed);
              }
            } else if (this.responseType === 'json' && this.response) {
              const pruned = deepPruneAds(this.response);
              reportPrunedAds(pruned);
            }
          } catch (e) {}
        });
      }

      return originalXHRSend.apply(this, arguments);
    };

    makeNative(hookedXHROpen, originalXHROpen);
    makeNative(hookedXHRSend, originalXHRSend);

    XMLHttpRequest.prototype.open = hookedXHROpen;
    XMLHttpRequest.prototype.send = hookedXHRSend;

    if (originalResponseTextDesc && originalResponseTextDesc.get) {
      Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
        get() {
          if (this.__brave_sanitized_text !== undefined) {
            return this.__brave_sanitized_text;
          }
          return originalResponseTextDesc.get.call(this);
        },
        configurable: true,
        enumerable: true
      });
    }

    if (originalResponseDesc && originalResponseDesc.get) {
      Object.defineProperty(XMLHttpRequest.prototype, 'response', {
        get() {
          if (
            (this.responseType === '' || this.responseType === 'text') &&
            this.__brave_sanitized_text !== undefined
          ) {
            return this.__brave_sanitized_text;
          }
          return originalResponseDesc.get.call(this);
        },
        configurable: true,
        enumerable: true
      });
    }
  } catch (err) {}

})();
