// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// ─── Storage Keys ────────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
    ENABLED: 'kblock_enabled',
    FILTER_SOURCES: 'kblock_filter_sources',
    WHITELIST: 'kblock_whitelist',
    ANTI_POPUP_MODE: 'kblock_antipopup_mode',
    STATS: 'kblock_stats',
    LAST_UPDATED: 'kblock_last_updated',
};
// ─── Default State ───────────────────────────────────────────────────────────
export const DEFAULT_STATE = {
    enabled: true,
    filterSources: [
        {
            id: 'base',
            name: 'KBlock Base Rules',
            enabled: true,
            ruleCount: 0,
            lastUpdated: null,
            errorMessage: null,
            status: 'active',
        },
    ],
    whitelist: [],
    antiPopupMode: 'balanced',
    lastUpdated: null,
    stats: {
        totalBlocked: 0,
        sessionBlocked: 0,
        lastResetDate: null,
    },
};
