// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Background Service Worker
 *
 * Responsibilities:
 * - Manage extension state & filter categories (fine-tuning)
 * - Dynamically enable/disable DNR rulesets (ABPVN, Gambling, Base)
 * - Track live blocking statistics (ads, trackers, popups, data saved)
 * - Maintain dynamic DNR whitelist rules
 */

import {
  DEFAULT_STATE,
  STORAGE_KEYS,
  type ExtensionState,
  type Message,
  type MessageResponse,
  type AntiPopupMode,
  type FilterSourceState,
  type FilterCategories,
  type BlockStats,
} from '../shared/types';

// ─── State Helpers ───────────────────────────────────────────────────────────

async function getState(): Promise<ExtensionState> {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEYS.ENABLED,
      STORAGE_KEYS.FILTER_SOURCES,
      STORAGE_KEYS.FILTER_CATEGORIES,
      STORAGE_KEYS.WHITELIST,
      STORAGE_KEYS.ANTI_POPUP_MODE,
      STORAGE_KEYS.STATS,
      STORAGE_KEYS.LAST_UPDATED,
    ]);

    return {
      enabled: (result[STORAGE_KEYS.ENABLED] as boolean | undefined) ?? DEFAULT_STATE.enabled,
      filterSources:
        (result[STORAGE_KEYS.FILTER_SOURCES] as FilterSourceState[] | undefined) ??
        DEFAULT_STATE.filterSources,
      filterCategories:
        (result[STORAGE_KEYS.FILTER_CATEGORIES] as FilterCategories | undefined) ??
        DEFAULT_STATE.filterCategories,
      whitelist:
        (result[STORAGE_KEYS.WHITELIST] as string[] | undefined) ?? DEFAULT_STATE.whitelist,
      antiPopupMode:
        (result[STORAGE_KEYS.ANTI_POPUP_MODE] as AntiPopupMode | undefined) ??
        DEFAULT_STATE.antiPopupMode,
      stats:
        (result[STORAGE_KEYS.STATS] as BlockStats | undefined) ?? DEFAULT_STATE.stats,
      lastUpdated: (result[STORAGE_KEYS.LAST_UPDATED] as string | null | undefined) ?? DEFAULT_STATE.lastUpdated,
    };
  } catch (err) {
    console.error('[KBlock] Failed to load state:', err);
    return { ...DEFAULT_STATE };
  }
}

async function savePartialState(updates: Partial<Record<string, unknown>>): Promise<void> {
  await browser.storage.local.set(updates);
}

// ─── DNR Whitelist Management ─────────────────────────────────────────────────

const WHITELIST_RULE_ID_START = 10000;

async function rebuildWhitelistRules(domains: string[]): Promise<void> {
  try {
    const existingRules = await browser.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map((r) => r.id);

    const newRules: browser.declarativeNetRequest.Rule[] = domains.map((domain, index) => ({
      id: WHITELIST_RULE_ID_START + index,
      priority: 1000,
      action: { type: 'allow' as const },
      condition: {
        requestDomains: [domain],
      },
    }));

    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
      addRules: newRules,
    });
  } catch (err) {
    console.warn('[KBlock] Dynamic rules error:', err);
  }
}

// ─── DNR Ruleset Toggling ─────────────────────────────────────────────────────

async function syncRulesets(enabled: boolean, categories: FilterCategories): Promise<void> {
  try {
    if (!browser.declarativeNetRequest.updateEnabledRulesets) return;

    if (!enabled) {
      await browser.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['base_rules', 'abpvn_rules', 'gambling_rules'],
      });
      return;
    }

    const enableIds: string[] = [];
    const disableIds: string[] = [];

    if (categories.easylist) enableIds.push('base_rules');
    else disableIds.push('base_rules');

    if (categories.abpvn) enableIds.push('abpvn_rules');
    else disableIds.push('abpvn_rules');

    if (categories.gambling) enableIds.push('gambling_rules');
    else disableIds.push('gambling_rules');

    await browser.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enableIds,
      disableRulesetIds: disableIds,
    });
  } catch (err) {
    console.warn('[KBlock] updateEnabledRulesets error:', err);
  }
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

