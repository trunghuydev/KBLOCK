// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Content Script (isolated world)
 *
 * Runs at document_start on all pages and frames.
 *
 * Layers:
 * 1. Main World script injection (anti-popup) + config feeding.
 * 2. Cosmetic CSS: hand-written selectors + element-hide bundle produced by
 *    the filter pipeline (rules/generated/element-hide.json).
 * 3. Cookie/consent banner hiding (independent toggle).
 * 4. Element picker — tap an element on the page to block it.
 * 5. Anti-tracking link cleaning + stats/activity reporting.
 */

import type { Message, MessageResponse, AntiPopupMode, ElementRule } from '../shared/types';

interface PageConfig {
  enabled: boolean;
  antiPopupMode: AntiPopupMode;
  annoyances: boolean;
  antiTracking: boolean;
  cookieBanners: boolean;
  whitelist: string[];
  elementRules: ElementRule[];
}

let config: PageConfig = {
  enabled: true,
  antiPopupMode: 'balanced',
  annoyances: true,
  antiTracking: true,
  cookieBanners: true,
  whitelist: [],
  elementRules: [],
};

let isInitialized = false;

function sendMessage(message: Message): Promise<MessageResponse> {
  try {
    return browser.runtime.sendMessage(message) as Promise<MessageResponse>;
  } catch {
    return Promise.resolve({ success: false });
  }
}

// ─── Protection predicates ───────────────────────────────────────────────────

