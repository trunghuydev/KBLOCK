# Filter Sources

This document lists all filter sources used by KBlock, including their licenses, URLs, and distribution rights.

> **Last updated:** 2026-10-22  
> **Status:** Phase 0 — Research. No filter lists are bundled yet. This document will be updated as each source is integrated (Phase 3).

---

## ⚠️ Important Disclaimer

KBlock does NOT:
- Redistribute filter list source files in the app bundle (V1)
- Claim ownership or authorship of any community filter list
- Relicense community filter lists under MPL-2.0
- Modify the meaning or intent of filter rules during conversion

KBlock DOES:
- Download filter lists from their official sources at runtime
- Convert compatible rules to DNR format for Safari
- Skip/log incompatible rules with a conversion report
- Attribute each filter source clearly to its authors

---

## Phase 3 Evaluation Candidates

The following filter lists are under evaluation. They have NOT been integrated yet.

### 1. EasyList

| Field | Value |
|-------|-------|
| Name | EasyList |
| URL | `https://easylist.to/easylist/easylist.txt` |
| Authors | EasyList authors |
| License | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Format | Adblock Plus syntax |
| Size (approx) | ~80,000 rules |
| Focus | English-language ad blocking (global) |
| Integration status | 🔲 NOT YET INTEGRATED |
| Distribution rights | ⚠️ CC BY-SA 3.0: Attribution required; derivatives must use same license |
| Bundling verdict | ⚠️ PENDING LEGAL REVIEW — CC BY-SA may be incompatible with MPL-2.0 app bundle |
| DNR download only | ✅ Downloading at runtime avoids bundling incompatibility |

### 2. EasyPrivacy

| Field | Value |
|-------|-------|
| Name | EasyPrivacy |
| URL | `https://easylist.to/easylist/easyprivacy.txt` |
| Authors | EasyList authors |
| License | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Format | Adblock Plus syntax |
| Size (approx) | ~30,000 rules |
| Focus | Tracker blocking (global) |
| Integration status | 🔲 NOT YET INTEGRATED |
| Distribution rights | ⚠️ Same as EasyList |
| Bundling verdict | ⚠️ PENDING LEGAL REVIEW |
| DNR download only | ✅ Downloading at runtime avoids bundling incompatibility |

### 3. ABPVN (Adblock Plus Vietnam)

| Field | Value |
|-------|-------|
| Name | ABPVN |
| URL | `https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt` |
| Authors | ABPVN contributors |
| License | [GNU GPL v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) |
| GitHub | https://github.com/abpvn/abpvn |
| Format | Adblock Plus / EasyList syntax |
| Size (approx) | ~10,000–20,000 rules |
| Focus | Vietnamese websites — ads, trackers, popups |
| Integration status | 🔲 NOT YET INTEGRATED |
| Distribution rights | ⚠️ GPL-3.0 is copyleft; bundling in MPL-2.0 app requires legal review |
| Bundling verdict | ⚠️ PENDING LEGAL REVIEW — GPL-3.0 and MPL-2.0 are compatible for source distribution but bundling rules differ |
| DNR download only | ✅ Downloading at runtime (not bundling) is the safer path |
| Priority | HIGH — most relevant for Vietnamese users |

---

## License Compatibility Notes

| Scenario | Status |
|----------|--------|
| Download filter at runtime (not bundled) | ✅ Generally safe — the filter list license governs the list itself, not the downloader |
| Bundle filter list text in app binary | ⚠️ Depends on the filter list license; CC BY-SA and GPL require careful consideration |
| Convert to DNR and bundle converted JSON | ⚠️ Same caution applies; conversion is a derivative work |
| Display attribution in-app | ✅ Required by all above licenses |
| Remove/change filter list license header | ❌ Not permitted |

---

## Custom Filters

Users may add their own filter rules. These are:
- Stored locally on device
- Never sent to KBlock servers
- Governed by the user's own authorship (not KBlock's)

Custom filter location: App Group shared container, `custom-rules.json`

---

## Sources Integration Checklist (Phase 3)

Before integrating any source:
- [ ] Verify URL is reachable and returns valid filter syntax
- [ ] Confirm license name and version from the filter file header
- [ ] Confirm right to download and convert (not bundle) at runtime
- [ ] Document attribution string for in-app display
- [ ] Check file size (< 5MB preferred for V1)
- [ ] Test with parser — report conversion rate
- [ ] Add regression tests
- [ ] Add rollback mechanism
