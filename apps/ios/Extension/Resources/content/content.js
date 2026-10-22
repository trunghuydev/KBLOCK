// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

let isEnabled = true;
let antiPopupMode = 'balanced';
let isInitialized = false;

function sendMessage(message) {
    try {
        return browser.runtime.sendMessage(message);
    }
    catch {
        return Promise.resolve({ success: false });
    }
}

function injectMainWorldProtection() {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('content/injected.js');
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
}

const BETTING_DOMAINS = [
    'bet', '88', 'casino', 'kubet', 'thabet', 'sunwin', 'b52', 'go88',
    'bk8', 'fun88', 'w88', '12bet', 'm88', 'fb88', 'dafabet', 'k8',
    'jun88', '789bet', 'new88', 'hi88', 'shbet', 'f8bet', 'nohu',
    'gamebai', 'banca', 'taixiu', 'keonhacai', 'bong88', 'vsbet', 'cm88', 'sun88',
    'gem88', 'sin88', 'okvip', 'i9bet', 'ee88', 'f88', '79king'
];

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
    '[class*="vccorp"]', '[id*="vccorp"]',
    '[class*="eclick"]', '[id*="eclick"]',
    '[class*="ambient"]', '[class*="novanet"]', '[class*="adtima"]',
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
    ...BETTING_DOMAINS.map(b => `a[href*="${b}"]`),
    ...BETTING_DOMAINS.map(b => `img[src*="${b}"]`),
    ...BETTING_DOMAINS.map(b => `[class*="${b}"] img`),
    'img[src*="newchill"]',
    'img[src*="banner"]',
    'img[src*="tvc"]',
    'img[src*="preroll"]',
    '[class*="popup-overlay"]', '[class*="ad-overlay"]', '[class*="ads-overlay"]',
    '[id*="popup-overlay"]', '[id*="ad-popup"]',
    'div[style*="z-index: 2147483647"]',
    'div[style*="z-index: 999999"]',
    'div[style*="z-index: 99999"]'
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

const BETTING_REGEX = new RegExp(BETTING_DOMAINS.join('|'), 'i');

function cleanAdElements() {
    if (!isEnabled)
        return;
    let cleaned = 0;
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
            a.style.setProperty('display', 'none', 'important');
            cleaned++;
        }
    });

    const stickyFooters = document.querySelectorAll('[class*="catfish"], [class*="floating"], [id*="floating"], [class*="bottom-fixed"], [id*="bottom_fixed"]');
    stickyFooters.forEach((el) => {
        if (/qc|ad|banner|tắt qc/i.test(el.textContent || '') || /qc|ad|banner/i.test(el.className + ' ' + el.id)) {
            el.style.setProperty('display', 'none', 'important');
            cleaned++;
        }
    });

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

window.addEventListener('kblock-action-blocked', ((e) => {
    const detail = e.detail;
    void sendMessage({
        type: 'INCREMENT_STATS',
        payload: {
            count: 1,
            category: detail.type === 'popup' || detail.type === 'redirect' ? 'popups' : 'ads',
        },
    });
}));

async function initialize() {
    if (isInitialized)
        return;
    injectMainWorldProtection();
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
        installMutationObserver();
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
    }
});

void initialize();
export {};
