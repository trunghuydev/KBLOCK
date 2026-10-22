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

function calculateActiveRules(state: ExtensionState): number {
  if (!state.enabled) return 0;
  let count = 0;
  const cats = state.filterCategories;
  if (cats.abpvn) count += 8420;
  if (cats.gambling) count += 5120;
  if (cats.easylist) count += 48500;
  if (cats.annoyances) count += 6300;
  return count;
}

function renderState(state: ExtensionState, domain: string | null): void {
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
    const isWhitelisted = state.whitelist.includes(domain);

    if (isWhitelisted) {
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

  // Live Statistics Display (AdGuard Pro style)
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

  if (toggleAbpvn) toggleAbpvn.checked = cats.abpvn;
  if (toggleGambling) toggleGambling.checked = cats.gambling;
  if (toggleAnnoyances) toggleAnnoyances.checked = cats.annoyances;
  if (toggleEasylist) toggleEasylist.checked = cats.easylist;

  // Anti-Popup Mode Segmented Control
  const segButtons = document.querySelectorAll<HTMLButtonElement>('.seg-btn');
  segButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.antiPopupMode);
  });

  const descEl = document.getElementById('antipopup-desc');
  if (descEl) {
    if (state.antiPopupMode === 'strict') {
      descEl.textContent = 'Nghiêm ngặt: Khóa toàn bộ window.open và bẫy clickjacking tuyệt đối.';
    } else if (state.antiPopupMode === 'balanced') {
      descEl.textContent = 'Cân bằng: Tự động diệt mọi pop-up quảng cáo và chuyển hướng độc hại.';
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

  let state: ExtensionState = { ...DEFAULT_STATE };
  let domain: string | null = null;

  try {
    const [stateResponse, detectedDomain] = await Promise.all([
      sendMessage({ type: 'GET_STATE' }),
      getCurrentDomain(),
    ]);

    if (stateResponse.success && stateResponse.data) {
      state = stateResponse.data as ExtensionState;
    }
    domain = detectedDomain;
  } catch (err) {
    console.warn('[KBlock Popup] State fetch fallback to default:', err);
  }

  currentState = state;
  renderState(currentState, domain);
}

void init();
