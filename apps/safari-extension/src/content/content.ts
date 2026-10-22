// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Content Script
 *
 * Runs at document_start on all pages and iframes.
 *
 * Responsibilities:
 * 1. Synchronously injects Main World protection script into the webpage
 * 2. Injects powerful cosmetic stylesheet hiding Vietnamese movie & betting ads
 * 3. Dynamic DOM sweeping (cleans floating banners, catfish ads, clickjack overlays)
 * 4. Communicates blocked events to background worker for live statistics
 */

import type { Message, MessageResponse, AntiPopupMode } from '../shared/types';

let isEnabled = true;
let antiPopupMode: AntiPopupMode = 'balanced';
let isInitialized = false;

function sendMessage(message: Message): Promise<MessageResponse> {
  try {
    return browser.runtime.sendMessage(message) as Promise<MessageResponse>;
  } catch {
    return Promise.resolve({ success: false });
  }
}

// ─── 0. Main World Script Injection ──────────────────────────────────────────

function injectMainWorldProtection(): void {
  // Inject inline script tag into DOM at document_start
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('content/injected.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

// ─── 1. Cosmetic CSS Injection ────────────────────────────────────────────────

const BETTING_DOMAINS = [
  'bet', '88', 'casino', 'kubet', 'thabet', 'sunwin', 'b52', 'go88',
  'bk8', 'fun88', 'w88', '12bet', 'm88', 'fb88', 'dafabet', 'k8',
  'jun88', '789bet', 'new88', 'hi88', 'shbet', 'f8bet', 'nohu',
  'gamebai', 'banca', 'taixiu', 'keonhacai', 'bong88', 'vsbet', 'cm88', 'sun88',
  'gem88', 'sin88', 'okvip', 'i9bet', 'ee88', 'f88', '79king'
];

const AD_SELECTORS = [
  // Google & Global Ads
  'ins.adsbygoogle',
  'div[id^="google_ads_"]',
  'div[id^="aswift_"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googleadservices.com"]',
  '[class*="taboola"]',
  '[class*="outbrain"]',
  '[class*="mgid"]',

  // Vietnamese Ad Networks
  '[class*="admicro"]', '[id*="admicro"]',
  '[class*="vccorp"]', '[id*="vccorp"]',
  '[class*="eclick"]', '[id*="eclick"]',
  '[class*="ambient"]', '[class*="novanet"]', '[class*="adtima"]',

  // Movie & Streaming Site Ad Containers (Motchill, Phimmoi, Bilutv, Dongphim, etc.)
  '#div_ad_top', '#ads_top', '#ads-preload', '#mobileCatfish', '#pmadv',
  '.banner-top', '.top-banner', '.banner-ads', '.ad-banner', '.ad-top',
  '#banner-ads', '#ad-banner', '.banner_top', '.top_banner', '.banner_header',
  '.banner-header', '.floating-banner', '.catfish-banner', '.sticky-banner',
  '.qc-bottom', '.qc-top', '.qc-left', '.qc-right', '.float-ck',
  '[class*="qc-"]', '[id*="qc-"]',
  '[class*="quangcao"]', '[id*="quangcao"]',
  '[class*="quang-cao"]', '[id*="quang-cao"]',
  '.advertisement', '.ads-holder', '.ad-box', '.box-ads', '.ads-container',
  '[class^="adHTML"]', '[id^="bn_bottom_fixed_"]', '.section-catfish',

  // Betting & Casino Image Banners & Links
  ...BETTING_DOMAINS.map(b => `a[href*="${b}"]`),
  ...BETTING_DOMAINS.map(b => `img[src*="${b}"]`),
  ...BETTING_DOMAINS.map(b => `[class*="${b}"] img`),
  'img[src*="newchill"]',
  'img[src*="banner"]',
  'img[src*="tvc"]',
  'img[src*="preroll"]',

  // Overlays & Clickjackers
  '[class*="popup-overlay"]', '[class*="ad-overlay"]', '[class*="ads-overlay"]',
  '[id*="popup-overlay"]', '[id*="ad-popup"]',
  'div[style*="z-index: 2147483647"]',
  'div[style*="z-index: 999999"]',
  'div[style*="z-index: 99999"]'
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
      min-height: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function removeCosmeticStyles(): void {
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
}

// ─── 2. DOM Banner & Betting Cleaner ──────────────────────────────────────────

const BETTING_REGEX = new RegExp(BETTING_DOMAINS.join('|'), 'i');

function cleanAdElements(): void {
  if (!isEnabled) return;

  let cleaned = 0;

  // 1. Sweep <a> and <img> tags with betting links or banners
  const links = document.querySelectorAll('a[href]');
  links.forEach((a) => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href && BETTING_REGEX.test(href)) {
      const parent = a.parentElement;
      if (parent && parent !== document.body && parent !== document.documentElement) {
        const text = parent.innerText.trim();
        if (text.length < 80 || /banner|qc|quangcao|ad/i.test(parent.className + ' ' + parent.id)) {
          parent.style.setProperty('display', 'none', 'important');
        }
      }
      (a as HTMLElement).style.setProperty('display', 'none', 'important');
      cleaned++;
    }
  });

  // 2. Remove floating sticky bottom banners ("Tắt QC", Catfish ads)
  const stickyFooters = document.querySelectorAll(
    '[class*="catfish"], [class*="floating"], [id*="floating"], [class*="bottom-fixed"], [id*="bottom_fixed"]'
  );
  stickyFooters.forEach((el) => {
    if (/qc|ad|banner|tắt qc/i.test(el.textContent || '') || /qc|ad|banner/i.test(el.className + ' ' + el.id)) {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
      cleaned++;
    }
  });

  // 3. Remove floating full-screen overlays with high z-index
  const overlays = document.querySelectorAll('[class*="popup"], [class*="overlay"], [class*="modal"]');
  overlays.forEach((el) => {
    const style = window.getComputedStyle(el);
    if ((style.position === 'fixed' || style.position === 'absolute') && parseInt(style.zIndex, 10) > 99) {
      if (/ad|banner|qc|pop|promo/i.test(el.className + ' ' + el.id) || el.innerHTML.includes('img')) {
        el.remove();
        cleaned++;
      }
    }
  });

  if (cleaned > 0) {
    void sendMessage({
      type: 'INCREMENT_STATS',
      payload: { count: cleaned, category: 'ads' },
    });
  }
}

// ─── 3. Dynamic MutationObserver ──────────────────────────────────────────────

let observer: MutationObserver | null = null;

function installMutationObserver(): void {
  if (observer) observer.disconnect();

  observer = new MutationObserver(() => {
    cleanAdElements();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// ─── 4. Blocked Event Listener from Main World ────────────────────────────────

window.addEventListener('kblock-action-blocked', ((e: CustomEvent) => {
  const detail = e.detail as { type: 'popup' | 'redirect' | 'clickjack'; url: string };
  void sendMessage({
    type: 'INCREMENT_STATS',
    payload: {
      count: 1,
      category: detail.type === 'popup' || detail.type === 'redirect' ? 'popups' : 'ads',
    },
  });
}) as EventListener);

// ─── 5. Initialization ────────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  if (isInitialized) return;

  // Always inject Main World protection right at document_start
  injectMainWorldProtection();

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
    installMutationObserver();

    if (document.readyState !== 'loading') {
      cleanAdElements();
    } else {
      document.addEventListener('DOMContentLoaded', cleanAdElements);
    }
  }

  isInitialized = true;
}

browser.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'SET_ENABLED') {
    isEnabled = message.payload as boolean;
    if (isEnabled) {
      injectCosmeticStyles();
      installMutationObserver();
      cleanAdElements();
    } else {
      removeCosmeticStyles();
      if (observer) observer.disconnect();
    }
  } else if (message.type === 'SET_ANTIPOPUP_MODE') {
    antiPopupMode = message.payload as AntiPopupMode;
  }
});

void initialize();