function isWhitelisted(): boolean {
  const host = window.location.hostname;
  return config.whitelist.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Master-level checks shared by every layer. */
function isBaseActive(): boolean {
  return config.enabled && !isWhitelisted();
}

/** Cosmetic/anti-popup layer (annoyances toggle). */
function isCosmeticActive(): boolean {
  return isBaseActive() && config.annoyances;
}

/** Cookie banner layer (own toggle). */
function isCookieActive(): boolean {
  return isBaseActive() && config.cookieBanners;
}

// ─── 0. Main World Script Injection ──────────────────────────────────────────

function injectMainWorldProtection(): void {
  const script = document.createElement('script');
  script.src = browser.runtime.getURL('content/injected.js');
  script.async = false;
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
}

function sendConfigToMainWorld(): void {
  try {
    window.postMessage(
      {
        source: 'kblock-content-script',
        type: 'kblock-config',
        armed: isCosmeticActive(),
        mode: config.antiPopupMode,
      },
      window.location.origin,
    );
  } catch {
    // Page may be gone — ignore.
  }
}

// ─── 1. Cosmetic CSS (hand-written + generated element-hide) ─────────────────

/** Distinctive betting-brand tokens — safe to match anywhere in a URL. */
const BETTING_BRANDS = [
  'kubet', 'thabet', 'sunwin', 'go88', 'bk8', 'fun88', '12bet', 'fb88',
  'dafabet', 'jun88', '789bet', 'new88', 'hi88', 'shbet', 'f8bet',
  'nohu', 'gamebai', 'taixiu', 'keonhacai', 'vsbet', 'okvip',
  'i9bet', '79king', 'mb66', 'win55', 'hello88', 'sonclub', 'qqlive',
];

/** Generic gambling words — only matched in hostnames, never in paths. */
const BETTING_HOST_WORDS = ['casino', 'bong88', 'sv388', 'qq88', 'b29'];

const BETTING_BRANDS_CSS = BETTING_BRANDS.map((b) => `[href*="${b}"], [src*="${b}"]`).join(', ');

const AD_SELECTORS = [
  'ins.adsbygoogle',
  'div[id^="google_ads_"]',
  'div[id^="aswift_"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googleadservices.com"]',
  '[class*="taboola"]',
  '[class*="outbrain"]',
  '[class*="mgid"]',
  '[class*="admicro"]', '[id*="admicro"]',
  '[class*="eclick"]', '[id*="eclick"]',
  '[class*="novanet"]', '[class*="adtima"]', '[class*="ambient"]',
  '#div_ad_top', '#ads_top', '#ads-preload', '#mobileCatfish', '#pmadv',
  '.banner-ads', '.ad-banner', '.ads-holder', '.ads-container', '.box-ads',
  '[class*="quangcao"]', '[id*="quangcao"]',
  '[class*="quang-cao"]', '[id*="quang-cao"]',
  '.qc-bottom', '.qc-top', '.qc-left', '.qc-right', '.float-ck',
  '[class^="qc-"]', '[id^="qc-"]',
  '.catfish-banner', '.floating-banner', '.sticky-banner',
  '#bn_bottom_fixed_', '.section-catfish',
  BETTING_BRANDS_CSS,
];

const HIDE_CSS = 'display:none!important;visibility:hidden!important;height:0!important;' +
  'max-height:0!important;min-height:0!important;opacity:0!important;' +
  'pointer-events:none!important;overflow:hidden!important;margin:0!important;padding:0!important;';

interface ElementHideBundle {
  global: string[];
  scoped: Array<{ selector: string; domains: string[] }>;
  exceptions: Record<string, string[]>;
}

let generatedHide: ElementHideBundle | null = null;

async function loadGeneratedHide(): Promise<void> {
  try {
    const res = await fetch(browser.runtime.getURL('rules/generated/element-hide.json'));
    if (!res.ok) return;
    generatedHide = (await res.json()) as ElementHideBundle;
  } catch {
    generatedHide = null;
  }
}

function hostMatches(domains: string[]): boolean {
  const host = window.location.hostname;
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Selectors from the pipeline bundle that apply to this page. */
function generatedSelectorsForThisPage(): string[] {
  if (!generatedHide) return [];
  const out: string[] = [];
  for (const sel of generatedHide.global) {
    const exc = generatedHide.exceptions[sel];
    if (exc && hostMatches(exc)) continue;
    out.push(sel);
  }
  for (const entry of generatedHide.scoped) {
    if (!hostMatches(entry.domains)) continue;
    const exc = generatedHide.exceptions[entry.selector];
    if (exc && hostMatches(exc)) continue;
    out.push(entry.selector);
  }
  return out;
}

const STYLE_ID = 'kblock-cosmetic-filters';

function injectCosmeticStyles(): void {
  if (!isCosmeticActive()) return;
  if (document.getElementById(STYLE_ID)) return;

  const selectors = [...AD_SELECTORS, ...generatedSelectorsForThisPage()];
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    ${selectors.join(',\n    ')} {
      ${HIDE_CSS}
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

function removeCosmeticStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

// ─── 2. Cookie / consent banners ─────────────────────────────────────────────

const COOKIE_BANNER_SELECTORS = [
  // OneTrust
  '#onetrust-consent-sdk', '#onetrust-banner-sdk', '.onetrust-pc-dark-filter',
  // Cookiebot
  '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay',
  // Complianz, CookieYes, Borlabs, iubenda, tarteaucitron, Osano, Sourcepoint
  '#cmplz-cookiebanner-container', '.cmplz-cookiebanner', '#cmplz_cookiebanner',
  '.cky-consent', '#cookieyes', '#BorlabsCookieBox',
  '#iubenda-cs-banner', '#tarteaucitronRoot', '#tarteaucitronAlertBig',
  '.cc-window', '.cc-banner', '.sp_message_container',
  // Generic
  '#cookie-notice', '#cookie-consent', '#cookie-banner', '#CookieBanner',
  '#cookie-law-info-bar', '#cookie-law-info-again',
  '.cookie-banner', '.cookie-consent', '.cookie-notice', '.cookieconsent',
  '.consent-banner', '.gdpr-banner', '.gdpr-cookie-notice',
  '[id*="cookie-consent"]', '[id*="cookie-banner"]', '[id*="CookieBanner"]',
  '[class*="cookie-banner"]', '[class*="cookie-consent"]',
  '[class*="consent-banner"]', '[class*="cookieConsent"]', '[class*="cookieNotice"]',
  '[id*="qc-cmp2"]', '[class*="qc-cmp2"]',
];

const COOKIE_STYLE_ID = 'kblock-cookie-css';

function injectCookieStyles(): void {
  if (!isCookieActive()) return;
  if (document.getElementById(COOKIE_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = COOKIE_STYLE_ID;
  style.textContent = `
    ${COOKIE_BANNER_SELECTORS.join(',\n    ')} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // Many consent banners lock scrolling via an inline overflow style.
  unlockScroll();
}

function unlockScroll(): void {
  for (const el of [document.documentElement, document.body]) {
    if (el && el.style && el.style.overflow === 'hidden') {
      el.style.overflow = '';
    }
  }
}

function removeCookieStyles(): void {
  document.getElementById(COOKIE_STYLE_ID)?.remove();
}

// ─── 3. Element rules (from the picker) ──────────────────────────────────────

const ELEMENT_STYLE_ID = 'kblock-element-css';

function elementSelectorsForThisPage(): string[] {
  const host = window.location.hostname;
  return config.elementRules
    .filter((r) => r.enabled && (host === r.host || host.endsWith(`.${r.host}`)))
    .map((r) => r.selector);
}

function injectElementRuleStyles(): void {
  const existing = document.getElementById(ELEMENT_STYLE_ID);
  const selectors = isBaseActive() ? elementSelectorsForThisPage() : [];

  if (selectors.length === 0) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.textContent = buildElementCss(selectors);
    return;
  }
  const style = document.createElement('style');
  style.id = ELEMENT_STYLE_ID;
  style.textContent = buildElementCss(selectors);
  (document.head || document.documentElement).appendChild(style);
}

function buildElementCss(selectors: string[]): string {
  return selectors.map((sel) => `${sel} { ${HIDE_CSS} }`).join('\n');
}

// ─── 4. Element Picker ───────────────────────────────────────────────────────

let pickerCleanup: (() => void) | null = null;

function isTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

function startElementPicker(): void {
  if (!isTopFrame() || pickerCleanup) return;

  const doc = document;
  const highlight = doc.createElement('div');
  highlight.style.cssText =
    'position:fixed;border:2px solid #e11d48;background:rgba(225,29,72,0.12);' +
    'border-radius:3px;pointer-events:none;z-index:2147483645;display:none;';

  const toolbar = doc.createElement('div');
  toolbar.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:8px;' +
    'z-index:2147483646;padding:8px 10px;border-radius:14px;background:rgba(22,26,23,0.94);' +
    'color:#fff;font:13px -apple-system,system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,0.35);';

  const mkButton = (label: string, action: () => void): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.textContent = label;
    b.style.cssText =
      'border:0;border-radius:9px;padding:8px 14px;font:600 13px -apple-system,system-ui,sans-serif;' +
      'background:rgba(255,255,255,0.14);color:#fff;cursor:pointer;';
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      action();
    });
    return b;
  };

  let target: Element | null = null;

  const showHighlight = (): void => {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = `${Math.max(0, rect.left - 2)}px`;
    highlight.style.top = `${Math.max(0, rect.top - 2)}px`;
    highlight.style.width = `${rect.width + 4}px`;
    highlight.style.height = `${rect.height + 4}px`;
  };

  const updateFromPoint = (x: number, y: number): void => {
    const el = doc.elementFromPoint(x, y);
    if (!el || el === highlight || toolbar.contains(el)) return;
    target = el;
    showHighlight();
  };

  const onMove = (e: MouseEvent): void => updateFromPoint(e.clientX, e.clientY);
  const onTouch = (e: TouchEvent): void => {
    const t = e.touches[0];
    if (t) updateFromPoint(t.clientX, t.clientY);
  };
  const onClickCapture = (e: MouseEvent): void => {
    const node = e.target as Node;
    if (toolbar.contains(node)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = doc.elementFromPoint(e.clientX, e.clientY);
    if (el && !toolbar.contains(el) && el !== highlight) {
      target = el;
      void confirmBlock();
    }
  };

  const expand = (): void => {
    if (target?.parentElement && target !== doc.body && target !== doc.documentElement) {
      target = target.parentElement;
      showHighlight();
    }
  };

  const stop = (): void => {
    highlight.remove();
    toolbar.remove();
    doc.removeEventListener('mousemove', onMove, true);
    doc.removeEventListener('touchstart', onTouch, true);
    doc.removeEventListener('click', onClickCapture, true);
    pickerCleanup = null;
  };

  toolbar.append(
    mkButton('Mở rộng vùng', expand),
    mkButton('🚫 Chặn', () => void confirmBlock()),
    mkButton('Hủy', stop),
  );
  doc.documentElement.append(highlight, toolbar);
  doc.addEventListener('mousemove', onMove, true);
  doc.addEventListener('touchstart', onTouch, true);
  doc.addEventListener('click', onClickCapture, true);
  pickerCleanup = stop;

  function confirmBlock(): void {
    const el = target;
    if (!el) return;
    const selector = generateSelector(el);
    stop();
    if (!selector) return;

    // Apply immediately, then persist via the background.
    const style = doc.createElement('style');
    style.textContent = buildElementCss([selector]);
    doc.documentElement.append(style);

    void sendMessage({
      type: 'ADD_ELEMENT_RULE',
      payload: { host: window.location.hostname, selector },
    });
    showToast('✓ Đã thêm quy tắc chặn phần tử');
  }
}

/** Show a transient toast in the page (top frame only). */
function showToast(text: string): void {
  if (!isTopFrame()) return;
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText =
    'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483646;' +
    'padding:10px 18px;border-radius:12px;background:rgba(22,26,23,0.94);color:#fff;' +
    'font:600 13px -apple-system,system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,0.35);';
  document.documentElement.append(toast);
  setTimeout(() => toast.remove(), 1800);
}

/** Build the shortest CSS selector that uniquely matches `el` on this page. */
function generateSelector(el: Element): string | null {
  const esc = (s: string): string =>
    typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/([^\w-])/g, '\\$1');

  const isUnique = (sel: string): boolean => {
    try {
      return document.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };

  // 1. Unique id wins.
  if (el.id) {
    const candidate = `#${esc(el.id)}`;
    if (isUnique(candidate)) return candidate;
  }

  // 2. Tag + up to two classes, walking up to body.
  const relaxed: string[] = [];
  const strict: string[] = [];
  let node: Element | null = el;
  let depth = 0;

  while (node && node !== document.body && node !== document.documentElement && depth < 12) {
    const current: Element = node;
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;

    let sameTagIndex = 1;
    if (parent) {
      const siblings: Element[] = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current.tagName,
      );
      sameTagIndex = siblings.indexOf(current) + 1;
    }
    strict.unshift(`${tag}:nth-of-type(${sameTagIndex})`);

    const classes = Array.from(current.classList).slice(0, 2).map(esc);
    relaxed.unshift(classes.length > 0 ? `${tag}.${classes.join('.')}` : tag);

    node = parent;
    depth++;
  }

  const prefix = node === document.body ? ['body'] : [];
  const relaxedSel = [...prefix, ...relaxed].join(' > ');
  if (isUnique(relaxedSel)) return relaxedSel;

  const strictSel = [...prefix, ...strict].join(' > ');
  return isUnique(strictSel) ? strictSel : strictSel || null;
}

// ─── 5. DOM Sweep (throttled) ─────────────────────────────────────────────────

const BETTING_BRANDS_REGEX = new RegExp(BETTING_BRANDS.join('|'), 'i');
const BETTING_HOST_REGEX = new RegExp([...BETTING_BRANDS, ...BETTING_HOST_WORDS].join('|'), 'i');

let sweepScheduled = false;

function scheduleSweep(): void {
  if (sweepScheduled || !isCosmeticActive()) return;
  sweepScheduled = true;
  setTimeout(() => {
    sweepScheduled = false;
    cleanAdElements();
  }, 300);
}

function cleanAdElements(): void {
  if (!isCosmeticActive()) return;

  let cleaned = 0;

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href) return;
    let matches: boolean;
    try {
      const url = new URL(href, window.location.href);
      matches = BETTING_HOST_REGEX.test(url.hostname) || BETTING_BRANDS_REGEX.test(url.pathname);
    } catch {
      matches = false;
    }
    if (matches) {
      (a as HTMLElement).style.setProperty('display', 'none', 'important');
      cleaned++;
    }
  });

  document
    .querySelectorAll('[class*="catfish"], [class*="floating"], [id*="floating"], [class*="bottom-fixed"], [id*="bottom_fixed"]')
    .forEach((el) => {
      const key = `${el.className} ${el.id}`.toLowerCase();
      if (/qc|quangcao|ad|banner|adv/.test(key)) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        cleaned++;
      }
    });

  document
    .querySelectorAll('[class*="popup"], [class*="overlay"], [class*="modal"]')
    .forEach((el) => {
      const key = `${el.className} ${el.id}`.toLowerCase();
      if (!/ad|qc|quang|banner|promo|popads|ads/.test(key)) return;
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);
      if ((style.position === 'fixed' || style.position === 'absolute') && zIndex > 99) {
        el.remove();
        cleaned++;
      }
    });

  if (cleaned > 0) {
    void sendMessage({
      type: 'INCREMENT_STATS',
      payload: { count: cleaned, category: 'ads' },
    });
  }
}

