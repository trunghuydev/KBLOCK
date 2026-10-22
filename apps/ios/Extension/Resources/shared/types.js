// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const STORAGE_KEYS = {
    ENABLED: 'kblock_enabled',
    FILTER_SOURCES: 'kblock_filter_sources',
    FILTER_CATEGORIES: 'kblock_filter_categories',
    WHITELIST: 'kblock_whitelist',
    ANTI_POPUP_MODE: 'kblock_antipopup_mode',
    STATS: 'kblock_stats',
    LAST_UPDATED: 'kblock_last_updated',
};

export const DEFAULT_STATE = {
    enabled: true,
    filterSources: [
        {
            id: 'abpvn',
            name: 'ABPVN — Bộ lọc Việt Nam',
            enabled: true,
            ruleCount: 8420,
            lastUpdated: '2026-10-22',
            errorMessage: null,
            status: 'active',
        },
        {
            id: 'gambling',
            name: 'Chống Cá cược & Nhà cái VN',
            enabled: true,
            ruleCount: 5120,
            lastUpdated: '2026-10-22',
            errorMessage: null,
            status: 'active',
        },
        {
            id: 'easylist',
            name: 'EasyList Quảng cáo',
            enabled: true,
            ruleCount: 48500,
            lastUpdated: '2026-10-22',
            errorMessage: null,
            status: 'active',
        },
        {
            id: 'annoyances',
            name: 'Chống Pop-up & Khó chịu',
            enabled: true,
            ruleCount: 6300,
            lastUpdated: '2026-10-22',
            errorMessage: null,
            status: 'active',
        },
    ],
    filterCategories: {
        abpvn: true,
        gambling: true,
        easylist: true,
        annoyances: true,
    },
    whitelist: [],
    antiPopupMode: 'balanced',
    lastUpdated: '2026-10-22T22:00:00Z',
    stats: {
        totalBlocked: 142,
        sessionBlocked: 12,
        adsBlocked: 98,
        trackersBlocked: 36,
        popupsBlocked: 8,
        bandwidthSavedMB: 28.5,
        lastResetDate: null,
    },
};
