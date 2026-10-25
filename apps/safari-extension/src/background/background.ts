// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Background Service Worker / Event Page
 *
 * Responsibilities:
 * - Mirror the config owned by the native iOS app (App Group UserDefaults)
 *   via SafariWebExtensionHandler native messaging, keyed by configVersion.
 * - Manage DNR: static ruleset toggles, whitelist (allowAllRequests per site),
 *   and user custom rules (dynamic rules).
 * - Track blocking statistics + activity log (honest, event-based only),
 *   throttled-pushed to the native side so the app can display them.
 */

import {
  DEFAULT_STATE,
  DYNAMIC_RULE_ID_START,
  NATIVE_APP_ID,
  STORAGE_KEYS,
  FALLBACK_BUNDLED_RULE_COUNT,
  type ExtensionState,
  type Message,
  type MessageResponse,
  type AntiPopupMode,
  type FilterCategories,
  type BlockStats,
  type CustomRule,
  type BlockedEvent,
  type ElementRule,
} from '../shared/types';

// ─── Minimal local DNR typing (cast before calling the browser API) ──────────

interface DnrCondition {
  urlFilter?: string;
  regexFilter?: string;
  initiatorDomains?: string[];
  requestDomains?: string[];
}

interface DnrRule {
  id: number;
  priority: number;
  action: { type: 'block' | 'allow' | 'allowAllRequests' };
  condition: DnrCondition;
}

const STATIC_RULESET_IDS = ['base_rules', 'abpvn_rules', 'gambling_rules'];

/** Rulesets produced by scripts/build-filters.mjs (stubbed if pipeline hasn't run). */
const GENERATED_RULESETS: Array<{ id: string; file: string; category: 'abpvn' | 'easylist' }> = [
  { id: 'abpvn_full_rules', file: 'rules/generated/abpvn_full.json', category: 'abpvn' },
  { id: 'easylist_full_rules', file: 'rules/generated/easylist_full.json', category: 'easylist' },
  { id: 'easyprivacy_full_rules', file: 'rules/generated/easyprivacy_full.json', category: 'easylist' },
];

const WHITELIST_RULE_ID_BASE = 10000;
const CUSTOM_RULE_ID_BASE = 20000;
const MAX_ACTIVITY_ENTRIES = 50;
const MAX_CUSTOM_RULES = 500;
const MAX_ELEMENT_RULES = 200;

// ─── Storage-backed state ────────────────────────────────────────────────────

function deepCopyDefault(): ExtensionState {
  return JSON.parse(JSON.stringify(DEFAULT_STATE)) as ExtensionState;
}

async function getState(): Promise<ExtensionState> {
  try {
    const result = await browser.storage.local.get(null);
    const state = deepCopyDefault();
    if (typeof result[STORAGE_KEYS.ENABLED] === 'boolean') state.enabled = result[STORAGE_KEYS.ENABLED];
    if (result[STORAGE_KEYS.FILTER_CATEGORIES]) state.filterCategories = result[STORAGE_KEYS.FILTER_CATEGORIES];
    if (Array.isArray(result[STORAGE_KEYS.WHITELIST])) state.whitelist = result[STORAGE_KEYS.WHITELIST];
    if (typeof result[STORAGE_KEYS.ANTI_POPUP_MODE] === 'string') state.antiPopupMode = result[STORAGE_KEYS.ANTI_POPUP_MODE];
    if (typeof result[STORAGE_KEYS.ANTI_TRACKING] === 'boolean') state.antiTracking = result[STORAGE_KEYS.ANTI_TRACKING];
    if (typeof result[STORAGE_KEYS.COOKIE_BANNERS] === 'boolean') state.cookieBanners = result[STORAGE_KEYS.COOKIE_BANNERS];
    if (Array.isArray(result[STORAGE_KEYS.CUSTOM_RULES])) state.customRules = result[STORAGE_KEYS.CUSTOM_RULES];
    if (Array.isArray(result[STORAGE_KEYS.ELEMENT_RULES])) state.elementRules = result[STORAGE_KEYS.ELEMENT_RULES];
    if (Array.isArray(result[STORAGE_KEYS.ACTIVITY])) state.activity = result[STORAGE_KEYS.ACTIVITY];
    if (result[STORAGE_KEYS.STATS]) state.stats = result[STORAGE_KEYS.STATS];
    if (typeof result[STORAGE_KEYS.CONFIG_VERSION] === 'number') state.configVersion = result[STORAGE_KEYS.CONFIG_VERSION];
    return state;
  } catch (err) {
    console.error('[KBlock] Failed to load state:', err);
    return deepCopyDefault();
  }
}

