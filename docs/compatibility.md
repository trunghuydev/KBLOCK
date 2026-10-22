# KBlock — API Compatibility Matrix

> **Version:** 0.1.0-draft  
> **Last updated:** 2026-10-22  
> **Status:** Phase 0 — Research (not yet device-verified)  
> **Minimum target:** iOS 15.0 / Safari 15

---

## ⚠️ Verification Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Confirmed working (with source or device test) |
| ⚠️ | Partial or uncertain support — needs device test |
| ❌ | Not supported — avoid |
| 🔲 | Not yet tested — BLOCKED pending device |

---

## 1. Safari Web Extension API Support

### 1.1 Core Extension APIs

| API | iOS 15 | iOS 16 | iOS 17 | iOS 18 | Notes |
|-----|--------|--------|--------|--------|-------|
| Manifest V3 | ✅ | ✅ | ✅ | ✅ | Required format |
| Service Worker background | ✅ | ✅ | ✅ | ✅ | No persistent background pages |
| Content Scripts | ✅ | ✅ | ✅ | ✅ | Requires host permission |
| `browser.storage.local` | ✅ | ✅ | ✅ | ✅ | Use for extension-side storage |
| `browser.storage.sync` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Safari has custom behavior; not iCloud sync |
| Popup (browser action) | ✅ | ✅ | ✅ | ✅ | Safari toolbar button |
| Native Messaging | ✅ | ✅ | ✅ | ✅ | App ↔ Extension messaging |
| App Group shared container | ⚠️ | ⚠️ | ✅ | ✅ | Needs entitlement; behavior varies |

### 1.2 declarativeNetRequest (DNR) API

| Feature | iOS 15 | iOS 16 | iOS 17 | iOS 18 | Notes |
|---------|--------|--------|--------|--------|-------|
| `declarativeNetRequest` permission | ✅ | ✅ | ✅ | ✅ | Basic support from iOS 15 |
| Static rulesets (`rule_resources`) | ✅ | ✅ | ✅ | ✅ | Compiled at install time |
| `action: block` | ✅ | ✅ | ✅ | ✅ | Core blocking |
| `action: allow` | ✅ | ✅ | ✅ | ✅ | Whitelist/exception |
| `action: redirect` | ⚠️ | ✅ | ✅ | ✅ | Limited in iOS 15 |
| `action: modifyHeaders` | ⚠️ | ⚠️ | ✅ | ✅ | Partial in earlier iOS |
| `updateDynamicRules()` | ⚠️ | ⚠️ | ✅ | ✅ | Dynamic rules (whitelist) |
| `updateSessionRules()` | ❌ | ❌ | ⚠️ | ⚠️ | Avoid for V1 |
| `regexFilter` rules | ⚠️ | ⚠️ | ✅ | ✅ | Complex regex may be slow |
| `isUrlFilterCaseSensitive` | ✅ | ✅ | ✅ | ✅ | |
| `initiatorDomains` | ✅ | ✅ | ✅ | ✅ | |
| `requestDomains` | ✅ | ✅ | ✅ | ✅ | |
| `declarativeNetRequestFeedback` | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Stats; partial support |
| Max static rules per ruleset | 50,000 | 50,000 | 50,000 | 50,000 | Approximate; not officially documented |
| Max static rulesets | 50 | 50 | 50 | 50 | Per Manifest V3 spec |
| Max dynamic rules | ⚠️ | ⚠️ | ~5,000 | ~5,000 | Not officially documented for Safari |

### 1.3 Content Script APIs

| Feature | iOS 15 | iOS 16 | iOS 17 | iOS 18 | Notes |
|---------|--------|--------|--------|--------|-------|
| DOM access | ✅ | ✅ | ✅ | ✅ | Standard |
| `MutationObserver` | ✅ | ✅ | ✅ | ✅ | For dynamic ad injection |
| `window.open` interception | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Possible but fragile; site-specific |
| Modify page styles | ✅ | ✅ | ✅ | ✅ | CSS injection via content script |
| `browser.runtime.sendMessage` | ✅ | ✅ | ✅ | ✅ | Communicate with background |
| `document_start` injection | ✅ | ✅ | ✅ | ✅ | Needed for early popup suppression |
| Cross-origin iframe access | ❌ | ❌ | ❌ | ❌ | Not allowed |

---

## 2. iOS-Specific Constraints

### 2.1 Extension Lifecycle

- Safari Web Extensions on iOS run as **non-persistent background scripts** (Service Workers).
- The service worker can be **suspended by iOS** at any time; no persistent background processing.
- Extensions **must** re-register DNR rulesets each time the service worker restarts from cold.
- Static rulesets declared in `manifest.json` are automatically applied without JS code.

### 2.2 Extension Enable/Disable State

- Users must manually enable the extension in **Settings → Safari → Extensions → KBlock**.
- The iOS app **cannot programmatically enable the extension**.
- The app can only detect if the extension is running via `SFSafariExtensionManager.getStateOfSafariExtension()`.
- The app UI must guide users to enable the extension manually.

### 2.3 Permission Model

