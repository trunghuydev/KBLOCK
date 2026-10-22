// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Content Script
 *
 * Runs at document_start on all pages where the extension has permission.
 *
 * Features:
 * 1. Cosmetic Filtering (CSS Injection): Hides ad banner containers and placeholders
 * 2. Smart Popup Blocker: Intercepts ad popups, popunders, and clickjack overlays
 * 3. MutationObserver: Continuously removes dynamic ad banners and modal overlays
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

// ─── Cosmetic Filtering (CSS Injection) ───────────────────────────────────────

const AD_SELECTORS = [
  // Google Ads
  'ins.adsbygoogle',
  'div[id^="google_ads_"]',
  'div[id^="aswift_"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="doubleclick.net"]',

  // Vietnamese Ad Networks
  '[class*="admicro"]',
  '[id*="admicro"]',
  '[class*="vccorp"]',
  '[id*="vccorp"]',
  '[class*="eclick"]',
  '[id*="eclick"]',
  '[class*="quangcao"]',
  '[id*="quangcao"]',
  '[class*="quang-cao"]',
  '[id*="quang-cao"]',
  '[class*="ambient"]',
  '[class*="novanet"]',
  '[class*="adtima"]',

  // Common Ad Banners & Placeholders
  '[class*="banner-ads"]',
  '[class*="ad-banner"]',
  '[id*="banner-ads"]',
  '[id*="ad-banner"]',
  '[class*="top-banner-ad"]',
  '[class*="bottom-banner-ad"]',
  '[class*="sticky-banner"]',
  '[class*="sidebar-ads"]',
  '.advertisement',
  '.ads-holder',
  '.ad-box',

  // Recommendation & Native Ads Widgets
  '[class*="taboola"]',
  '[class*="outbrain"]',
  '[class*="mgid"]',

  // Overlays & Popups
  '[class*="popup-overlay"]',
  '[class*="ad-overlay"]',
  '[class*="ads-overlay"]',
  '[id*="popup-overlay"]',
  '[id*="ad-popup"]',
  '[class*="qc-popup"]',
  '[id*="qc-popup"]',
  '[class*="quangcao-popup"]',
];

const STYLE_ID = 'kblock-cosmetic-filters';

function injectCosmeticStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ${AD_SELECTORS.join(',\n    ')} {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      max-height: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;

  // Inject into documentElement so it applies before body exists
  (document.head || document.documentElement).appendChild(style);
}

function removeCosmeticStyles(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    existing.remove();
  }
}

// ─── Smart Popup & Popunder Suppression ───────────────────────────────────────

const PAGE_LOAD_TIMESTAMP = Date.now();
let originalWindowOpen: typeof window.open | null = null;
let popupBlockCount = 0;

const AD_URL_PATTERNS = [
  /popads/i,
  /popcash/i,
  /propellerads/i,
  /exoclick/i,
  /adsterra/i,
  /monetag/i,
  /clickadu/i,
  /trafficjunky/i,
  /admicro/i,
  /eclick/i,
  /vccorp/i,
  /doubleclick/i,
  /googlesyndication/i,
  /affiliate/i,
  /tracking/i,
  /banner/i,
  /casino/i,
  /nohu/i,
  /bet88/i,
  /fb88/i,
  /w88/i,
  /kubet/i,
];

function isLikelyAdUrl(url: string): boolean {
  if (!url || url === 'about:blank' || url === 'javascript:void(0)') {
    return true; // Blank target popups are often used as popunder containers
  }
  return AD_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function installPopupBlocker(mode: AntiPopupMode): void {
  if (mode === 'off') {
    restoreWindowOpen();
    return;
  }

  if (!originalWindowOpen) {
    originalWindowOpen = window.open.bind(window);
  }

  window.open = function blockedWindowOpen(
    url?: string | URL,
    target?: string,
    features?: string,
  ): Window | null {
    const urlString = String(url ?? '');
    const timeSinceLoad = Date.now() - PAGE_LOAD_TIMESTAMP;

    let shouldBlock = false;

    if (mode === 'strict') {
      shouldBlock = true;
    } else if (mode === 'balanced') {
      // 1. Automatic popups within the initial 3 seconds are always blocked
      if (timeSinceLoad < 3000) {
        shouldBlock = true;
      }
      // 2. Any popup pointing to a known ad network or suspicious target
      else if (isLikelyAdUrl(urlString)) {
        shouldBlock = true;
      }
      // 3. Blank target popups commonly used by popunders
      else if (!urlString || urlString === 'about:blank') {
        shouldBlock = true;
      }
    }

    if (shouldBlock) {
      popupBlockCount++;
      void sendMessage({
        type: 'POPUP_DETECTED',
        payload: { url: urlString },
      }).catch(() => undefined);

      console.warn('[KBlock] Blocked popup:', urlString);
      return null;
    }

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

// ─── Clickjack Popunder Overlay Interception ─────────────────────────────────

function handleGlobalClick(event: MouseEvent): void {
  if (!isEnabled || antiPopupMode === 'off') return;

  const target = event.target as HTMLElement | null;
  if (!target) return;

  // Detect full-screen invisible clickjacking overlays
  if (target !== document.body && target !== document.documentElement) {
    const style = window.getComputedStyle(target);
    const isFixedOrAbsolute =
      style.position === 'fixed' || style.position === 'absolute';
    const isHighZIndex = parseInt(style.zIndex, 10) > 100;
    const isFullCover =
      target.offsetWidth >= window.innerWidth * 0.9 &&
      target.offsetHeight >= window.innerHeight * 0.9;

    // Check if it's an overlay that has no visible text
    if (isFixedOrAbsolute && isHighZIndex && isFullCover && target.innerText.trim().length === 0) {
      event.preventDefault();
      event.stopPropagation();
      target.remove();
      console.warn('[KBlock] Removed clickjacking popunder overlay');
    }
  }
}

// ─── MutationObserver Dynamic Cleanup ─────────────────────────────────────────

let observer: MutationObserver | null = null;

function scanAndRemoveAds(): void {
  if (!isEnabled) return;

  // Remove any remaining overlay elements
  for (const selector of [
    '[class*="popup-overlay"]',
    '[class*="ad-overlay"]',
    '[class*="qc-popup"]',
    '[id*="qc-popup"]',
  ]) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (
          (style.position === 'fixed' || style.position === 'absolute') &&
          parseInt(style.zIndex, 10) > 100
        ) {
          el.remove();
        }
      });
    } catch {
      // Ignored
    }
  }
}

function installMutationObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        scanAndRemoveAds();
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
    isEnabled = true;
    antiPopupMode = 'balanced';
  }

  if (isEnabled) {
    injectCosmeticStyles();
    installPopupBlocker(antiPopupMode);
    installMutationObserver();
    document.addEventListener('click', handleGlobalClick, true);

    if (document.readyState !== 'loading') {
      scanAndRemoveAds();
    } else {
      document.addEventListener('DOMContentLoaded', scanAndRemoveAds);
    }
  }

  isInitialized = true;
}

// ─── Message Listener ─────────────────────────────────────────────────────────

browser.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'SET_ENABLED') {
    isEnabled = message.payload as boolean;
    if (isEnabled) {
      injectCosmeticStyles();
      installPopupBlocker(antiPopupMode);
      installMutationObserver();
    } else {
      removeCosmeticStyles();
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
