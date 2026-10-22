# KBlock — Architecture Document

> **Version:** 0.1.0-draft  
> **Last updated:** 2026-10-22  
> **Status:** Phase 0 — Survey & Planning  
> **Author:** AI Engineering Agent (Phase 0 survey)

---

## 1. Product Overview

**KBlock** is a free, open-source Safari ad-blocker for iOS. It uses a Safari Web Extension (not a legacy Content Blocker Extension) to intercept and block ads, trackers, popups, and redirects — with a focus on Vietnamese websites.

**Non-goals (V1):**
- No subscription, no Pro tier, no ads
- No account creation required
- No browsing history sent to any KBlock server
- No DNS/VPN system-wide blocking (V1 only)
- No second extension target

---

## 2. V1 Architecture: One App + One Extension

```
KBlock.app (iOS Native Container)
│
├── KBlock iOS App (SwiftUI)
│   ├── HomeView
│   ├── FiltersView
│   ├── WebsitesView (Whitelist)
│   ├── AntiPopupView
│   └── SettingsView
│
└── KBlock Extension (Safari Web Extension — single target)
    ├── manifest.json          (Manifest V3)
    ├── background/
    │   └── background.ts      (Service worker)
    ├── content/
    │   └── content.ts         (Content script)
    ├── popup/
    │   ├── popup.html
    │   └── popup.ts
    └── rules/
        ├── base.json          (Static DNR ruleset — bundled)
        └── custom.json        (Dynamic rules — user whitelist)
```

### Rationale: Single Safari Web Extension

A Safari Web Extension uses the standard WebExtension API (same as Chrome/Firefox MV3) wrapped in a native iOS app target. This is the **only** V1 extension target. Reasons:

1. Apple requires a native app container to distribute Safari Web Extensions on iOS.
2. One extension target keeps provisioning, signing, and App ID consumption manageable.
3. Safari Web Extensions support both `declarativeNetRequest` (for network-level blocking) **and** content scripts (for DOM-level popup/overlay removal) within the same target.

### Why NOT a separate Content Blocker Extension

- Content Blocker Extensions (the older `NSExtension` model) are limited to exactly one JSON ruleset, no dynamic updates from JavaScript, and no content script capability.
- Safari Web Extensions are a strict superset.
- Maintaining two separate extension targets doubles provisioning complexity, especially critical for SideStore sideloading (free Apple ID allows only 10 App IDs/week).

---

## 3. Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ iOS App (SwiftUI)                                                │
│                                                                  │
│  User toggles filter  ──►  App Group shared UserDefaults/JSON   │
│  User adds whitelist  ──►  App Group shared storage             │
│  App updates filters  ──►  Writes updated DNR JSON to           │
│                             App Group container                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │  App Group (shared container)
                                 │  group.dev.kblock.shared
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Safari Web Extension (background service worker)                 │
│                                                                  │
│  Reads config from App Group  ──►  Loads/updates DNR rulesets   │
│  Receives messages from app   ──►  Updates dynamic rules        │
│  Listens for webRequest       ──►  Logs stats (local only)      │
└────────────────────────────────┬────────────────────────────────┘
                                 │  declarativeNetRequest (DNR)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Safari Network Layer                                             │
│  ● Block / allow / redirect requests based on static rulesets   │
│  ● Apply dynamic whitelist rules                                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │  Content Script injection
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Web Page DOM                                                     │
│  ● Remove overlay ads                                            │
│  ● Suppress popup window.open() calls                           │
│  ● Handle redirect interception                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Module Breakdown

### 4.1 iOS App (`apps/ios/`)

| Module | Technology | Responsibility |
|--------|-----------|----------------|
| `KBlockApp.swift` | SwiftUI | App entry point |
| `HomeView.swift` | SwiftUI | Status dashboard |
| `FiltersView.swift` | SwiftUI | Filter source management |
| `WebsitesView.swift` | SwiftUI | Whitelist editor |
| `AntiPopupView.swift` | SwiftUI | Popup protection settings |
| `SettingsView.swift` | SwiftUI | Privacy, licenses, export |
| `FilterManager.swift` | Swift | Download, validate, store filters |
| `RulesetWriter.swift` | Swift | Write DNR JSON to App Group |
| `SharedConfig.swift` | Swift | App Group UserDefaults bridge |

### 4.2 Safari Web Extension (`apps/safari-extension/`)

| Module | Technology | Responsibility |
|--------|-----------|----------------|
| `manifest.json` | JSON | Declares permissions, rulesets, content scripts |
| `background.ts` | TypeScript | Service worker, messaging, DNR dynamic rule updates |
| `content.ts` | TypeScript | DOM mutation, popup suppression, overlay removal |
| `popup.ts` | TypeScript | Extension popup UI logic |
| `rules/base.json` | JSON | Static bundled DNR rules (core blocklist) |

### 4.3 Filter Engine (`packages/filter-engine/`)

| Module | Technology | Responsibility |
|--------|-----------|----------------|
| `parser.ts` | TypeScript | Parse EasyList/ABP/uBO filter syntax |
| `converter.ts` | TypeScript | Convert parsed rules to DNR JSON format |
| `validator.ts` | TypeScript | Validate converted rules, detect conflicts |
| `reporter.ts` | TypeScript | Generate conversion reports |
| `versioning.ts` | TypeScript | Ruleset versioning and metadata |