- `<all_urls>` host permission triggers a user prompt in Safari.
- Users can restrict to **specific websites** or **ask each time**.
- If the user restricts permissions, DNR still applies (it's network-level) but content scripts may not run.
- **V1 recommendation:** Request `<all_urls>` and educate users about why it's needed.

---

## 3. SideStore Sideloading Constraints

| Constraint | Detail |
|-----------|--------|
| Certificate validity | 7 days (free Apple ID) |
| App IDs per week | 10 maximum (free account) |
| KBlock App IDs consumed | ~2: one for `dev.kblock.KBlock`, one for `dev.kblock.KBlock.Extension` |
| Re-signing frequency | Every 7 days manually or via SideStore auto-refresh |
| Extension preservation | Must select "Keep App Extension" during SideStore install |
| Background refresh | SideStore uses local WireGuard VPN; requires iPhone always connected |
| iOS version requirement | iOS 14+ for SideStore; iOS 15+ for Safari Web Extension |

### SideStore-Specific Risks

1. **Extension stripped during re-sign:** SideStore may not preserve the Safari Web Extension binary if the App ID for the extension target is not registered in the developer account.
2. **7-day expiry kills extension:** When the cert expires, Safari silently disables the extension. Users must refresh via SideStore.
3. **App ID limit conflict:** If the user has other SideStore apps with extensions, they may hit the 10 App ID limit.

---

## 4. macOS / Xcode Requirements

| Task | Minimum Xcode | Minimum macOS | Notes |
|------|--------------|--------------|-------|
| Build iOS app target | Xcode 14 | Ventura 13.x | Swift, SwiftUI |
| Build Safari Web Extension | Xcode 14 | Ventura 13.x | Generates JS wrapper |
| Archive for IPA export | Xcode 14 | Ventura 13.x | Development signing |
| Test on Simulator | Xcode 14 | Ventura 13.x | Safari Extension may not work fully in Sim |
| Test on device | Xcode 14 | Ventura 13.x | Requires physical iPhone |
| Provisioning for SideStore | N/A | N/A | Free Apple ID, no paid Developer Program needed |

> **Note:** Xcode 15+ (macOS Sonoma) is recommended for latest SDK compatibility with iOS 17/18.

---

## 5. Filter Syntax Compatibility

### 5.1 EasyList / ABP Syntax Support in DNR

| Syntax Feature | DNR Support | Notes |
|----------------|-------------|-------|
| Basic domain block (`||example.com^`) | ✅ | Direct `domain` + `urlFilter` |
| Basic URL pattern block | ✅ | `urlFilter` |
| Exception rules (`@@`) | ✅ | `action: allow` |
| Element hiding (`##`) | ❌ via DNR | Handled by content script CSS injection |
| Script injection (`##+js()`) | ❌ | Not supported in Safari at all |
| `$third-party` modifier | ✅ | `domainType: thirdParty` |
| `$script`, `$image`, etc. | ✅ | `resourceTypes` array |
| `$domain=` modifier | ✅ | `initiatorDomains` |
| `$redirect=` | ⚠️ | Partial; only built-in redirects |
| `$csp=` | ❌ | Not supported |
| `$xhr` | ✅ | `resourceTypes: ["xmlhttprequest"]` |
| Regex in URL filter | ⚠️ | `regexFilter`; complex regex slow on iOS |
| `$important` | ⚠️ | Priority system; verify behavior |
| `$badfilter` | ❌ | Not in DNR spec |
| ABP extended CSS | ❌ | Not applicable to DNR |
| uBO procedural filters | ❌ | Not supported at all |

### 5.2 Unsupported Syntax Handling Policy

Rules with unsupported syntax must be:
1. Logged to the conversion report
2. Skipped (not silently converted with changed meaning)
3. Counted in the "skipped" total
4. NOT cause the entire ruleset to fail

---

## 6. Node.js / TypeScript (Filter Engine)

| Tool | Version | Status |
|------|---------|--------|
| Node.js | v22.23.3 LTS | ✅ Confirmed on dev machine |
| npm | 10.9.9 | ✅ Confirmed |
| TypeScript | 5.x | Will install via npm |
| Vitest | 2.x | Will install via npm |
| ESLint | 9.x | Will install via npm |
| Prettier | 3.x | Will install via npm |

---

## 7. APIs Explicitly Not Used in V1

| API | Reason excluded |
|-----|----------------|
| `webRequest` / `webRequestBlocking` | Deprecated in MV3; not needed if DNR is sufficient |
| `chrome.browsingData` | Not needed; no data collection |
| Safari Content Blocker (NSExtension) | Superseded by Safari Web Extension |
| DNS-over-HTTPS / Network Extension | V1 scope exclusion |
| Push Notifications | Not needed |
| CloudKit / iCloud sync | V1 scope exclusion; added complexity |
| App Store In-App Purchase | Product is free, no purchase needed |

---

## 8. Verification Checklist (BLOCKED — Requires Mac + iPhone)

The following cannot be verified on Windows and are marked BLOCKED:

- [ ] 🔲 Build succeeds on macOS/Xcode
- [ ] 🔲 App runs on real iPhone (iOS 15, 16, 17, or 18)
- [ ] 🔲 Extension appears in Safari Settings → Extensions
- [ ] 🔲 Extension can be enabled in Safari
- [ ] 🔲 Static DNR rule blocks test request
- [ ] 🔲 Dynamic rule (`updateDynamicRules`) works for whitelist
- [ ] 🔲 Content script runs on allowed domain
- [ ] 🔲 App Group shared container readable by extension
- [ ] 🔲 IPA installed via SideStore
- [ ] 🔲 Extension preserved after SideStore re-sign
- [ ] 🔲 `SFSafariExtensionManager` status detection works
