# Changelog

All notable changes to the **BraveShield YouTube AdBlocker** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-29

### 🛡️ Security & Defensive Hardening
- **Playback State Restoration**: Added automatic preservation and restoration of `video.playbackRate` and audio unmuted state in `player-guard.js` so user media is never left muted or playing at 16x speed after an ad finishes.
- **Cross-Origin PostMessage Guard**: Replaced wildcard target origin `*` with strict `window.location.origin` in `interceptor.js` and `player-guard.js`. Prevents embedded third-party iframes from intercepting internal telemetry messages.
- **Origin Validation & Action Whitelisting**: Added strict origin verification (`event.origin === window.location.origin`) and an explicit whitelist of allowed actions (`ALLOWED_ACTIONS`) in `content-bridge.js`.
- **Input Sanitization & DoS Prevention**: Implemented number validation and bounding (`1 <= count <= 1000`) for block telemetry to protect the background service worker from memory corruption or invalid values.
- **Prototype Pollution Defense**: Hardened `deepPruneAds` in `interceptor.js` to strictly ignore `__proto__`, `constructor`, and `prototype` property keys.
- **Circular Reference Protection**: Integrated a `WeakSet` visited-tracker into recursive JSON traversal to prevent call-stack overflows and infinite loops on cyclic YouTube objects.
- **Object.defineProperty Trap Shielding**: Intercepted `Object.defineProperty` on `window` to prevent YouTube's frontend scripts from un-trapping or overriding `ytInitialPlayerResponse` and `ytInitialData`.
- **Least-Privilege Host Permissions**: Stripped unnecessary `googlevideo.com` and `doubleclick.net` host permissions from `manifest.json`, keeping only `*://*.youtube.com/*` for minimal surface exposure and full compliance with Chrome Web Store policies.
- **Fetch Body Guard**: Protected `response.clone()` with `response.bodyUsed` validation to prevent unhandled TypeErrors on streamed responses.

### 🚀 Initial Core Features
- **Main-World Scriptlet Injection**: Intercepts `window.ytInitialPlayerResponse` and `window.ytInitialData` at `document_start` in `MAIN` world.
- **Stealth Native Masquerade**: Fully transparent `Function.prototype.toString` spoofing.
- **Real-Time 50ms Watchdog**: Instant ad fast-forwarding, muting, and auto-skipping.
- **Anti-Adblock Popup Destroyer**: Deletes enforcement warnings, cleans backdrops, and auto-resumes playback.
- **Sponsored Shorts Skipper**: Automatically navigates past sponsored YouTube Shorts.
- **Zero-Gap CSS Filtering**: Employs CSS `:has()` pseudo-classes for seamless grid layout.
- **Declarative Net Request Engine**: 20 static blocking rules targeting ad and telemetry domains.
- **Brave Shields Dashboard**: Dark-slate popup UI with live session and lifetime metrics.