async function savePartialState(updates: Record<string, unknown>): Promise<void> {
  await browser.storage.local.set(updates);
}

// ─── Native messaging bridge ─────────────────────────────────────────────────

interface NativeResponse extends Record<string, unknown> {
  status?: string;
  message?: string;
  version?: number;
}

interface NativeConfigPatch {
  enabled?: boolean;
  whitelist?: string[];
  categories?: FilterCategories;
  antiPopupMode?: AntiPopupMode;
  antiTracking?: boolean;
  cookieBanners?: boolean;
  customRules?: CustomRule[];
  elementRules?: ElementRule[];
}

interface NativeConfig {
  version: number;
  enabled: boolean;
  whitelist: string[];
  categories: FilterCategories;
  antiPopupMode: AntiPopupMode;
  antiTracking: boolean;
  cookieBanners: boolean;
  customRules: CustomRule[];
  elementRules: ElementRule[];
}

function parseJsonOr<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') return (raw as T) ?? fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function nativeRequest(action: string, payload?: unknown): Promise<NativeResponse | null> {
  try {
    const runtimeBridge = browser.runtime as unknown as {
      sendNativeMessage?: (app: string, msg: unknown) => Promise<unknown>;
    };
    if (typeof runtimeBridge.sendNativeMessage !== 'function') return null;
    const res = (await runtimeBridge.sendNativeMessage(NATIVE_APP_ID, {
      action,
      payload,
    })) as NativeResponse | undefined;
    if (!res || res.status !== 'ok') return null;
    return res;
  } catch {
    // Native side unavailable (e.g. missing App Group entitlement) — the
    // extension keeps working with its own storage as source of truth.
    return null;
  }
}

async function readNativeConfig(): Promise<NativeConfig | null> {
  const res = await nativeRequest('getSharedState');
  if (!res) return null;
  const categories = parseJsonOr<FilterCategories>(res.categories, deepCopyDefault().filterCategories);
  return {
    version: Number(res.version ?? 0),
    enabled: Boolean(res.enabled),
    whitelist: Array.isArray(res.whitelist) ? (res.whitelist as string[]) : [],
    categories,
    antiPopupMode: (typeof res.antiPopupMode === 'string' ? res.antiPopupMode : 'balanced') as AntiPopupMode,
    antiTracking: res.antiTracking === undefined ? true : Boolean(res.antiTracking),
    cookieBanners: res.cookieBanners === undefined ? true : Boolean(res.cookieBanners),
    customRules: parseJsonOr<CustomRule[]>(res.customRules, []),
    elementRules: parseJsonOr<ElementRule[]>(res.elementRules, []),
  };
}

/**
 * Pull config from the native app; if the version moved, mirror it into
 * storage.local and re-apply DNR. Safe to call on every wake-up.
 */
async function syncFromNative(): Promise<void> {
  const native = await readNativeConfig();
  if (!native) return;

  const local = await getState();
  if (native.version === local.configVersion) return;

  const updates: Record<string, unknown> = {
    [STORAGE_KEYS.CONFIG_VERSION]: native.version,
    [STORAGE_KEYS.ENABLED]: native.enabled,
    [STORAGE_KEYS.WHITELIST]: native.whitelist,
    [STORAGE_KEYS.FILTER_CATEGORIES]: native.categories,
    [STORAGE_KEYS.ANTI_POPUP_MODE]: native.antiPopupMode,
    [STORAGE_KEYS.ANTI_TRACKING]: native.antiTracking,
    [STORAGE_KEYS.COOKIE_BANNERS]: native.cookieBanners,
    [STORAGE_KEYS.CUSTOM_RULES]: native.customRules,
    [STORAGE_KEYS.ELEMENT_RULES]: native.elementRules,
  };
  await savePartialState(updates);
  await applyNetworkRules({
    enabled: native.enabled,
    whitelist: native.whitelist,
    filterCategories: native.categories,
    customRules: native.customRules,
  });
  await broadcastConfig();
}

