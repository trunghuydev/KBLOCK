// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Extension Popup Script (iOS Action Sheet Optimized)
 */

import {
  DEFAULT_STATE,
  type ExtensionState,
  type Message,
  type MessageResponse,
  type AntiPopupMode,
  type FilterCategories,
} from '../shared/types';

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

let currentState: ExtensionState | null = null;
let currentDomain: string | null = null;

async function sendMessage(message: Message): Promise<MessageResponse> {
  try {
    return (await browser.runtime.sendMessage(message)) as MessageResponse;
  } catch (err) {
    console.warn('[KBlock Popup] sendMessage error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Message failed' };
  }
}

async function getCurrentDomain(): Promise<string | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]?.url) {
      const url = new URL(tabs[0].url);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return url.hostname;
      }
    }
  } catch {
    // Ignore and try fallback
  }

  try {
    const tabs = await browser.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        const url = new URL(tab.url);
        return url.hostname;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

/** Honest count: bundled static rules + active dynamic rules. */
function calculateActiveRules(state: ExtensionState & { bundledRuleCount?: number }): number {
  if (!state.enabled) return 0;
  const bundled = state.bundledRuleCount ?? 0;
  const dynamic = state.whitelist.length + state.customRules.filter((r) => r.enabled).length;
  return bundled + dynamic;
}

function isSiteWhitelisted(state: ExtensionState, domain: string | null): boolean {
  if (!domain) return false;
  return state.whitelist.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function renderState(
  state: ExtensionState & { bundledRuleCount?: number },
  domain: string | null,
): void {
  const toggle = el<HTMLInputElement>('main-toggle');
  const statusTitle = el('status-title');
  const statusSubtitle = el('status-subtitle');
  const domainValue = el('current-domain');
  const siteStatusPill = el('site-status-pill');
  const whitelistBtn = el('whitelist-btn');
  const removeWhitelistBtn = el('remove-whitelist-btn');

  // Master Toggle
  toggle.checked = state.enabled;
  document.body.classList.toggle('extension-disabled', !state.enabled);

  if (state.enabled) {
    statusTitle.textContent = 'Đang bảo vệ';
    statusSubtitle.textContent = 'Quảng cáo & Pop-up đang bị chặn';
  } else {
    statusTitle.textContent = 'Đã tạm dừng';
    statusSubtitle.textContent = 'KBlock đang tắt, quảng cáo không bị chặn';
  }

  // Domain display
  currentDomain = domain;
  if (domain) {
    domainValue.textContent = domain;
    const whitelisted = isSiteWhitelisted(state, domain);

    if (whitelisted) {
      siteStatusPill.textContent = 'Đã tắt trên trang này';
      siteStatusPill.className = 'badge whitelisted';
      whitelistBtn.classList.add('hidden');
      removeWhitelistBtn.classList.remove('hidden');
    } else {
      siteStatusPill.textContent = state.enabled ? 'Đang lọc' : 'Tạm dừng';
      siteStatusPill.className = 'badge';
      whitelistBtn.classList.remove('hidden');
      removeWhitelistBtn.classList.add('hidden');
    }
  } else {
    domainValue.textContent = 'Trang web hiện tại';
    siteStatusPill.textContent = state.enabled ? 'Đang lọc' : 'Tạm dừng';
    siteStatusPill.className = 'badge';
    whitelistBtn.classList.add('hidden');
    removeWhitelistBtn.classList.add('hidden');
  }

  // Live Statistics Display (honest numbers only)
  const totalBlockedEl = document.getElementById('stat-total-blocked');
  const dataSavedEl = document.getElementById('stat-data-saved');
  const popupsBlockedEl = document.getElementById('stat-popups-blocked');
  const activeRulesEl = document.getElementById('stat-active-rules');

  if (totalBlockedEl) totalBlockedEl.textContent = state.stats.totalBlocked.toLocaleString();
  if (dataSavedEl) dataSavedEl.textContent = `${state.stats.bandwidthSavedMB} MB`;
  if (popupsBlockedEl) popupsBlockedEl.textContent = state.stats.popupsBlocked.toLocaleString();
  if (activeRulesEl) activeRulesEl.textContent = calculateActiveRules(state).toLocaleString();

  // Filter Categories Toggles
  const cats = state.filterCategories;
  const toggleAbpvn = document.getElementById('toggle-filter-abpvn') as HTMLInputElement | null;
  const toggleGambling = document.getElementById('toggle-filter-gambling') as HTMLInputElement | null;
  const toggleAnnoyances = document.getElementById('toggle-filter-annoyances') as HTMLInputElement | null;
  const toggleEasylist = document.getElementById('toggle-filter-easylist') as HTMLInputElement | null;
  const toggleAntiTracking = document.getElementById('toggle-anti-tracking') as HTMLInputElement | null;
  const toggleCookieBanners = document.getElementById('toggle-cookie-banners') as HTMLInputElement | null;

  if (toggleAbpvn) toggleAbpvn.checked = cats.abpvn;
  if (toggleGambling) toggleGambling.checked = cats.gambling;
  if (toggleAnnoyances) toggleAnnoyances.checked = cats.annoyances;
  if (toggleEasylist) toggleEasylist.checked = cats.easylist;
  if (toggleAntiTracking) toggleAntiTracking.checked = state.antiTracking;
  if (toggleCookieBanners) toggleCookieBanners.checked = state.cookieBanners;

  // Anti-Popup Mode Segmented Control
  const segButtons = document.querySelectorAll<HTMLButtonElement>('.seg-btn');
  segButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.antiPopupMode);
  });

  const descEl = document.getElementById('antipopup-desc');
  if (descEl) {
    if (state.antiPopupMode === 'strict') {
      descEl.textContent = 'Nghiêm ngặt: Khóa mọi pop-up chéo trang và bẫy clickjacking.';
    } else if (state.antiPopupMode === 'balanced') {
      descEl.textContent = 'Cân bằng: Diệt pop-up quảng cáo và chuyển hướng độc hại.';
    } else {
      descEl.textContent = 'Tắt: Cho phép mọi pop-up (không khuyến nghị trên web phim).';
    }
  }
}

