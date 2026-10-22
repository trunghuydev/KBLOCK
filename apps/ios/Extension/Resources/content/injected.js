// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Main World Injected Script
 *
 * Runs synchronously in the page's MAIN execution context at document_start.
 * Intercepts page-level window.open, clickjacking triggers, and popunders.
 */

(function () {
  if (window.__KBLOCK_MAIN_INJECTED__) {
    return;
  }
  window.__KBLOCK_MAIN_INJECTED__ = true;

  const originalWindowOpen = window.open;

  const AD_OR_BETTING_REGEX =
    /bet|88|casino|sunwin|b52|go88|kubet|thabet|nohu|gamebai|taixiu|keonhacai|vsbet|cm88|sun88|gem88|sin88|f8bet|jun88|789bet|new88|hi88|shbet|okvip|i9bet|popads|popcash|propeller|adsterra|monetag|clickadu|hilltopads|redirect|adserve|syndication|outbrain|taboola|traffic|exoclick|juicyads/i;

  function notifyBlocked(type, url) {
    window.dispatchEvent(
      new CustomEvent('kblock-action-blocked', {
        detail: { type, url },
      }),
    );
  }

  function isAdOrMaliciousUrl(url) {
    if (!url || url === 'about:blank' || url.startsWith('javascript:')) return true;

    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin) {
        return AD_OR_BETTING_REGEX.test(parsed.hostname) || AD_OR_BETTING_REGEX.test(parsed.pathname);
      }
      if (/redirect|track|click|aff|go|out/i.test(parsed.pathname)) {
        return true;
      }
    } catch {
      return AD_OR_BETTING_REGEX.test(String(url));
    }
    return false;
  }

  try {
    const wrappedOpen = function (url, target, features) {
      const targetUrl = String(url || '');

      if (isAdOrMaliciousUrl(targetUrl)) {
        console.warn('[KBlock Main] Blocked popup:', targetUrl);
        notifyBlocked('popup', targetUrl);
        return null;
      }

      return originalWindowOpen.call(window, targetUrl, target, features);
    };

    window.open = wrappedOpen;

    try {
      Object.defineProperty(window, 'open', {
        configurable: false,
        writable: false,
        value: wrappedOpen,
      });
    } catch {
      // Ignore if freeze not allowed
    }
  } catch (err) {
    console.error('[KBlock Main] Failed to hook window.open:', err);
  }

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (!target) return;

      const anchor = target.closest ? target.closest('a') : null;
      if (anchor && anchor.href) {
        if (isAdOrMaliciousUrl(anchor.href)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          console.warn('[KBlock Main] Blocked clickjack navigation to:', anchor.href);
          notifyBlocked('redirect', anchor.href);
          return;
        }
      }

      if (target !== document.body && target !== document.documentElement) {
        const style = window.getComputedStyle(target);
        const isOverlay = style.position === 'fixed' || style.position === 'absolute';
        const zIndex = parseInt(style.zIndex, 10);
        const isHighZ = !isNaN(zIndex) && zIndex > 99;
        const isWide = target.offsetWidth >= window.innerWidth * 0.8;
        const isTall = target.offsetHeight >= window.innerHeight * 0.8;

        if (isOverlay && isHighZ && isWide && isTall && target.innerText.trim().length === 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          target.remove();
          console.warn('[KBlock Main] Removed clickjack full-screen overlay');
          notifyBlocked('clickjack', 'overlay');
        }
      }
    },
    true,
  );
})();
