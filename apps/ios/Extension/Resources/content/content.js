// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
let isEnabled = true;
let antiPopupMode = 'balanced';
let isInitialized = false;
function sendMessage(message) {
    return browser.runtime.sendMessage(message);
}
// ─── 1. Cosmetic CSS Injection ────────────────────────────────────────────────
const BETTING_DOMAINS = [
    'bet', '88', 'casino', 'kubet', 'thabet', 'sunwin', 'b52', 'go88',
    'bk8', 'fun88', 'w88', '12bet', 'm88', 'fb88', 'dafabet', 'k8',
    'jun88', '789bet', 'new88', 'hi88', 'shbet', 'f8bet', 'nohu',
    'gamebai', 'banca', 'taixiu', 'keonhacai', 'bong88', 'vsbet', 'cm88', 'sun88'
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
    // Common Movie & Streaming Site Ad Containers (Motchill, Phimmoi, Bilutv, etc.)
    '[class*="banner-top"]', '[class*="top-banner"]',
    '[class*="banner-ads"]', '[class*="ad-banner"]',
    '[id*="banner-ads"]', '[id*="ad-banner"]',
    '[class*="banner_top"]', '[class*="top_banner"]',
    '[class*="banner_header"]', '[class*="header_banner"]',
    '[class*="banner-header"]', '[class*="header-banner"]',
    '[class*="floating-banner"]', '[class*="catfish-banner"]',
    '[class*="sticky-banner"]', '[class*="qc-"]', '[id*="qc-"]',
    '[class*="quangcao"]', '[id*="quangcao"]',
    '[class*="quang-cao"]', '[id*="quang-cao"]',
    '.advertisement', '.ads-holder', '.ad-box',
    // Betting & Gambling Links (covers VSbet, CM88, SUN88, etc.)
    ...BETTING_DOMAINS.map(b => `a[href*="${b}"][target="_blank"]`),
    ...BETTING_DOMAINS.map(b => `a[href*="${b}"] img`),
    ...BETTING_DOMAINS.map(b => `[class*="${b}"] img`),
    // Overlays & Clickjackers
    '[class*="popup-overlay"]', '[class*="ad-overlay"]', '[class*="ads-overlay"]',
    '[id*="popup-overlay"]', '[id*="ad-popup"]'
];
const STYLE_ID = 'kblock-cosmetic-filters';
function injectCosmeticStyles() {
    if (document.getElementById(STYLE_ID))
        return;
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
function removeCosmeticStyles() {
    const existing = document.getElementById(STYLE_ID);
    if (existing)
        existing.remove();
}
// ─── 2. DOM Banner & Betting Cleaner ──────────────────────────────────────────
const BETTING_REGEX = new RegExp(BETTING_DOMAINS.join('|'), 'i');
function cleanAdElements() {
    if (!isEnabled)
        return;
    // 1. Sweep <a> tags with betting links
    const links = document.querySelectorAll('a[href]');
    links.forEach((a) => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href && BETTING_REGEX.test(href)) {
            // If the link contains images or banners, hide the parent container if it's solely an ad container
            const parent = a.parentElement;
            if (parent && parent !== document.body && parent !== document.documentElement) {
                const text = parent.innerText.trim();
                // If parent has little text or is just an ad banner, remove it
                if (text.length < 50 || /banner|qc|quangcao|ad/i.test(parent.className + ' ' + parent.id)) {
                    parent.style.setProperty('display', 'none', 'important');
                }
            }
            a.style.setProperty('display', 'none', 'important');
        }
    });
    // 2. Remove floating full-screen overlays with high z-index
    const overlays = document.querySelectorAll('[class*="popup"], [class*="overlay"], [class*="modal"]');
    overlays.forEach((el) => {
        const style = window.getComputedStyle(el);
        if ((style.position === 'fixed' || style.position === 'absolute') && parseInt(style.zIndex, 10) > 100) {
            if (/ad|banner|qc|pop|promo/i.test(el.className + ' ' + el.id)) {
                el.remove();
            }
        }
    });
}
// ─── 3. Anti-Popup & Popunder ─────────────────────────────────────────────────
let originalWindowOpen = null;
function isSuspiciousPopup(url) {
    if (!url || url === 'about:blank' || url.startsWith('javascript:'))
        return true;
    return BETTING_REGEX.test(url) || /popads|popcash|propeller|adsterra|monetag|click|track|aff/i.test(url);
}
function installPopupBlocker(mode) {
    if (mode === 'off') {
        if (originalWindowOpen) {
            window.open = originalWindowOpen;
            originalWindowOpen = null;
        }
        return;
    }
    if (!originalWindowOpen) {
        originalWindowOpen = window.open.bind(window);
    }
    window.open = function blockedWindowOpen(url, target, features) {
        const urlString = String(url ?? '');
        if (mode === 'strict' || isSuspiciousPopup(urlString)) {
            void sendMessage({
                type: 'POPUP_DETECTED',
                payload: { url: urlString },
            }).catch(() => undefined);
            console.warn('[KBlock] Blocked ad popup:', urlString);
            return null;
        }
        return originalWindowOpen
            ? originalWindowOpen(url, target, features)
            : null;
    };
}
// Intercept clickjacking on links that lead to betting/ad sites
function handleDocumentClick(event) {
    if (!isEnabled)
        return;
    const target = event.target;
    if (!target)
        return;
    const link = target.closest('a');
    if (link && link.href) {
        if (BETTING_REGEX.test(link.href)) {
            event.preventDefault();
            event.stopPropagation();
            console.warn('[KBlock] Blocked click on betting link:', link.href);
            return;
        }
    }
    // Intercept full-screen clickjacking overlays
    if (target !== document.body && target !== document.documentElement) {
        const style = window.getComputedStyle(target);
        const isFixedOrAbsolute = style.position === 'fixed' || style.position === 'absolute';
        const isHighZIndex = parseInt(style.zIndex, 10) > 100;
        const isFullCover = target.offsetWidth >= window.innerWidth * 0.9 && target.offsetHeight >= window.innerHeight * 0.9;
        if (isFixedOrAbsolute && isHighZIndex && isFullCover && target.innerText.trim().length === 0) {
            event.preventDefault();
            event.stopPropagation();
            target.remove();
            console.warn('[KBlock] Removed full-screen clickjack overlay');
        }
    }
}
// ─── 4. Dynamic MutationObserver ──────────────────────────────────────────────
let observer = null;
function installMutationObserver() {
    if (observer)
        observer.disconnect();
    observer = new MutationObserver(() => {
        cleanAdElements();
    });
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
}
// ─── 5. Initialization ────────────────────────────────────────────────────────
async function initialize() {
    if (isInitialized)
        return;
    try {
        const response = await sendMessage({ type: 'GET_STATE' });
        if (response.success && response.data) {
            const state = response.data;
            isEnabled = state.enabled;
            antiPopupMode = state.antiPopupMode;
        }
    }
    catch {
        isEnabled = true;
        antiPopupMode = 'balanced';
    }
    if (isEnabled) {
        injectCosmeticStyles();
        installPopupBlocker(antiPopupMode);
        installMutationObserver();
        document.addEventListener('click', handleDocumentClick, true);
        if (document.readyState !== 'loading') {
            cleanAdElements();
        }
        else {
            document.addEventListener('DOMContentLoaded', cleanAdElements);
        }
    }
    isInitialized = true;
}
browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'SET_ENABLED') {
        isEnabled = message.payload;
        if (isEnabled) {
            injectCosmeticStyles();
            installPopupBlocker(antiPopupMode);
            installMutationObserver();
            cleanAdElements();
        }
        else {
            removeCosmeticStyles();
            if (observer)
                observer.disconnect();
        }
    }
    else if (message.type === 'SET_ANTIPOPUP_MODE') {
        antiPopupMode = message.payload;
        installPopupBlocker(antiPopupMode);
    }
});
void initialize();
export {};