/** Push a config change (made from the popup) back to the native app. */
async function pushConfigToNative(patch: NativeConfigPatch): Promise<void> {
  const res = await nativeRequest('setSharedState', patch);
  if (res && typeof res.version === 'number') {
    await savePartialState({ [STORAGE_KEYS.CONFIG_VERSION]: res.version });
  }
}

// ─── Generated ruleset probe (pipeline output) ───────────────────────────────

let generatedProbe: { available: boolean; ruleCount: number } | null = null;

async function getGeneratedInfo(): Promise<{ available: boolean; ruleCount: number }> {
  if (generatedProbe) return generatedProbe;
  let available = false;
  let ruleCount = 0;
  try {
    for (const set of GENERATED_RULESETS) {
      const res = await fetch(browser.runtime.getURL(set.file));
      if (!res.ok) continue;
      const rules = (await res.json()) as unknown;
      if (Array.isArray(rules)) {
        available = true;
        ruleCount += rules.length;
      }
    }
  } catch {
    // Pipeline output missing entirely.
  }
  generatedProbe = { available, ruleCount };
  return generatedProbe;
}

// ─── DNR: static rulesets ────────────────────────────────────────────────────

async function syncRulesets(enabled: boolean, categories: FilterCategories): Promise<void> {
  try {
    const dnr = browser.declarativeNetRequest as unknown as {
      updateEnabledRulesets?: (opts: {
        enableRulesetIds?: string[];
        disableRulesetIds?: string[];
      }) => Promise<void>;
    };
    if (!dnr.updateEnabledRulesets) return;

    if (!enabled) {
      await dnr.updateEnabledRulesets({
        disableRulesetIds: [...STATIC_RULESET_IDS, ...GENERATED_RULESETS.map((g) => g.id)],
      });
      return;
    }

    const enableIds: string[] = [];
    const disableIds: string[] = [];
    const toggle = (ids: string[], on: boolean) => {
      for (const id of ids) (on ? enableIds : disableIds).push(id);
    };

    toggle(['base_rules'], categories.easylist);
    if (generatedProbe?.available) {
      toggle(
        GENERATED_RULESETS.filter((g) => g.category === 'easylist').map((g) => g.id),
        categories.easylist,
      );
    }
    toggle(['abpvn_rules'], categories.abpvn);
    if (generatedProbe?.available) {
      toggle(
        GENERATED_RULESETS.filter((g) => g.category === 'abpvn').map((g) => g.id),
        categories.abpvn,
      );
    }
    toggle(['gambling_rules'], categories.gambling);

    const opts: { enableRulesetIds?: string[]; disableRulesetIds?: string[] } = {};
    if (enableIds.length > 0) opts.enableRulesetIds = enableIds;
    if (disableIds.length > 0) opts.disableRulesetIds = disableIds;
    if (Object.keys(opts).length > 0) await dnr.updateEnabledRulesets(opts);
  } catch (err) {
    console.warn('[KBlock] updateEnabledRulesets error:', err);
  }
}

// ─── DNR: dynamic rules (whitelist + custom) ─────────────────────────────────

async function removeAllDynamicRules(): Promise<void> {
  try {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    const ids = existing.map((r) => r.id).filter((id) => id >= DYNAMIC_RULE_ID_START);
    if (ids.length === 0) return;
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ids,
      addRules: [],
    } as Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]);
  } catch (err) {
    console.warn('[KBlock] removeAllDynamicRules error:', err);
  }
}

/**
 * Whitelist semantics: "turn blocking OFF on this site".
 * allowAllRequests scoped to initiatorDomains beats every static block rule.
 */
function whitelistToRules(domains: string[]): DnrRule[] {
  return domains.slice(0, 1000).map((domain, index) => ({
    id: WHITELIST_RULE_ID_BASE + index,
    priority: 3000,
    action: { type: 'allowAllRequests' as const },
    condition: { initiatorDomains: [domain] },
  }));
}

