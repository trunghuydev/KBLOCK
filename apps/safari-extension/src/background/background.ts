// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Background Service Worker
 *
 * Responsibilities:
 * - Manage extension enabled/disabled state
 * - Maintain dynamic DNR rules (whitelist)
 * - Handle messages from popup and content scripts
 * - Track basic block statistics (local only, never sent externally)
 *
 * NOTE: Safari suspends service workers when idle.
 * Do NOT rely on in-memory state surviving across sessions.
 * All state is persisted via browser.storage.local.
 */

import {
  DEFAULT_STATE,
  STORAGE_KEYS,
  type ExtensionState,
  type Message,
  type MessageResponse,
  type AntiPopupMode,
  type FilterSourceState,
  type BlockStats,
} from '../shared/types';

// ─── State Helpers ───────────────────────────────────────────────────────────

async function getState(): Promise<ExtensionState> {
  try {
    const result = await browser.storage.local.get([
      STORAGE_KEYS.ENABLED,
      STORAGE_KEYS.FILTER_SOURCES,
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
      whitelist:
        (result[STORAGE_KEYS.WHITELIST] as string[] | undefined) ?? DEFAULT_STATE.whitelist,
      antiPopupMode:
        (result[STORAGE_KEYS.ANTI_POPUP_MODE] as AntiPopupMode | undefined) ??
        DEFAULT_STATE.antiPopupMode,
      stats:
        (result[STORAGE_KEYS.STATS] as BlockStats | undefined) ?? DEFAULT_STATE.stats,
      lastUpdated: (result[STORAGE_KEYS.LAST_UPDATED] as string | null | undefined) ?? null,
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

/**
 * Whitelist rule IDs start at 10000 to avoid collision with static ruleset IDs.
 */
const WHITELIST_RULE_ID_START = 10000;

async function rebuildWhitelistRules(domains: string[]): Promise<void> {
  // Remove all existing dynamic rules (whitelist)
  const existingRules = await browser.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map((r) => r.id);

  const newRules: browser.declarativeNetRequest.Rule[] = domains.map((domain, index) => ({
    id: WHITELIST_RULE_ID_START + index,
    priority: 1000, // High priority to override block rules
    action: { type: 'allow' as const },
    condition: {
      requestDomains: [domain],
    },
  }));

  await browser.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: newRules,
  });
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

async function handleGetState(): Promise<MessageResponse> {
  const state = await getState();
  return { success: true, data: state };
}

async function handleSetEnabled(enabled: boolean): Promise<MessageResponse> {
  await savePartialState({ [STORAGE_KEYS.ENABLED]: enabled });

  // When disabled, remove all dynamic rules
  if (!enabled) {
    const existing = await browser.declarativeNetRequest.getDynamicRules();
    await browser.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: [],
    });
  } else {
    // Re-apply whitelist when re-enabled
    const state = await getState();
    await rebuildWhitelistRules(state.whitelist);
  }

  return { success: true };
}

async function handleAddWhitelistDomain(domain: string): Promise<MessageResponse> {
  const state = await getState();
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*/, '');

  if (!cleanDomain) {
    return { success: false, error: 'Invalid domain' };
  }

  if (state.whitelist.includes(cleanDomain)) {
    return { success: false, error: 'Domain already whitelisted' };
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

// ─── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * On service worker start (after suspension or install):
 * - Restore whitelist DNR rules from storage
 */
async function initialize(): Promise<void> {
  const state = await getState();
  if (state.enabled && state.whitelist.length > 0) {
    await rebuildWhitelistRules(state.whitelist);
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
          case 'ADD_WHITELIST_DOMAIN':
            response = await handleAddWhitelistDomain(message.payload as string);
            break;
          case 'REMOVE_WHITELIST_DOMAIN':
            response = await handleRemoveWhitelistDomain(message.payload as string);
            break;
          case 'SET_ANTIPOPUP_MODE':
            response = await handleSetAntiPopupMode(message.payload as AntiPopupMode);
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
    return true; // Keep message channel open for async response
  },
);

// ─── Install / Update Handler ─────────────────────────────────────────────────

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First install: write default state
    void browser.storage.local.set({
      [STORAGE_KEYS.ENABLED]: DEFAULT_STATE.enabled,
      [STORAGE_KEYS.FILTER_SOURCES]: DEFAULT_STATE.filterSources,
      [STORAGE_KEYS.WHITELIST]: DEFAULT_STATE.whitelist,
      [STORAGE_KEYS.ANTI_POPUP_MODE]: DEFAULT_STATE.antiPopupMode,
      [STORAGE_KEYS.STATS]: DEFAULT_STATE.stats,
      [STORAGE_KEYS.LAST_UPDATED]: null,
    });
  }

  void initialize();
});

// Run on every service worker start
void initialize();