async function handleGetState(): Promise<MessageResponse> {
  const state = await getState();
  return { success: true, data: state };
}

async function handleSetEnabled(enabled: boolean): Promise<MessageResponse> {
  const state = await getState();
  await savePartialState({ [STORAGE_KEYS.ENABLED]: enabled });
  await syncRulesets(enabled, state.filterCategories);

  if (!enabled) {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: [],
    });
  } else {
    await rebuildWhitelistRules(state.whitelist);
  }

  return { success: true };
}

async function handleSetFilterCategory(payload: { category: keyof FilterCategories; enabled: boolean }): Promise<MessageResponse> {
  const state = await getState();
  const updatedCategories = {
    ...state.filterCategories,
    [payload.category]: payload.enabled,
  };

  await savePartialState({ [STORAGE_KEYS.FILTER_CATEGORIES]: updatedCategories });
  await syncRulesets(state.enabled, updatedCategories);

  return { success: true, data: updatedCategories };
}

async function handleAddWhitelistDomain(domain: string): Promise<MessageResponse> {
  const state = await getState();
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*/, '');

  if (!cleanDomain) {
    return { success: false, error: 'Tên miền không hợp lệ' };
  }

  if (state.whitelist.includes(cleanDomain)) {
    return { success: false, error: 'Tên miền đã có trong Whitelist' };
  }

  const updatedWhitelist = [...state.whitelist, cleanDomain];
  await savePartialState({ [STORAGE_KEYS.WHITELIST]: updatedWhitelist });
  await rebuildWhitelistRules(updatedWhitelist);

  return { success: true, data: updatedWhitelist };
}

async function handleRemoveWhitelistDomain(domain: string): Promise<MessageResponse> {
  const state = await getState();
  const updatedWhitelist = state.whitelist.filter((d) => d !== domain);
  await savePartialState({ [STORAGE_KEYS.WHITELIST]: updatedWhitelist });
  await rebuildWhitelistRules(updatedWhitelist);

  return { success: true, data: updatedWhitelist };
}

async function handleSetAntiPopupMode(mode: AntiPopupMode): Promise<MessageResponse> {
  await savePartialState({ [STORAGE_KEYS.ANTI_POPUP_MODE]: mode });
  return { success: true };
}

async function handleIncrementStats(payload: { count: number; category: 'ads' | 'popups' | 'trackers' }): Promise<MessageResponse> {
  const state = await getState();
  const count = payload.count || 1;

  const currentStats = state.stats;
  const newStats: BlockStats = {
    totalBlocked: currentStats.totalBlocked + count,
    sessionBlocked: currentStats.sessionBlocked + count,
    adsBlocked: currentStats.adsBlocked + (payload.category === 'ads' ? count : 0),
    trackersBlocked: currentStats.trackersBlocked + (payload.category === 'trackers' ? count : 0),
    popupsBlocked: currentStats.popupsBlocked + (payload.category === 'popups' ? count : 0),
    bandwidthSavedMB: Number((currentStats.bandwidthSavedMB + count * 0.15).toFixed(1)),
    lastResetDate: currentStats.lastResetDate,
  };

  await savePartialState({ [STORAGE_KEYS.STATS]: newStats });
  return { success: true, data: newStats };
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
  return { success: true, data: emptyStats };
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  const state = await getState();
  if (state.enabled) {
    if (state.whitelist.length > 0) {
      await rebuildWhitelistRules(state.whitelist);
    }
    await syncRulesets(true, state.filterCategories);
  }
}

// ─── Message Listener ─────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (response: MessageResponse) => void) => {
    const handle = async (): Promise<void> => {
      let response: MessageResponse;

      try {
        switch (message.type) {
          case 'GET_STATE':
            response = await handleGetState();
            break;
          case 'SET_ENABLED':
            response = await handleSetEnabled(message.payload as boolean);
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
          case 'INCREMENT_STATS':
            response = await handleIncrementStats(
              message.payload as { count: number; category: 'ads' | 'popups' | 'trackers' },
            );
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

browser.runtime.onInstalled.addListener(() => {
  void initialize();
});

void initialize();