### 4.4 Filter Definitions (`filters/`)

| File | Purpose |
|------|---------|
| `sources.json` | Metadata for each filter source (URL, license, version) |
| `custom/` | User-added custom rules directory |

---

## 5. Extension Permissions (Minimal Viable)

```json
{
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "optional_host_permissions": []
}
```

**Not requested:**
- `tabs` (only if popup stats feature is needed)
- `history`
- `cookies`
- `webNavigation` (only if redirect detection is needed)
- No analytics endpoints in `externally_connectable`

---

## 6. App Group / Data Sharing

The iOS app and the Safari Web Extension communicate via:

1. **App Group shared container** (`group.dev.kblock.shared`):
   - `UserDefaults(suiteName:)` for simple flags
   - JSON files written by the iOS app, read by the extension background

2. **Native messaging** (`browser.runtime.sendNativeMessage`):
   - Used for real-time updates (e.g., user just toggled a filter)
   - Requires `NativeMessagingHosts` entitlement

> **Compatibility note:** The exact behavior of App Group sharing between iOS app and Safari Web Extension varies by iOS version. This must be verified on device in Phase 1. The fallback is for the extension to read a shared JSON file on startup.

---

## 7. Blocking Strategy

### Layer 1: declarativeNetRequest (DNR)

- **When:** Network request is made (before content loads)
- **What:** Block known ad/tracker domains and URL patterns
- **Limitations:** 
  - Static rules compiled at install time
  - Dynamic rules limited (see Compatibility doc)
  - Cannot inspect response body

### Layer 2: Content Scripts

- **When:** Page DOM is ready
- **What:** Remove overlay elements, suppress popup scripts
- **Limitations:**
  - Only works on pages where permission is granted
  - Safari requires explicit host permission or user approval
  - Cannot intercept native iOS UI elements

### Layer 3: User Whitelist

- **When:** Domain/URL matched against whitelist
- **What:** DNR exception rules added dynamically
- **Storage:** App Group shared JSON, loaded at extension startup

---

## 8. Filter Pipeline

```
Community Filter Source (URL)
         │
         ▼
    HTTP Fetch (iOS App)
         │
         ▼
    Size Check (< 5MB)
         │
         ▼
    Parser (EasyList syntax → AST)
         │
    ┌────┴────┐
    │ Errors  │──► Error Report (skip invalid rules)
    └────┬────┘
         │
         ▼
    Converter (AST → DNR JSON)
         │
    ┌────┴────┐
    │ Unsup.  │──► Unsupported Rules Report
    └────┬────┘
         │
         ▼
    Validator (DNR schema check, duplicate detection)
         │
         ▼
    Version + Timestamp
         │
         ▼
    Write to App Group Container
         │
         ▼
    Extension loads updated ruleset
         │
         ▼
    Old ruleset kept as rollback backup
```

---

## 9. SideStore Sideloading Architecture

```
Xcode (macOS) ──► Archive ──► Export IPA
                               │
                               ▼
                         SideStore (on-device)
                               │
                         Signs with free Apple ID
                               │
                         Installs KBlock.app
                         (includes Extension bundle)
                               │
                         Safari Settings → Extensions → KBlock
```

**Critical constraint:** The extension is signed with the same certificate as the parent app. SideStore must keep the app extension bundle during signing. If prompted, choose **"Keep App Extension"** with the matching profile.

---

## 10. Build Environments

| Task | Environment | Notes |
|------|------------|-------|
| Filter engine (TS) | Windows / any Node.js | Fully supported |
| Extension JS/TS | Windows / any Node.js | Fully supported |
| iOS app (Swift) | **macOS + Xcode only** | Cannot build on Windows |
| Archive & IPA export | **macOS + Xcode only** | Cannot build on Windows |
| Sign for distribution | **macOS + Apple account** | Free account: 7-day cert |
| Device testing | **iPhone + SideStore** | Required for real validation |

---

## 11. Open Questions (Phase 0)

| # | Question | Risk | Decision needed by |
|---|----------|------|-------------------|
| Q1 | Does App Group sharing work reliably between iOS app and Safari Web Extension on iOS 15/16/17? | HIGH | Phase 1 device test |
| Q2 | Does `updateDynamicRules` work in Safari Web Extension on iOS for whitelist? | HIGH | Phase 1 device test |
| Q3 | Does SideStore preserve Safari Web Extension bundle correctly across re-sign cycles? | HIGH | Phase 1 device test |
| Q4 | What is the actual max static rule count in current iOS Safari? (50k per ruleset?) | MEDIUM | Phase 2 research |
| Q5 | Does ABPVN (GPL-3.0) allow bundling in MPL-2.0 codebase for non-commercial distribution? | MEDIUM | Phase 3 legal review |
| Q6 | Can content scripts suppress `window.open` in Safari Web Extension? | MEDIUM | Phase 4 device test |
| Q7 | Free Apple ID: 10 App IDs/week — does KBlock + Extension consume 2 App IDs? | HIGH | Phase 1 signing |
