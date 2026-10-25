// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Main World Injected Script
 *
 * Runs in the page's MAIN execution context at document_start.
 * Intercepts window.open, clickjacking overlays and redirect-trap clicks.
 *
 * IMPORTANT: starts PASSIVE. The content script posts a `kblock-config`
 * message after fetching state, so whitelisted/disabled pages are never
 * touched (the hook exists but lets everything through until armed).
 */

(function () {
  // Prevent double injection
  const win = window as unknown as { __KBLOCK_MAIN_INJECTED__?: boolean };
  if (win.__KBLOCK_MAIN_INJECTED__) return;
  win.__KBLOCK_MAIN_INJECTED__ = true;

  // ─── State ────────────────────────────────────────────────────────────────
  let armed = false;
  let mode: 'balanced' | 'strict' | 'off' = 'balanced';

  const originalWindowOpen = window.open;

  /**
   * Distinctive betting-brand / popunder-network tokens. Chosen so that a
   * match in a hostname is near-certainly an ad/betting host — no bare
   * substrings like "88" or "bet" that wreck legitimate URLs.
   */
  const AD_HOST_REGEX =
    /kubet|thabet|sunwin|go88|bk8|fun88|12bet|fb88|dafabet|jun88|789bet|new88|hi88|shbet|f8bet|nohu|gamebai|taixiu|keonhacai|vsbet|okvip|i9bet|79king|mb66|win55|hello88|sonclub|bong88|sv388|qq88|popads|popcash|popmyads|propellerclick|propellerads|adsterra|monetag|clickadu|hilltopads|exoclick|juicyads|push-mania|revcontent|adservice|adsserver|zedo|adnxs|rubiconproject|pubmatic|criteo|outbrain\.com|taboola\.com/i;

  /**
   * Redirect-trap heuristic: a same-origin URL that funnels through a
   * redirector path AND carries an outbound URL parameter — the classic
   * "clickjack through /redirect?url=" pattern. Plain site paths like
   * /checkout or /about never match.
   */
  const REDIRECTOR_PATH = /^\/(redirect|redirect\.php|out|away|goto|external|aff|adclick|trackclick|r\.php)/i;
  const OUTBOUND_PARAM = /^(url|u|link|target|redirect|goto|next|continue)$/i;

  function notifyBlocked(type: 'popup' | 'redirect' | 'clickjack', url: string): void {
    try {
      window.dispatchEvent(
        new CustomEvent('kblock-action-blocked', { detail: { type, url } }),
      );
    } catch {
      // Page context may be torn down.
    }
  }

  function isAdOrMaliciousUrl(url: string): boolean {
    if (!url || url === 'about:blank') return true;

    try {
      const parsed = new URL(url, window.location.href);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;

      if (parsed.origin !== window.location.origin) {
        return AD_HOST_REGEX.test(parsed.hostname);
      }

      // Same-origin redirect trap: suspicious path + outbound URL param.
      if (REDIRECTOR_PATH.test(parsed.pathname)) {
        let hasOutboundParam = false;
        parsed.searchParams.forEach((value, key) => {
          if (OUTBOUND_PARAM.test(key) && value.length > 0) hasOutboundParam = true;
        });
        if (hasOutboundParam) return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function shouldBlockPopup(targetUrl: string): boolean {
    if (!armed) return false;

    try {
      const parsed = new URL(targetUrl, window.location.href);
      const isCrossOrigin = parsed.origin !== window.location.origin;

      if (mode === 'strict') {
        // Strict: any cross-origin popup is hostile on streaming/betting sites.
        if (isCrossOrigin) return true;
        return isAdOrMaliciousUrl(targetUrl);
      }

      return isAdOrMaliciousUrl(targetUrl);
    } catch {
      return false;
    }
  }

  // ─── 1. window.open hook ──────────────────────────────────────────────────

  try {
    const wrappedOpen = function (
      url?: string | URL,
      target?: string,
      features?: string,
    ): Window | null {
      const targetUrl = String(url || '');

      if (shouldBlockPopup(targetUrl)) {
        notifyBlocked('popup', targetUrl);
        return null;
      }

      return originalWindowOpen.call(window, targetUrl, target, features);
    };

    window.open = wrappedOpen as typeof window.open;

    try {
      Object.defineProperty(window, 'open', {
        configurable: false,
        writable: false,
        value: wrappedOpen,
      });
    } catch {
      // Freeze not allowed — the assignment above still holds.
    }
  } catch (err) {
    console.error('[KBlock Main] Failed to hook window.open:', err);
  }

  // ─── 2. Click interception (capture phase) ────────────────────────────────

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (!armed) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 2a. Ad/betting link or redirect-trap anchor
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (anchor && anchor.href) {
        let blocked = false;
        try {
          const parsed = new URL(anchor.href, window.location.href);
          if (AD_HOST_REGEX.test(parsed.hostname)) {
            blocked = true;
          } else if (
            parsed.origin === window.location.origin &&
            REDIRECTOR_PATH.test(parsed.pathname)
          ) {
            let hasOutboundParam = false;
            parsed.searchParams.forEach((_value, key) => {
              if (OUTBOUND_PARAM.test(key)) hasOutboundParam = true;
            });
            blocked = hasOutboundParam;
          }
        } catch {
          blocked = false;
        }

        if (blocked) {
          e.preventDefault();
          e.stopImmediatePropagation();
          notifyBlocked('redirect', anchor.href);
          return;
        }
      }

      // 2b. Full-screen invisible clickjacking overlay under the cursor
      if (target !== document.body && target !== document.documentElement) {
        const style = window.getComputedStyle(target);
        const isOverlay = style.position === 'fixed' || style.position === 'absolute';
        const zIndex = parseInt(style.zIndex, 10);
        const isHighZ = !isNaN(zIndex) && zIndex > 99;
        const isWide = target.offsetWidth >= window.innerWidth * 0.8;
        const isTall = target.offsetHeight >= window.innerHeight * 0.8;
        const isInteractive = /^(input|button|select|textarea|a|label)$/i.test(target.tagName);

        if (isOverlay && isHighZ && isWide && isTall && !isInteractive && target.innerText.trim().length === 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          target.remove();
          notifyBlocked('clickjack', 'overlay');
        }
      }
    },
    true,
  );

  // ─── 3. Config from the content script ────────────────────────────────────

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as { source?: string; type?: string; armed?: boolean; mode?: string } | null;
    if (!data || data.source !== 'kblock-content-script' || data.type !== 'kblock-config') return;

    armed = Boolean(data.armed);
    if (data.mode === 'balanced' || data.mode === 'strict' || data.mode === 'off') {
      mode = data.mode;
    }
  });
})();
