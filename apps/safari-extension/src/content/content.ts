// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Content Script
 *
 * Runs at document_start on all pages where the extension has permission.
 *
 * Responsibilities:
 * 1. Suppress popup windows opened via window.open() (balanced/strict mode)
 * 2. Remove common overlay/interstitial ad elements via MutationObserver
 * 3. Report detected popups to background for statistics
 *
 * Limitations (documented, NOT hidden):
 * - Cannot intercept popups opened by native browser UI (iOS Safari restriction)
 * - Cannot access cross-origin iframes
 * - Only runs on pages the user has granted the extension permission for
 * - In "balanced" mode, we only block popups opened within 500ms of page load
 *   to avoid blocking legitimate auth flows (OAuth, payment confirmations, etc.)
 *
 * SECURITY: This script does NOT execute any code fetched from filter lists.
 * All logic is hardcoded here.
 */

import type { Message, MessageResponse, AntiPopupMode } from '../shared/types';

// ─── State ────────────────────────────────────────────────────────────────────

let isEnabled = true;
let antiPopupMode: AntiPopupMode = 'balanced';
let isInitialized = false;

// ─── Communication ────────────────────────────────────────────────────────────

function sendMessage(message: Message): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message) as Promise<MessageResponse>;
}

// ─── Popup Suppression ────────────────────────────────────────────────────────

const PAGE_LOAD_TIMESTAMP = Date.now();
const BALANCED_MODE_WINDOW_MS = 500; // Only block popups in first 500ms in balanced mode

let originalWindowOpen: typeof window.open | null = null;
let popupBlockCount = 0;

function installPopupBlocker(mode: AntiPopupMode): void {
  if (mode === 'off') {
    restoreWindowOpen();
    return;
  }

  // Save original before overriding
  if (!originalWindowOpen) {
    originalWindowOpen = window.open.bind(window);
  }

  window.open = function blockedWindowOpen(
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    const timeSinceLoad = Date.now() - PAGE_LOAD_TIMESTAMP;

    // In balanced mode: only block if opened very early (likely ad popup, not user-triggered)
    // In strict mode: block all window.open calls
    const shouldBlock =
      mode === 'strict' ||
      (mode === 'balanced' && timeSinceLoad < BALANCED_MODE_WINDOW_MS);

    if (shouldBlock) {
      popupBlockCount++;
      void sendMessage({ type: 'POPUP_DETECTED', payload: { url: String(url ?? '') } }).catch(
        () => undefined,
      );
      console.warn('[KBlock] Blocked popup:', url);
      return null;
    }

    // Allow: call original
    return originalWindowOpen
      ? originalWindowOpen(url as string, target, features)
      : null;
  };
}

function restoreWindowOpen(): void {
  if (originalWindowOpen) {
    window.open = originalWindowOpen;
    originalWindowOpen = null;
  }
}

// ─── Overlay Ad Removal ───────────────────────────────────────────────────────

/**
 * CSS selectors for common ad overlay patterns.
 *
 * These are STRUCTURAL selectors (id/class patterns) — they do NOT
 * execute arbitrary code from filter lists.
 *
 * Sourced from: common Vietnamese ad overlay patterns (manually curated)
 */
const OVERLAY_SELECTORS: string[] = [
  // Generic overlay patterns
  '[class*="popup-overlay"]',
  '[class*="ad-overlay"]',
  '[class*="ads-overlay"]',
  '[id*="popup-overlay"]',
  '[id*="ad-popup"]',
  // Vietnamese ad patterns (manually identified)
  '[class*="qc-popup"]',
  '[id*="qc-popup"]',
  '[class*="quangcao-popup"]',
];

let observer: MutationObserver | null = null;

function removeOverlays(): void {
  if (!isEnabled) return;

  for (const selector of OVERLAY_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        // Only remove if it looks like an overlay (fixed/absolute positioning covering viewport)
        const style = window.getComputedStyle(el);
        const isOverlay =
          (style.position === 'fixed' || style.position === 'absolute') &&
          parseInt(style.zIndex, 10) > 100;

        if (isOverlay) {
          el.remove();
        }
      });
    } catch {
      // Selector may not be valid in all contexts — skip silently
    }
  }
}

function installMutationObserver(): void {
  if (observer) {
    observer.disconnect();
  }

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        removeOverlays();
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function disconnectMutationObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// ─── Initialization ────────────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  if (isInitialized) return;

  try {
    const response = await sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      const state = response.data as { enabled: boolean; antiPopupMode: AntiPopupMode };
      isEnabled = state.enabled;
      antiPopupMode = state.antiPopupMode;
    }
  } catch {
    // Background may not be ready — use defaults
    isEnabled = true;
    antiPopupMode = 'balanced';
  }

  if (isEnabled) {
    installPopupBlocker(antiPopupMode);
    installMutationObserver();
    // Run immediately on existing DOM
    if (document.readyState !== 'loading') {
      removeOverlays();
    } else {
      document.addEventListener('DOMContentLoaded', removeOverlays);
    }
  }

  isInitialized = true;
}

// ─── Message Listener (from background/popup) ─────────────────────────────────

browser.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'SET_ENABLED') {
    isEnabled = message.payload as boolean;
    if (isEnabled) {
      installPopupBlocker(antiPopupMode);
      installMutationObserver();
    } else {
      restoreWindowOpen();
      disconnectMutationObserver();
    }
  } else if (message.type === 'SET_ANTIPOPUP_MODE') {
    antiPopupMode = message.payload as AntiPopupMode;
    if (isEnabled) {
      installPopupBlocker(antiPopupMode);
    }
  }
});

// ─── Entry Point ──────────────────────────────────────────────────────────────

void initialize();
