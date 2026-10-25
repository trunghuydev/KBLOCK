// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Runtime filter updater
 *
 * Fetches the community lists directly from the extension, re-converts them
 * through @kblock/filter-engine and applies the freshest rules as DYNAMIC
 * DNR rules (ids 30000-39999). Static rulesets from the build-time pipeline
 * stay untouched; this layer adds freshness between app rebuilds.
 *
 * Failure-safe by design: any error keeps the previously applied set.
 */

import { parse, convert, stripDebugComments } from '@kblock/filter-engine';
import { STORAGE_KEYS } from '../shared/types';

const DYNAMIC_UPDATER_ID_BASE = 30000;
const DYNAMIC_UPDATER_ID_MAX = 39999;

/** Per-source tail budgets — new rules are appended at the end of list
 * files, so the tail is where freshness lives. Sum ≤ 3999 (+1 sentinel). */
const UPDATE_SOURCES: Array<{ id: string; url: string; take: number }> = [
  { id: 'adguard_urltracking', url: 'https://filters.adtidy.org/extension/chromium/filters/17.txt', take: 2500 },
  { id: 'abpvn', url: 'https://raw.githubusercontent.com/abpvn/abpvn/master/filter/abpvn.txt', take: 400 },
  { id: 'fanboy_annoyance', url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt', take: 300 },
  { id: 'adguard_spyware', url: 'https://filters.adtidy.org/extension/chromium/filters/4.txt', take: 300 },
  { id: 'adguard_mobile', url: 'https://filters.adtidy.org/extension/chromium/filters/11.txt', take: 300 },
  { id: 'easyprivacy', url: 'https://easylist.to/easylist/easyprivacy.txt', take: 250 },
  { id: 'easylist', url: 'https://easylist.to/easylist/easylist.txt', take: 250 },
];

interface UpdateState {
  lastCheck: string | null;
  versions: Record<string, string>;
  appliedCount: number;
  lastError?: string;
}

const EMPTY_STATE: UpdateState = { lastCheck: null, versions: {}, appliedCount: 0 };

async function readUpdateState(): Promise<UpdateState> {
  try {
    const res = await browser.storage.local.get(STORAGE_KEYS.FILTER_UPDATE_STATE);
    const stored = res[STORAGE_KEYS.FILTER_UPDATE_STATE] as UpdateState | undefined;
    return stored ?? { ...EMPTY_STATE };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function writeUpdateState(state: UpdateState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.FILTER_UPDATE_STATE]: state });
}

function checksum(text: string): string {
  // djb2 — cheap, only used to detect list changes between checks.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KBlock/0.3.0 (filter updater)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  if (text.length < 1000) throw new Error('Response suspiciously small');
  return text;
}

// ─── Minimal sanitization (mirrors scripts/build-filters.mjs) ────────────────

const ARTIFACT_OPTIONS = /\$[a-z][a-z-]*(,[a-z][a-z-]*)+$/i;

function isSafeRegex(re: string): boolean {
  return re.length <= 2000 && !/\(\?[,=!<]/.test(re);
}

function sanitize(rules: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const rule of rules) {
    const condition = (rule.condition ?? {}) as Record<string, unknown>;
    const urlFilter = condition.urlFilter as string | undefined;
    if (urlFilter && (ARTIFACT_OPTIONS.test(urlFilter) || urlFilter.startsWith('['))) continue;
    if ((condition.regexFilter as string | undefined) && !isSafeRegex(condition.regexFilter as string)) continue;
    if (urlFilter && urlFilter.length > 2000) continue;
    out.push(rule);
  }
  return out;
}

// ─── Dynamic rule plumbing ────────────────────────────────────────────────────

interface UpdaterDnrRule {
  id: number;
  priority: number;
  action: { type: string; redirect?: unknown };
  condition: Record<string, unknown>;
}

async function clearUpdaterRules(): Promise<void> {
  try {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    const ids = existing
      .map((r) => r.id)
      .filter((id) => id >= DYNAMIC_UPDATER_ID_BASE && id <= DYNAMIC_UPDATER_ID_MAX);
    if (ids.length === 0) return;
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ids,
      addRules: [],
    } as Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]);
  } catch (err) {
    console.warn('[KBlock Updater] clear error:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function clearFilterUpdates(): Promise<void> {
  await clearUpdaterRules();
  const state = await readUpdateState();
  await writeUpdateState({ ...state, appliedCount: 0 });
}

/**
 * Fetch + convert + apply the freshest rules. Returns a summary for the UI.
 * When nothing changed upstream, existing dynamic rules are kept as-is.
 */
export async function runFilterUpdate(force = false): Promise<{
  appliedCount: number;
  lastCheck: string;
  changed: boolean;
}> {
  const state = await readUpdateState();
  const now = new Date().toISOString();

  try {
    // 1. Fetch all lists, remembering checksums.
    const versions: Record<string, string> = {};
    const texts: Record<string, string> = {};
    let anyChanged = force;
    for (const source of UPDATE_SOURCES) {
      const text = await fetchText(source.url);
      texts[source.id] = text;
      const sum = checksum(text);
      versions[source.id] = sum;
      if (state.versions[source.id] !== sum) anyChanged = true;
    }

    if (!anyChanged) {
      await writeUpdateState({ ...state, lastCheck: now });
      return { appliedCount: state.appliedCount, lastCheck: now, changed: false };
    }

    // 2. Convert and take the freshest tail of each list.
    const collected: UpdaterDnrRule[] = [];
    const seen = new Set<string>();
    const TOTAL_CAP = DYNAMIC_UPDATER_ID_MAX - DYNAMIC_UPDATER_ID_BASE - 1; // sentinel slot

    for (const source of UPDATE_SOURCES) {
      const parsed = parse(texts[source.id] ?? '');
      const converted = convert(parsed);
      const rules = sanitize(
        stripDebugComments(converted.rules) as unknown as Array<Record<string, unknown>>,
      );
      let taken = 0;
      for (let i = rules.length - 1; i >= 0 && taken < source.take && collected.length < TOTAL_CAP; i--) {
        const rule = rules[i]!;
        const key = JSON.stringify([rule.action, rule.condition]);
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(rule as unknown as UpdaterDnrRule);
        taken++;
      }
    }

    // 3. Navigation guard sentinel — mirrors the static pipeline one.
    const sentinel: UpdaterDnrRule = {
      id: DYNAMIC_UPDATER_ID_BASE,
      priority: 2,
      action: { type: 'allow' },
      condition: { resourceTypes: ['main_frame'] },
    };
    const finalRules: Array<Record<string, unknown>> = [
      sentinel as unknown as Record<string, unknown>,
      ...collected.map((r, i) => ({ ...r, id: DYNAMIC_UPDATER_ID_BASE + 1 + i })),
    ];

    // 4. Apply in chunks.
    await clearUpdaterRules();
    const CHUNK = 1000;
    for (let i = 0; i < finalRules.length; i += CHUNK) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [],
        addRules: finalRules.slice(i, i + CHUNK),
      } as unknown as Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]);
    }

    await writeUpdateState({ lastCheck: now, versions, appliedCount: finalRules.length });
    return { appliedCount: finalRules.length, lastCheck: now, changed: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[KBlock Updater] update failed:', message);
    await writeUpdateState({ ...state, lastCheck: now, lastError: message });
    return { appliedCount: state.appliedCount, lastCheck: now, changed: false };
  }
}
