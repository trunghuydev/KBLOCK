// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Shared types used across background, content, and popup modules.
 */

// ─── Extension State ────────────────────────────────────────────────────────

export interface ExtensionState {
  enabled: boolean;
  filterSources: FilterSourceState[];
  filterCategories: FilterCategories;
  whitelist: string[];
  antiPopupMode: AntiPopupMode;
  lastUpdated: string | null;
  stats: BlockStats;
}

export interface FilterCategories {
  abpvn: boolean;
  gambling: boolean;
  easylist: boolean;
  annoyances: boolean;
}

export type AntiPopupMode = 'balanced' | 'strict' | 'off';

export interface FilterSourceState {
  id: string;
  name: string;
  enabled: boolean;
  ruleCount: number;
  lastUpdated: string | null;
  errorMessage: string | null;
  status: FilterSourceStatus;
}

export type FilterSourceStatus =
  | 'active'
  | 'updating'
  | 'error'
  | 'pending-legal-review'
  | 'disabled';

export interface BlockStats {
  totalBlocked: number;
  sessionBlocked: number;
  adsBlocked: number;
  trackersBlocked: number;
  popupsBlocked: number;
  bandwidthSavedMB: number;
  lastResetDate: string | null;
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export type MessageType =
  | 'GET_STATE'
  | 'SET_ENABLED'
  | 'SET_FILTER_CATEGORY'
  | 'SET_FILTER_SOURCE'
  | 'ADD_WHITELIST_DOMAIN'
  | 'REMOVE_WHITELIST_DOMAIN'
  | 'SET_ANTIPOPUP_MODE'
  | 'GET_CURRENT_DOMAIN'
  | 'PAGE_BLOCKED_COUNT'
  | 'POPUP_DETECTED'
  | 'INCREMENT_STATS'
  | 'RESET_STATS';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── DNR Rule Helpers ────────────────────────────────────────────────────────

export interface WhitelistRule {
  domain: string;
  addedAt: string;
  note?: string;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  ENABLED: 'kblock_enabled',
  FILTER_SOURCES: 'kblock_filter_sources',
  FILTER_CATEGORIES: 'kblock_filter_categories',
  WHITELIST: 'kblock_whitelist',
  ANTI_POPUP_MODE: 'kblock_antipopup_mode',
  STATS: 'kblock_stats',
  LAST_UPDATED: 'kblock_last_updated',
} as const;

// ─── Default State ───────────────────────────────────────────────────────────

export const DEFAULT_STATE: ExtensionState = {
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
