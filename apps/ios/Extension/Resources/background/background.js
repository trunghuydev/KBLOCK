// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DEFAULT_STATE, STORAGE_KEYS } from '../shared/types.js';

async function getState() {
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
            enabled: result[STORAGE_KEYS.ENABLED] ?? DEFAULT_STATE.enabled,
            filterSources: result[STORAGE_KEYS.FILTER_SOURCES] ?? DEFAULT_STATE.filterSources,
            filterCategories: result[STORAGE_KEYS.FILTER_CATEGORIES] ?? DEFAULT_STATE.filterCategories,
            whitelist: result[STORAGE_KEYS.WHITELIST] ?? DEFAULT_STATE.whitelist,
            antiPopupMode: result[STORAGE_KEYS.ANTI_POPUP_MODE] ?? DEFAULT_STATE.antiPopupMode,
            stats: result[STORAGE_KEYS.STATS] ?? DEFAULT_STATE.stats,
            lastUpdated: result[STORAGE_KEYS.LAST_UPDATED] ?? DEFAULT_STATE.lastUpdated,
        };
    }
    catch (err) {
        console.error('[KBlock] Failed to load state:', err);
        return { ...DEFAULT_STATE };
    }
}

async function savePartialState(updates) {
    await browser.storage.local.set(updates);
}

const WHITELIST_RULE_ID_START = 10000;

async function rebuildWhitelistRules(domains) {
    try {
        const existingRules = await browser.declarativeNetRequest.getDynamicRules();
        const existingIds = existingRules.map((r) => r.id);
        const newRules = domains.map((domain, index) => ({
            id: WHITELIST_RULE_ID_START + index,
            priority: 1000,
            action: { type: 'allow' },
            condition: {
                requestDomains: [domain],
            },
        }));
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingIds,
            addRules: newRules,
        });
    }
    catch (err) {
        console.warn('[KBlock] Dynamic rules error:', err);
    }
}

async function syncRulesets(enabled, categories) {
    try {
        if (!browser.declarativeNetRequest.updateEnabledRulesets)
            return;
        if (!enabled) {
            await browser.declarativeNetRequest.updateEnabledRulesets({
                disableRulesetIds: ['base_rules', 'abpvn_rules', 'gambling_rules'],
            });
            return;
        }
        const enableIds = [];
        const disableIds = [];
        if (categories.easylist)
            enableIds.push('base_rules');
        else
            disableIds.push('base_rules');
        if (categories.abpvn)
            enableIds.push('abpvn_rules');
        else
            disableIds.push('abpvn_rules');
        if (categories.gambling)
            enableIds.push('gambling_rules');
        else
            disableIds.push('gambling_rules');
        await browser.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds: enableIds,
            disableRulesetIds: disableIds,
        });
    }
    catch (err) {
        console.warn('[KBlock] updateEnabledRulesets error:', err);
    }
}

async function handleGetState() {
    const state = await getState();
    return { success: true, data: state };
}

async function handleSetEnabled(enabled) {
    const state = await getState();
    await savePartialState({ [STORAGE_KEYS.ENABLED]: enabled });
    await syncRulesets(enabled, state.filterCategories);
    if (!enabled) {
        const existing = await browser.declarativeNetRequest.getDynamicRules();
        await browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existing.map((r) => r.id),
            addRules: [],
        });
    }
    else {
        await rebuildWhitelistRules(state.whitelist);
    }
    return { success: true };
}

async function handleSetFilterCategory(payload) {
    const state = await getState();
    const updatedCategories = {
        ...state.filterCategories,
        [payload.category]: payload.enabled,
    };
    await savePartialState({ [STORAGE_KEYS.FILTER_CATEGORIES]: updatedCategories });
    await syncRulesets(state.enabled, updatedCategories);
    return { success: true, data: updatedCategories };
}

async function handleAddWhitelistDomain(domain) {
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

async function handleRemoveWhitelistDomain(domain) {
    const state = await getState();
    const updatedWhitelist = state.whitelist.filter((d) => d !== domain);
    await savePartialState({ [STORAGE_KEYS.WHITELIST]: updatedWhitelist });
    await rebuildWhitelistRules(updatedWhitelist);
    return { success: true, data: updatedWhitelist };
}

async function handleSetAntiPopupMode(mode) {
    await savePartialState({ [STORAGE_KEYS.ANTI_POPUP_MODE]: mode });
    return { success: true };
}

async function handleIncrementStats(payload) {
    const state = await getState();
    const count = payload.count || 1;
    const currentStats = state.stats;
    const newStats = {
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

async function handleResetStats() {
    const emptyStats = {
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

async function initialize() {
    const state = await getState();
    if (state.enabled) {
        if (state.whitelist.length > 0) {
            await rebuildWhitelistRules(state.whitelist);
        }
        await syncRulesets(true, state.filterCategories);
    }
}

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handle = async () => {
        let response;
        try {
            switch (message.type) {
                case 'GET_STATE':
                    response = await handleGetState();
                    break;
                case 'SET_ENABLED':
                    response = await handleSetEnabled(message.payload);
                    break;
                case 'SET_FILTER_CATEGORY':
                    response = await handleSetFilterCategory(message.payload);
                    break;
                case 'ADD_WHITELIST_DOMAIN':
                    response = await handleAddWhitelistDomain(message.payload);
                    break;
                case 'REMOVE_WHITELIST_DOMAIN':
                    response = await handleRemoveWhitelistDomain(message.payload);
                    break;
                case 'SET_ANTIPOPUP_MODE':
                    response = await handleSetAntiPopupMode(message.payload);
                    break;
                case 'INCREMENT_STATS':
                    response = await handleIncrementStats(message.payload);
                    break;
                case 'RESET_STATS':
                    response = await handleResetStats();
                    break;
                default:
                    response = { success: false, error: `Unknown message type: ${message.type}` };
            }
        }
        catch (err) {
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
});

browser.runtime.onInstalled.addListener(() => {
    void initialize();
});

void initialize();