/** Convert a user custom pattern into a DNR rule. */
export function customRuleToDnr(rule: CustomRule, id: number): DnrRule | null {
  const pattern = rule.pattern.trim();
  if (!pattern || pattern.length > 500 || /\s/.test(pattern)) return null;

  const condition: DnrCondition = {};
  if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
    condition.regexFilter = pattern.slice(1, -1);
  } else if (pattern.startsWith('||')) {
    condition.urlFilter = pattern;
  } else if (/^[\p{L}\p{N}][\p{L}\p{N}\-.]*\.[\p{L}\p{N}]{2,}$/iu.test(pattern)) {
    condition.urlFilter = `||${pattern}^`;
  } else {
    condition.urlFilter = pattern;
  }

  return {
    id,
    priority: rule.isAllow ? 500 : 100,
    action: { type: rule.isAllow ? 'allow' : 'block' },
    condition,
  };
}

function customRulesToDnr(rules: CustomRule[]): DnrRule[] {
  const out: DnrRule[] = [];
  let nextId = CUSTOM_RULE_ID_BASE;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const converted = customRuleToDnr(rule, nextId);
    if (converted) {
      out.push(converted);
      nextId += 1;
      if (nextId >= CUSTOM_RULE_ID_BASE + 5000) break;
    }
  }
  return out;
}

interface NetworkRuleInputs {
  enabled: boolean;
  whitelist: string[];
  filterCategories: FilterCategories;
  customRules: CustomRule[];
}

async function applyNetworkRules(inputs: NetworkRuleInputs): Promise<void> {
  await syncRulesets(inputs.enabled, inputs.filterCategories);

  try {
    const dynamic: DnrRule[] = inputs.enabled
      ? [...whitelistToRules(inputs.whitelist), ...customRulesToDnr(inputs.customRules)]
      : [];
    await removeAllDynamicRules();
    if (dynamic.length > 0) {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [],
        addRules: dynamic,
      } as Parameters<typeof browser.declarativeNetRequest.updateDynamicRules>[0]);
    }
  } catch (err) {
    console.warn('[KBlock] dynamic rules error:', err);
  }
}

// ─── Bundled rule count (honest number for the UI) ───────────────────────────

let bundledRuleCount: number | null = null;

async function getBundledRuleCount(): Promise<number> {
  if (bundledRuleCount !== null) return bundledRuleCount;
  try {
    let total = 0;
    for (const id of ['base', 'abpvn', 'gambling']) {
      const res = await fetch(browser.runtime.getURL(`rules/${id}.json`));
      const rules = (await res.json()) as unknown;
      total += Array.isArray(rules) ? rules.length : 0;
    }
    total += (await getGeneratedInfo()).ruleCount;
    bundledRuleCount = total;
  } catch {
    bundledRuleCount = FALLBACK_BUNDLED_RULE_COUNT;
  }
  return bundledRuleCount;
}

// ─── Broadcast config to content scripts ─────────────────────────────────────

async function broadcastConfig(): Promise<void> {
  try {
    const tabsApi = browser.tabs as unknown as {
      query?: (opts: { url?: string[] }) => Promise<Array<{ id?: number }>>;
      sendMessage?: (tabId: number, msg: unknown) => Promise<unknown>;
    };
    if (!tabsApi.query || !tabsApi.sendMessage) return;
    const tabs = await tabsApi.query({ url: ['http://*/*', 'https://*/*'] });
    const state = await getState();
    const msg: Message = {
      type: 'CONFIG_UPDATED',
      payload: {
        enabled: state.enabled,
        whitelist: state.whitelist,
        antiPopupMode: state.antiPopupMode,
        antiTracking: state.antiTracking,
        cookieBanners: state.cookieBanners,
        annoyances: state.filterCategories.annoyances,
        elementRules: state.elementRules,
      },
    };
    const send = tabsApi.sendMessage;
    await Promise.allSettled(
      tabs.map((t) => (t.id !== undefined ? send.call(tabsApi, t.id, msg) : Promise.resolve())),
    );
  } catch {
    // Content-script notification is best-effort.
  }
}

// ─── Stats & activity (extension-owned; pushed to native, throttled) ─────────

let lastNativeStatsPush = 0;
const NATIVE_STATS_PUSH_INTERVAL_MS = 15000;