// ─── 6. MutationObserver (throttled) ─────────────────────────────────────────

let observer: MutationObserver | null = null;

function installMutationObserver(): void {
  observer?.disconnect();
  observer = new MutationObserver(scheduleSweep);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

// ─── 7. Anti-tracking: strip tracking params from clicked links ──────────────

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'fbclid', 'gclid', 'dclid', 'msclkid',
  'igshid', 'ttclid', 'mkt_tok', 'yclid', 'mc_cid', 'mc_eid', 'ref_src',
  'ref_url', '_ga', 'si',
];

function stripTrackingParams(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    let changed = false;
    for (const param of TRACKING_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    return changed ? url.toString() : null;
  } catch {
    return null;
  }
}

document.addEventListener(
  'click',
  (e) => {
    if (!config.antiTracking || !config.enabled) return;
    const target = e.target as HTMLElement | null;
    const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const cleaned = stripTrackingParams(anchor.getAttribute('href') || '');
    if (cleaned) anchor.setAttribute('href', cleaned);
  },
  true,
);

// ─── 8. Events from Main World ────────────────────────────────────────────────

window.addEventListener('kblock-action-blocked', ((e: CustomEvent) => {
  const detail = e.detail as { type: 'popup' | 'redirect' | 'clickjack'; url: string };
  const category = detail.type === 'popup' || detail.type === 'redirect' ? 'popups' : 'ads';

  void sendMessage({
    type: 'INCREMENT_STATS',
    payload: { count: 1, category },
  });
  void sendMessage({
    type: 'LOG_ACTIVITY',
    payload: { type: detail.type, url: detail.url || window.location.href },
  });
}) as EventListener);

