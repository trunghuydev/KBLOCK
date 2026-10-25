// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Shared types used across background, content, and popup modules.
 */

// ─── Native bridge ──────────────────────────────────────────────────────────

/** Bundle ID of the containing iOS app (Safari routes sendNativeMessage to it). */
export const NATIVE_APP_ID = 'dev.kblock.KBlock';

/** Dynamic DNR rules owned by KBlock start at this id (never below it). */
export const DYNAMIC_RULE_ID_START = 10000;

// ─── Extension State ────────────────────────────────────────────────────────

export interface ExtensionState {
  enabled: boolean;
  filterCategories: FilterCategories;
  whitelist: string[];
  antiPopupMode: AntiPopupMode;
  antiTracking: boolean;
  cookieBanners: boolean;
  customRules: CustomRule[];
  elementRules: ElementRule[];
  activity: BlockedEvent[];
  stats: BlockStats;
  /** Monotonic counter bumped by the native side on every config change. */
  configVersion: number;
}

export interface FilterCategories {
  abpvn: boolean;
  gambling: boolean;
  easylist: boolean;
  /** EasyPrivacy + AdGuard Spyware/URL-tracking rulesets (network level). */
  tracking: boolean;
  /** Fanboy Annoyance ruleset + cosmetic/anti-popup layer. */
  annoyances: boolean;
}

export type AntiPopupMode = 'balanced' | 'strict' | 'off';

export interface CustomRule {
  id: string;
  pattern: string;
  isAllow: boolean;
  enabled: boolean;
  createdAt: string;
}

/** Cosmetic rule created by the element picker, scoped to one host. */
export interface ElementRule {
  id: string;
  host: string;
  selector: string;
  createdAt: string;
  enabled: boolean;
}

export interface BlockedEvent {
  type: 'popup' | 'redirect' | 'clickjack';
  host: string;
  url: string;
  at: string;
}

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
  | 'ADD_WHITELIST_DOMAIN'
  | 'REMOVE_WHITELIST_DOMAIN'
  | 'SET_ANTIPOPUP_MODE'
  | 'SET_ANTI_TRACKING'
  | 'SET_COOKIE_BANNERS'
  | 'SET_CUSTOM_RULES'
  | 'ADD_ELEMENT_RULE'
  | 'REMOVE_ELEMENT_RULE'
  | 'START_ELEMENT_PICKER'
  | 'LOG_ACTIVITY'
  | 'INCREMENT_STATS'
  | 'RESET_STATS'
  | 'CONFIG_UPDATED';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Storage Keys ────────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  ENABLED: 'kblock_enabled',
  FILTER_CATEGORIES: 'kblock_filter_categories',
  WHITELIST: 'kblock_whitelist',
  ANTI_POPUP_MODE: 'kblock_antipopup_mode',
  ANTI_TRACKING: 'kblock_anti_tracking',
  COOKIE_BANNERS: 'kblock_cookie_banners',
  CUSTOM_RULES: 'kblock_custom_rules',
  ELEMENT_RULES: 'kblock_element_rules',
  ACTIVITY: 'kblock_activity',
  SITE_STATS: 'kblock_site_stats',
  STATS: 'kblock_stats',
  CONFIG_VERSION: 'kblock_config_version',
} as const;

// ─── Default State (honest zeros — no fake demo numbers) ─────────────────────

export const DEFAULT_STATE: ExtensionState = {
  enabled: true,
  filterCategories: {
    abpvn: true,
    gambling: true,
    easylist: true,
    tracking: true,
    annoyances: true,
  },
  whitelist: [],
  antiPopupMode: 'balanced',
  antiTracking: true,
  cookieBanners: true,
  customRules: [],
  elementRules: [],
  activity: [],
  stats: {
    totalBlocked: 0,
    sessionBlocked: 0,
    adsBlocked: 0,
    trackersBlocked: 0,
    popupsBlocked: 0,
    bandwidthSavedMB: 0,
    lastResetDate: null,
  },
  configVersion: 0,
};

/** Fallback count used if the bundled ruleset files cannot be read at runtime. */
export const FALLBACK_BUNDLED_RULE_COUNT = 87;