async function flushStatsToNative(state: ExtensionState): Promise<void> {
  const now = Date.now();
  if (now - lastNativeStatsPush < NATIVE_STATS_PUSH_INTERVAL_MS) return;
  lastNativeStatsPush = now;

  const bundled = await getBundledRuleCount();
  const ruleCount = state.enabled
    ? bundled + state.whitelist.length + state.customRules.filter((r) => r.enabled).length
    : 0;

  await nativeRequest('updateStats', {
    stats: JSON.stringify(state.stats),
    activity: JSON.stringify(state.activity.slice(-MAX_ACTIVITY_ENTRIES)),
    ruleCount,
  });
}

async function handleIncrementStats(payload: {
  count: number;
  category: 'ads' | 'popups' | 'trackers';
}): Promise<MessageResponse> {
  const state = await getState();
  const count = Math.min(Math.max(payload.count || 1, 1), 500);

  const s = state.stats;
  const newStats: BlockStats = {
    totalBlocked: s.totalBlocked + count,
    sessionBlocked: s.sessionBlocked + count,
    adsBlocked: s.adsBlocked + (payload.category === 'ads' ? count : 0),
    trackersBlocked: s.trackersBlocked + (payload.category === 'trackers' ? count : 0),
    popupsBlocked: s.popupsBlocked + (payload.category === 'popups' ? count : 0),
    bandwidthSavedMB: Math.round((s.bandwidthSavedMB + count * 0.15) * 10) / 10,
    lastResetDate: s.lastResetDate,
  };

  await savePartialState({ [STORAGE_KEYS.STATS]: newStats });
  await flushStatsToNative({ ...state, stats: newStats });
  return { success: true, data: newStats };
}

async function handleLogActivity(payload: { type: string; url: string }): Promise<MessageResponse> {
  const validTypes = ['popup', 'redirect', 'clickjack'];
  if (!payload || !validTypes.includes(payload.type)) {
    return { success: false, error: 'Invalid activity type' };
  }

  let host: string;
  try {
    host = new URL(payload.url).hostname;
  } catch {
    host = '';
  }

  const state = await getState();
  const event: BlockedEvent = {
    type: payload.type as BlockedEvent['type'],
    host,
    url: String(payload.url || '').slice(0, 500),
    at: new Date().toISOString(),
  };

  const activity = [...state.activity, event].slice(-MAX_ACTIVITY_ENTRIES);
  await savePartialState({ [STORAGE_KEYS.ACTIVITY]: activity });
  await flushStatsToNative({ ...state, activity });
  return { success: true, data: activity };
}

async function handleResetStats(): Promise<MessageResponse> {
  const emptyStats: BlockStats = {
    totalBlocked: 0,
    sessionBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    popupsBlocked: 0,
    bandwidthSavedMB: 0,
    lastResetDate: new Date().toISOString(),
  };
  await savePartialState({ [STORAGE_KEYS.STATS]: emptyStats });
  await flushStatsToNative({ ...(await getState()), stats: emptyStats });
  return { success: true, data: emptyStats };
}

// ─── Message handlers (config changes) ───────────────────────────────────────

async function handleSetEnabled(enabled: boolean): Promise<MessageResponse> {
  const state = await getState();
  const updated = { ...state, enabled };
  await savePartialState({ [STORAGE_KEYS.ENABLED]: enabled });
  await applyNetworkRules(updated);
  await pushConfigToNative({ enabled });
  await broadcastConfig();
  return { success: true };
}

async function handleSetFilterCategory(payload: {
  category: keyof FilterCategories;
  enabled: boolean;
}): Promise<MessageResponse> {
  const state = await getState();
  const updatedCategories: FilterCategories = {
    ...state.filterCategories,
    [payload.category]: payload.enabled,
  };
  const updated = { ...state, filterCategories: updatedCategories };

  await savePartialState({ [STORAGE_KEYS.FILTER_CATEGORIES]: updatedCategories });
  await applyNetworkRules(updated);
  await pushConfigToNative({ categories: updatedCategories });
  await broadcastConfig();
  return { success: true, data: updatedCategories };
}