// ─── 9. Messages from background / popup ─────────────────────────────────────

interface ConfigPayload {
  enabled: boolean;
  whitelist: string[];
  antiPopupMode: AntiPopupMode;
  antiTracking: boolean;
  cookieBanners: boolean;
  annoyances: boolean;
  elementRules: ElementRule[];
}

function applyConfig(payload: Partial<ConfigPayload>): void {
  if (typeof payload.enabled === 'boolean') config.enabled = payload.enabled;
  if (Array.isArray(payload.whitelist)) config.whitelist = payload.whitelist;
  if (typeof payload.antiPopupMode === 'string') config.antiPopupMode = payload.antiPopupMode;
  if (typeof payload.antiTracking === 'boolean') config.antiTracking = payload.antiTracking;
  if (typeof payload.cookieBanners === 'boolean') config.cookieBanners = payload.cookieBanners;
  if (typeof payload.annoyances === 'boolean') config.annoyances = payload.annoyances;
  if (Array.isArray(payload.elementRules)) config.elementRules = payload.elementRules;

  sendConfigToMainWorld();

  if (isCosmeticActive()) {
    injectCosmeticStyles();
    installMutationObserver();
    scheduleSweep();
  } else {
    removeCosmeticStyles();
    observer?.disconnect();
    observer = null;
  }

  if (isCookieActive()) {
    injectCookieStyles();
  } else {
    removeCookieStyles();
  }

  injectElementRuleStyles();
}

