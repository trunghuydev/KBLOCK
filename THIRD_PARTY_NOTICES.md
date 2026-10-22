# Third-Party Notices

This file lists third-party software components used in KBlock and their respective licenses.

> **Last updated:** 2026-10-22  
> **Status:** Placeholder — to be updated as dependencies are added in each phase.

---

## KBlock Source Code License

KBlock original source code (Swift, TypeScript, HTML/CSS) is licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.  
See [LICENSE](./LICENSE) for the full text.

---

## Filter Lists

> ⚠️ Filter lists are NOT licensed under MPL-2.0. Each list retains its own license.  
> KBlock does NOT modify the meaning or intent of filter rules when converting them.  
> KBlock does NOT redistribute filter list source files; it downloads them at runtime.

See [FILTER_SOURCES.md](./FILTER_SOURCES.md) for full details of filter list sources and licenses.

---

## Runtime Dependencies (TypeScript / Node.js)

_To be populated in Phase 2 when filter-engine dependencies are finalized._

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| (TBD) | | | |

---

## iOS App Dependencies (Swift / Xcode)

_No third-party iOS dependencies planned for V1. All UI is native SwiftUI._

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| (none planned) | | | |

---

## Development Tools (not bundled in app)

The following tools are used during development but are NOT included in the distributed app or extension:

| Tool | License | Notes |
|------|---------|-------|
| TypeScript | Apache-2.0 | Compiler only |
| Vitest | MIT | Test runner |
| ESLint | MIT | Linter |
| Prettier | MIT | Formatter |
| Node.js | MIT/various | Runtime for build tools |
| Xcode | Apple EULA | Build tool, not redistributed |

---

## How to Update This File

When adding a new dependency:
1. Run `npm license-checker` or equivalent to get the license
2. Verify the license allows use in this project
3. Add an entry to the appropriate section above
4. If the dependency is GPL-2.0-or-later, GPL-3.0, or AGPL, consult the project owner before adding