async function handleSetAntiPopupMode(mode: AntiPopupMode): Promise<MessageResponse> {
  await savePartialState({ [STORAGE_KEYS.ANTI_POPUP_MODE]: mode });
  await pushConfigToNative({ antiPopupMode: mode });
  await broadcastConfig();
  return { success: true };
}

async function handleSetAntiTracking(enabled: boolean): Promise<MessageResponse> {
  await savePartialState({ [STORAGE_KEYS.ANTI_TRACKING]: enabled });
  await pushConfigToNative({ antiTracking: enabled });
  await broadcastConfig();
  return { success: true };
}

async function handleSetCookieBanners(enabled: boolean): Promise<MessageResponse> {
  await savePartialState({ [STORAGE_KEYS.COOKIE_BANNERS]: enabled });
  await pushConfigToNative({ cookieBanners: enabled });
  await broadcastConfig();
  return { success: true };
}

async function handleAddElementRule(payload: { host: string; selector: string }): Promise<MessageResponse> {
  const host = normalizeDomain(String(payload?.host || ''));
  const selector = String(payload?.selector || '').trim();

  if (!host || !host.includes('.')) {
    return { success: false, error: 'Host không hợp lệ' };
  }
  if (!selector || selector.length > 1000 || /[<>{}"']/.test(selector)) {
    return { success: false, error: 'Selector không hợp lệ' };
  }

  const state = await getState();
  if (state.elementRules.some((r) => r.host === host && r.selector === selector)) {
    return { success: true, data: state.elementRules };
  }

  const rule: ElementRule = {
    id: `el-${Date.now()}`,
    host,
    selector,
    createdAt: new Date().toISOString(),
    enabled: true,
  };
  const elementRules = [...state.elementRules, rule].slice(-MAX_ELEMENT_RULES);
  await savePartialState({ [STORAGE_KEYS.ELEMENT_RULES]: elementRules });
  await pushConfigToNative({ elementRules });
  return { success: true, data: elementRules };
}

async function handleRemoveElementRule(id: string): Promise<MessageResponse> {
  const state = await getState();
  const elementRules = state.elementRules.filter((r) => r.id !== id);
  await savePartialState({ [STORAGE_KEYS.ELEMENT_RULES]: elementRules });
  await pushConfigToNative({ elementRules });
  return { success: true, data: elementRules };
}

function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

async function handleAddWhitelistDomain(domain: string): Promise<MessageResponse> {
  const cleanDomain = normalizeDomain(String(domain || ''));
  if (!cleanDomain || !cleanDomain.includes('.')) {
    return { success: false, error: 'Tên miền không hợp lệ' };
  }

  const state = await getState();
  const exactMatch = state.whitelist.some((d) => d === cleanDomain);
  const parentMatch = state.whitelist.some((d) => cleanDomain.endsWith(`.${d}`));
  if (exactMatch || parentMatch) {
    return { success: false, error: 'Tên miền đã có trong Whitelist' };
  }

  const updatedWhitelist = [...state.whitelist, cleanDomain];
  await savePartialState({ [STORAGE_KEYS.WHITELIST]: updatedWhitelist });
  await applyNetworkRules({ ...state, whitelist: updatedWhitelist });
  await pushConfigToNative({ whitelist: updatedWhitelist });
  await broadcastConfig();
  return { success: true, data: updatedWhitelist };
}

async function handleRemoveWhitelistDomain(domain: string): Promise<MessageResponse> {
  const state = await getState();
  const updatedWhitelist = state.whitelist.filter((d) => d !== domain);
  await savePartialState({ [STORAGE_KEYS.WHITELIST]: updatedWhitelist });
  await applyNetworkRules({ ...state, whitelist: updatedWhitelist });
  await pushConfigToNative({ whitelist: updatedWhitelist });
  await broadcastConfig();
  return { success: true, data: updatedWhitelist };
}

async function handleSetCustomRules(rules: CustomRule[]): Promise<MessageResponse> {
  if (!Array.isArray(rules) || rules.length > MAX_CUSTOM_RULES) {
    return { success: false, error: 'Danh sách quy tắc không hợp lệ' };
  }

  const seen = new Set<string>();
  const cleaned: CustomRule[] = [];
  for (const rule of rules) {
    if (!rule || typeof rule.pattern !== 'string') continue;
    const pattern = rule.pattern.trim();
    if (!pattern || pattern.length > 500 || /\s/.test(pattern) || seen.has(pattern)) continue;
    seen.add(pattern);
    cleaned.push({
      id: typeof rule.id === 'string' && rule.id ? rule.id : `rule-${Date.now()}-${cleaned.length}`,
      pattern,
      isAllow: Boolean(rule.isAllow),
      enabled: rule.enabled !== false,
      createdAt: typeof rule.createdAt === 'string' ? rule.createdAt : new Date().toISOString(),
    });
  }

  const state = await getState();
  await savePartialState({ [STORAGE_KEYS.CUSTOM_RULES]: cleaned });
  await applyNetworkRules({ ...state, customRules: cleaned });
  await pushConfigToNative({ customRules: cleaned });
  return { success: true, data: cleaned };
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  generatedProbe = await getGeneratedInfo();
  const state = await getState();
  await applyNetworkRules(state);
  await syncFromNative();

  try {
    const alarmsApi = browser.alarms as unknown as
      | { create?: (name: string, info: { periodInMinutes: number }) => void }
      | undefined;
    alarmsApi?.create?.('kblock-native-sync', { periodInMinutes: 1 });
  } catch {
    // Alarms unavailable — content-script wake-ups still trigger syncs.
  }
}

// ─── Message Listener ─────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    const handle = async (): Promise<void> => {
      let response: MessageResponse;

      try {
        switch (message.type) {
          case 'GET_STATE': {
            await syncFromNative();
            const state = await getState();
            response = {
              success: true,
              data: {
                ...state,
                bundledRuleCount: await getBundledRuleCount(),
              },
            };
            break;
          }
          case 'SET_ENABLED':
            response = await handleSetEnabled(Boolean(message.payload));
            break;
          case 'SET_FILTER_CATEGORY':
            response = await handleSetFilterCategory(
              message.payload as { category: keyof FilterCategories; enabled: boolean },
            );
            break;
          case 'ADD_WHITELIST_DOMAIN':
            response = await handleAddWhitelistDomain(message.payload as string);
            break;
          case 'REMOVE_WHITELIST_DOMAIN':
            response = await handleRemoveWhitelistDomain(message.payload as string);
            break;
          case 'SET_ANTIPOPUP_MODE':
            response = await handleSetAntiPopupMode(message.payload as AntiPopupMode);
            break;
          case 'SET_ANTI_TRACKING':
            response = await handleSetAntiTracking(Boolean(message.payload));
            break;
          case 'SET_COOKIE_BANNERS':
            response = await handleSetCookieBanners(Boolean(message.payload));
            break;
          case 'ADD_ELEMENT_RULE':
            response = await handleAddElementRule(message.payload as { host: string; selector: string });
            break;
          case 'REMOVE_ELEMENT_RULE':
            response = await handleRemoveElementRule(String(message.payload ?? ''));
            break;
          case 'SET_CUSTOM_RULES':
            response = await handleSetCustomRules(message.payload as CustomRule[]);
            break;
          case 'INCREMENT_STATS':
            response = await handleIncrementStats(
              message.payload as { count: number; category: 'ads' | 'popups' | 'trackers' },
            );
            break;
          case 'LOG_ACTIVITY':
            response = await handleLogActivity(message.payload as { type: string; url: string });
            break;
          case 'RESET_STATS':
            response = await handleResetStats();
            break;
          default:
            response = { success: false, error: `Unknown message type: ${message.type}` };
        }
      } catch (err) {
        console.error('[KBlock] Message handler error:', err);
        response = {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }

      sendResponse(response);
    };

    void handle();
    return true;
  },
);

try {
  browser.runtime.onInstalled.addListener(() => {
    void initialize();
  });
} catch {
  // Some Safari versions only fire onInstalled once — top-level init covers it.
}

try {
  browser.runtime.onStartup?.addListener?.(() => {
    void syncFromNative();
  });
} catch {
  // Optional API.
}

try {
  browser.alarms?.onAlarm?.addListener?.((alarm) => {
    if (alarm.name === 'kblock-native-sync') void syncFromNative();
  });
} catch {
  // Alarms optional.
}

void initialize();