browser.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'CONFIG_UPDATED') {
    applyConfig((message.payload ?? {}) as Partial<ConfigPayload>);
  } else if (message.type === 'SET_ENABLED') {
    applyConfig({ enabled: Boolean(message.payload) });
  } else if (message.type === 'SET_ANTIPOPUP_MODE') {
    applyConfig({ antiPopupMode: message.payload as AntiPopupMode });
  } else if (message.type === 'START_ELEMENT_PICKER') {
    startElementPicker();
  }
});

// ─── 10. Initialization ───────────────────────────────────────────────────────

async function initialize(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  injectMainWorldProtection();
  void loadGeneratedHide().then(() => {
    // Re-apply cosmetic styles now that the generated bundle is available.
    if (isCosmeticActive()) injectCosmeticStyles();
  });

  try {
    const response = await sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      applyConfig(response.data as Partial<ConfigPayload>);
      return;
    }
  } catch {
    // Fall through with default config.
  }

  sendConfigToMainWorld();
  injectCosmeticStyles();
  injectCookieStyles();
  injectElementRuleStyles();
  installMutationObserver();
  if (document.readyState !== 'loading') {
    cleanAdElements();
  } else {
    document.addEventListener('DOMContentLoaded', cleanAdElements, { once: true });
  }
}

void initialize();