async function onToggleChange(event: Event): Promise<void> {
  const enabled = (event.target as HTMLInputElement).checked;
  const response = await sendMessage({ type: 'SET_ENABLED', payload: enabled });

  if (response.success && currentState) {
    currentState = { ...currentState, enabled };
    renderState(currentState, currentDomain);
  }
}

async function onCategoryToggle(category: keyof FilterCategories, enabled: boolean): Promise<void> {
  const response = await sendMessage({
    type: 'SET_FILTER_CATEGORY',
    payload: { category, enabled },
  });

  if (response.success && currentState) {
    currentState = {
      ...currentState,
      filterCategories: {
        ...currentState.filterCategories,
        [category]: enabled,
      },
    };
    renderState(currentState, currentDomain);
  }
}

async function onAntiTrackingToggle(enabled: boolean): Promise<void> {
  const response = await sendMessage({ type: 'SET_ANTI_TRACKING', payload: enabled });
  if (response.success && currentState) {
    currentState = { ...currentState, antiTracking: enabled };
  }
}

async function onCookieBannersToggle(enabled: boolean): Promise<void> {
  const response = await sendMessage({ type: 'SET_COOKIE_BANNERS', payload: enabled });
  if (response.success && currentState) {
    currentState = { ...currentState, cookieBanners: enabled };
  }
}

/** Ask the active tab's content script to enter element-picker mode. */
async function onPickElement(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) return;
    await browser.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_PICKER' });
    window.close();
  } catch (err) {
    console.warn('[KBlock Popup] Element picker failed:', err);
  }
}

async function onAntiPopupModeClick(mode: AntiPopupMode): Promise<void> {
  const response = await sendMessage({
    type: 'SET_ANTIPOPUP_MODE',
    payload: mode,
  });

  if (response.success && currentState) {
    currentState = {
      ...currentState,
      antiPopupMode: mode,
    };
    renderState(currentState, currentDomain);
  }
}

async function onAddWhitelist(): Promise<void> {
  if (!currentDomain) return;

  const response = await sendMessage({
    type: 'ADD_WHITELIST_DOMAIN',
    payload: currentDomain,
  });

  if (response.success && currentState) {
    currentState = {
      ...currentState,
      whitelist: response.data as string[],
    };
    renderState(currentState, currentDomain);
  }
}

async function onRemoveWhitelist(): Promise<void> {
  if (!currentDomain) return;

  const response = await sendMessage({
    type: 'REMOVE_WHITELIST_DOMAIN',
    payload: currentDomain,
  });

  if (response.success && currentState) {
    currentState = {
      ...currentState,
      whitelist: response.data as string[],
    };
    renderState(currentState, currentDomain);
  }
}

async function init(): Promise<void> {
  try {
    el<HTMLInputElement>('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
    el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
    el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());

    // Category toggles
    const setupCategoryListener = (id: string, category: keyof FilterCategories) => {
      const elCheck = document.getElementById(id) as HTMLInputElement | null;
      if (elCheck) {
        elCheck.addEventListener('change', () => void onCategoryToggle(category, elCheck.checked));
      }
    };

    setupCategoryListener('toggle-filter-abpvn', 'abpvn');
    setupCategoryListener('toggle-filter-gambling', 'gambling');
    setupCategoryListener('toggle-filter-annoyances', 'annoyances');
    setupCategoryListener('toggle-filter-easylist', 'easylist');

    const antiTrackingCheck = document.getElementById('toggle-anti-tracking') as HTMLInputElement | null;
    antiTrackingCheck?.addEventListener('change', () => void onAntiTrackingToggle(antiTrackingCheck.checked));

    const cookieBannersCheck = document.getElementById('toggle-cookie-banners') as HTMLInputElement | null;
    cookieBannersCheck?.addEventListener('change', () => void onCookieBannersToggle(cookieBannersCheck.checked));

    el('pick-element-btn').addEventListener('click', () => void onPickElement());

    // Anti-popup segmented buttons
    const segButtons = document.querySelectorAll<HTMLButtonElement>('.seg-btn');
    segButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as AntiPopupMode;
        if (mode) void onAntiPopupModeClick(mode);
      });
    });
  } catch (err) {
    console.warn('[KBlock Popup] Listener attachment:', err);
  }

  let state: ExtensionState & { bundledRuleCount?: number } = { ...DEFAULT_STATE };
  let domain: string | null = null;

  try {
    const [stateResponse, detectedDomain] = await Promise.all([
      sendMessage({ type: 'GET_STATE' }),
      getCurrentDomain(),
    ]);

    if (stateResponse.success && stateResponse.data) {
      state = stateResponse.data as ExtensionState & { bundledRuleCount?: number };
    }
    domain = detectedDomain;
  } catch (err) {
    console.warn('[KBlock Popup] State fetch fallback to default:', err);
  }

  currentState = state;
  renderState(currentState, domain);
}

void init();
