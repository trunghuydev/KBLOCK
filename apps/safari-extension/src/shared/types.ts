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
  whitelist: string[];
  antiPopupMode: AntiPopupMode;
  lastUpdated: string | null; // ISO 8601 timestamp
  stats: BlockStats;
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
  lastResetDate: string | null;
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export type MessageType =
  | 'GET_STATE'
  | 'SET_ENABLED'
  | 'SET_FILTER_SOURCE'
  | 'ADD_WHITELIST_DOMAIN'
  | 'REMOVE_WHITELIST_DOMAIN'
  | 'SET_ANTIPOPUP_MODE'
  | 'GET_CURRENT_DOMAIN'
  | 'PAGE_BLOCKED_COUNT'
  | 'POPUP_DETECTED';

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
  addedAt: string; // ISO 8601
  note?: string;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  ENABLED: 'kblock_enabled',
  FILTER_SOURCES: 'kblock_filter_sources',
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
