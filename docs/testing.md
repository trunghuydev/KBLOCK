# KBlock Testing Strategy and Guidelines

This document details the test suites, verification procedures, and acceptance criteria across all components of KBlock.

---

## 1. Automated Test Suites

### 1.1 Filter Engine (`packages/filter-engine`)

- **Framework**: [Vitest](https://vitest.dev/)
- **Configuration**: `packages/filter-engine/vitest.config.ts`
- **Execution**:
  ```bash
  # From workspace root
  npm test

  # Or inside package
  cd packages/filter-engine
  npm test
  ```
- **Coverage Areas**:
  1. **Parser Tests (`tests/parser.test.ts`)**:
     - Network block & allow rules syntax (`||`, `@@`, `^`, options).
     - Global and domain-scoped element hide rules (`##`, `#@#`).
     - Comment & filter metadata extraction (`Title`, `Version`, `License`).
     - Explicit detection of unsupported features (`##+js`, `$redirect`, `$csp`, `$badfilter`, `:has`).
     - Error safety: empty strings, whitespace, 5MB memory guard, 1000-line batches.
  2. **Converter Tests (`tests/converter.test.ts`)**:
     - DeclarativeNetRequest rule generation (`id`, `priority`, `action`, `condition`).
     - Priority hierarchy (allow > block, `$important` bonus).
     - Resource type translation (`$script`, `$image`, `$stylesheet`, etc.).
     - Domain conditions (`$third-party`, `initiatorDomains`, `excludedInitiatorDomains`).
     - Rule deduplication.
     - Production sanitization (`stripDebugComments`).
  3. **Fixture Tests (`tests/fixtures.test.ts`)**:
     - End-to-end regression testing with real-world EasyList syntax snapshots.

---

### 1.2 TypeScript Static Type Checks

All TypeScript packages in the monorepo must compile with zero errors:

```bash
# Check all packages from root
npm run check
```

---

## 2. Extension Verification

### 2.1 Extension Build
```bash
cd apps/safari-extension
npm run build
```
Verify that `apps/safari-extension/dist/` contains:
- `manifest.json` (Valid MV3 schema with Safari compatibility)
- `background/background.js` (Compiled service worker)
- `content/content.js` (Popup blocker & element cleaner)
- `popup/popup.{html,css,js}` (UI bundle)
- `rules/base.json` (Static DNR rules)

---

## 3. Manual Device Testing (Safari on iOS)

When testing via SideStore on a physical iPhone or iOS Simulator:

1. **Extension Activation Gate**:
   - Go to iOS **Settings** > **Safari** > **Extensions**.
   - Verify **KBlock** appears in the list.
   - Enable KBlock and grant permission: **All Websites** > **Always Allow**.
2. **Ad-Blocking Verification**:
   - Open Safari and navigate to a test page (e.g., `dantri.com.vn`, `vnexpress.net`, or ad-test sites).
   - Verify banner ads and known ad scripts are blocked.
   - Inspect network log (via Mac Safari Develop menu if connected).
3. **Popup Blocker Verification**:
   - Navigate to test sites with trigger popups.
   - Confirm automatic `window.open` popups within the initial 500ms are suppressed without blocking user-initiated actions.
4. **Whitelist Verification**:
   - Tap the Safari extension puzzle piece icon > **KBlock**.
   - Toggle **Pause on this site**.
   - Refresh page and verify ads/elements are no longer blocked on that domain.
