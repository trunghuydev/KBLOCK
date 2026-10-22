# KBlock Filter Pipeline Specification

This document details the architecture and operational flow of the KBlock filter list processing pipeline, from upstream sources to Safari's DeclarativeNetRequest (DNR) execution.

---

## 1. Pipeline Overview

```
┌─────────────────────────┐
│  Upstream Filter Lists  │  (ABPVN, EasyList, AdGuard, etc.)
└────────────┬────────────┘
             │ (Download at runtime / local cache)
             ▼
┌─────────────────────────┐
│  Parser (@kblock/...)   │  (packages/filter-engine/src/parser.ts)
│  - 5MB input size guard │
│  - AST generation       │
│  - Unsupported audit    │  (Never silently changes rule meaning)
└────────────┬────────────┘
             │
             ├──► AST (ParsedNetworkRule, ParsedElementHideRule, ...)
             │
             ▼
┌─────────────────────────┐
│ Converter (@kblock/...) │  (packages/filter-engine/src/converter.ts)
│  - DNR Rules Generation │
│  - Priority Assignment  │
│  - Element Hide Select  │
│  - Deduplication        │
└────────────┬────────────┘
             │
             ├──► DNR Rules (`rules/*.json` or dynamic rules in Extension)
             └──► Element Hiding Selectors (for content script CSS injection)
```

---

## 2. Syntax Support Matrix

KBlock strictly adheres to a **no-silent-corruption** principle. If a rule cannot be accurately represented in Apple's Safari DeclarativeNetRequest API, it is explicitly classified as `unsupported` with a precise reason.

| Syntax Pattern | Type | Supported in KBlock | DNR Target / Handling |
| :--- | :--- | :---: | :--- |
| `\|\|example.com^` | Network Block | Yes | `condition.urlFilter: "\|\|example.com^"`, `action.type: "block"` |
| `@@\|\|example.com^` | Network Allow | Yes | `action.type: "allow"`, elevated priority (`+1000`) |
| `\|\|ad.com^$third-party` | Domain modifier | Yes | `condition.domainType: "thirdParty"` |
| `\|\|ad.com^$~third-party` | Inverted domain | Yes | `condition.domainType: "firstParty"` |
| `\|\|ad.com^$domain=a.com\|~b.com` | Specific domains | Yes | `initiatorDomains`, `excludedInitiatorDomains` |
| `\|\|ad.com^$script,image` | Resource types | Yes | `condition.resourceTypes: ["script", "image"]` |
| `\|\|ad.com^$important` | High priority | Yes | `priority: priority + 500` |
| `example.com##.ad-class` | Element hide | Yes | Collected for Content Script CSS injection |
| `##.global-ad` | Global hide | Yes | Global CSS injection (`display: none !important`) |
| `example.com#@#.ad-class` | Hide exception | Yes | Exception registry in Content Script |
| `##+js(set, ...)` | Scriptlet injection | No | Skipped (`reason: "script-injection"`) |
| `example.com##div:has(...)` | Extended CSS | No | Skipped (`reason: "extended-css"`) |
| `\|\|ad.com^$redirect=...` | Redirection | No | Skipped (`reason: "redirect"`) |
| `\|\|ad.com^$csp=...` | CSP modifier | No | Skipped (`reason: "csp"`) |
| `\|\|ad.com^$badfilter` | Invalidate rule | No | Skipped (`reason: "badfilter"`) |

---

## 3. Priority Hierarchy

Safari DNR resolves competing rules based on `priority`. KBlock assigns priorities deterministically:

1. **User Whitelist**: Highest priority (`priority >= 10,000`). When a user whitelists a site in the popup, dynamic allow rules override all filter lists.
2. **Filter Allow Rules ($important)**: `priority = 1,600`
3. **Filter Allow Rules (Standard)**: `priority = 1,100`
4. **Filter Block Rules ($important)**: `priority = 600`
5. **Filter Block Rules (Standard)**: `priority = 100`

---

## 4. Rule Budgets and iOS Constraints

- **Static Ruleset Limit**: 50,000 rules per ruleset (Safari MV3).
- **Active Static Rulesets**: Up to 10 active simultaneously (50 rulesets registered in manifest).
- **Dynamic Rules Limit**: ~5,000 dynamic rules (`browser.declarativeNetRequest.updateDynamicRules`).
- **Memory Ceiling**: Mobile Safari Web Extensions run in a constrained background page with ~15MB RAM budget. Parsing large 20MB filter lists directly inside the Extension worker is discouraged; rule compilation should occur ahead of time or in chunked batches.
