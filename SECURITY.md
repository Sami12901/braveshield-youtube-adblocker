# Security Policy

BraveShield is designed with a defense-in-depth architecture to ensure end-user privacy, performance, and safety.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security & Architecture Principles

### 1. 100% Offline & Zero Telemetry
This extension runs entirely inside your local browser. It makes **zero network requests** to external servers, sends **no analytics or telemetry**, and does not collect any user data.

### 2. Principle of Least Privilege
Permissions in `manifest.json` are strictly constrained to what is technically necessary:
- **`declarativeNetRequest`**: Executes network-level blocking of ad endpoints locally within the Chromium engine.
- **`storage`**: Persists your toggle preferences and local block counts on your device.
- **`tabs` / `activeTab`**: Used only when clicking "Quick Refresh" to reload the active YouTube tab.
- **Host Permissions**: Restricted strictly to `*://*.youtube.com/*`.

### 3. Defensive Code Hardening
- **Prototype Pollution Defense**: Key-level filtering skips `__proto__`, `constructor`, and `prototype` in recursive pruning routines.
- **Circular Reference Immunity**: Uses a `WeakSet` visited-tracker to guarantee zero stack overflow issues.
- **Strict PostMessage Isolation**: All inter-world communication is locked to `window.location.origin` with a whitelisted set of actions and sanitized numerical boundaries.
- **State Preservation**: Video playback rates and audio volume states are restored immediately upon ad elimination.

## Reporting a Vulnerability

If you discover a security vulnerability or bypass vector in BraveShield:
1. Please open an issue on GitHub or email the maintainer at `mdsamiislam2006@gmail.com`.
2. Provide details on how to reproduce the issue.
3. Vulnerabilities will be addressed and patched promptly.
