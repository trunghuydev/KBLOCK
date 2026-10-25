# KBlock iOS Native App & Safari Extension Setup

This document provides instructions for generating, configuring, and building the KBlock iOS app and Safari Web Extension using Xcode on macOS.

---

## 1. Project Specifications

| Target | Value |
| :--- | :--- |
| **Project Name** | `KBlock` |
| **Minimum iOS Version** | iOS 15.0 (Deployment Target) |
| **Swift Version** | Swift 5.9+ |
| **Main App Bundle ID** | `dev.kblock.KBlock` |
| **Extension Bundle ID** | `dev.kblock.KBlock.Extension` |
| **App Group Identifier** | `group.dev.kblock.shared` |
| **Signing / Team** | Personal Team (Free Apple ID) or Developer Account |

---

## 2. Generating the Xcode Project on macOS

```bash
# 1. Install xcodegen if not already present
brew install xcodegen

# 2. Build the Safari extension: filter pipeline (downloads ABPVN, EasyList,
#    EasyPrivacy and converts them to DNR rulesets) + JS bundle + sync into
#    apps/ios/Extension/Resources/
cd ../safari-extension
npm install
npm run build
cd ../ios

# 3. Generate Xcode project
xcodegen generate
```

Notes on the filter pipeline:

- `npm run build` runs `build-filters.mjs` first. It fetches the community
  lists (~4 MB, cached for 24h in `.filter-cache/`) and generates
  `src/rules/generated/` — **ABPVN + EasyList + EasyPrivacy ≈ 107,000 DNR
  rules** plus an element-hide CSS bundle.
- Offline / no cache? It writes harmless 1-rule stubs instead, so the
  extension always loads; committed stubs keep a fresh clone buildable.
- The generated (real) files are intentionally left uncommitted — don't
  commit them unless you accept distributing the lists (see
  `filters/sources.json` legal notes).
- Force-refresh lists anytime: `npm run build:filters` (repo root) or
  `npm run build:filters --prefix apps/safari-extension`.

> The Xcode build copies `Extension/Resources` (a folder reference) into the
> appex, so re-running `npm run build` in `safari-extension` is enough to
> refresh the extension — no project regeneration needed.

---

## 3. App Group — Required for App ↔ Extension Sync

Both targets declare `group.dev.kblock.shared` via `CODE_SIGN_ENTITLEMENTS` in `project.yml`. This is how:

- the app pushes config (toggle, whitelist, custom rules…) to the extension, and
- the extension pushes stats/activity back to the app.

**Caveat with a free (personal) Apple ID:** personal teams cannot create arbitrary App Groups. If signing/installing fails with an entitlement error, open all three `.entitlements` files (app, extension, widget) and remove the App Group entry — the app and extension still work standalone (the app will show a "Thiếu App Group" warning card), they just won't sync with each other and the widget will show zeros.

---

## 4. What Ships in the App

| Target | Role |
| :--- | :--- |
| `KBlock` | SwiftUI app: trạng thái, bộ lọc, whitelist, bộ lọc tùy chỉnh, nhật ký chặn |
| `Extension` | Safari Web Extension: DNR rulesets, cosmetic, anti-popup, element picker, cookie banners |
| `KBlockWidget` | Widget màn hình chính hiển thị số quảng cáo đã chặn (đọc App Group) |

After installing, activate the extension once: **Settings → Safari → Extensions → KBlock → Allow + All Websites**. Add the widget from the home screen: long-press → **+** → search "KBlock".

---

## 5. Exporting IPA for SideStore

1. Select **Any iOS Device (arm64)** as destination.
2. Menu: **Product** > **Archive**.
3. In Organizer: **Distribute App** > **Development** or **Ad Hoc**.
4. Export options:
   - Include extension: **YES** (`dev.kblock.KBlock.Extension`).
5. Save the resulting `KBlock.ipa`.
6. Follow [sideloading.md](../docs/sideloading.md) to install via SideStore on your device.
