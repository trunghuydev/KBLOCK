// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Extension Popup Script
 *
 * Responsibilities:
 * - Display current extension state (enabled/disabled, filter sources)
 * - Show current tab domain and whitelist toggle
 * - Allow master switch on/off
 */

import type {
  ExtensionState,
  FilterSourceState,
  Message,
  MessageResponse,
} from '../shared/types';

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} not found`);
  return element as T;
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentState: ExtensionState | null = null;
let currentDomain: string | null = null;

// ─── Communication ────────────────────────────────────────────────────────────

async function sendMessage(message: Message): Promise<MessageResponse> {
  return browser.runtime.sendMessage(message) as Promise<MessageResponse>;
}

async function getCurrentDomain(): Promise<string | null> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.url) return null;
    const url = new URL(tab.url);
    return url.hostname;
  } catch {
    return null;
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderState(state: ExtensionState, domain: string | null): void {
  const toggle = el<HTMLInputElement>('main-toggle');
  const statusTitle = el('status-title');
  const statusSubtitle = el('status-subtitle');
  const domainValue = el('current-domain');
  const siteStatusPill = el('site-status-pill');
  const whitelistBtn = el('whitelist-btn');
  const removeWhitelistBtn = el('remove-whitelist-btn');
  const filterList = el('filter-list');

  // Toggle state
  toggle.checked = state.enabled;
  document.body.classList.toggle('extension-disabled', !state.enabled);

  // Status
  if (state.enabled) {
    statusTitle.textContent = 'Đang kích hoạt';
    statusSubtitle.textContent = 'Đã lọc quảng cáo & chặn cửa sổ bật lên';
  } else {
    statusTitle.textContent = 'Đã tạm dừng';
    statusSubtitle.textContent = 'KBlock đang tắt, quảng cáo không bị chặn';
  }

  // Domain
  currentDomain = domain;
  if (domain) {
    domainValue.textContent = domain;
    const isWhitelisted = state.whitelist.includes(domain);

    if (isWhitelisted) {
      siteStatusPill.textContent = 'Đã tắt trên trang này';
      siteStatusPill.className = 'site-status-pill whitelisted';
      whitelistBtn.classList.add('hidden');
      removeWhitelistBtn.classList.remove('hidden');
    } else {
      siteStatusPill.textContent = state.enabled ? 'Đang chặn' : 'Tạm dừng';
      siteStatusPill.className = 'site-status-pill';
      whitelistBtn.classList.remove('hidden');
      removeWhitelistBtn.classList.add('hidden');
    }
  } else {
    domainValue.textContent = 'Không có trang web';
    siteStatusPill.textContent = '—';
    whitelistBtn.classList.add('hidden');
    removeWhitelistBtn.classList.add('hidden');
  }

  // Filter list pills
  filterList.innerHTML = '';
  if (!state.filterSources || state.filterSources.length === 0) {
    const defaultFilters = ['ABPVN (Việt Nam)', 'EasyList Global', 'Smart Anti-Popup'];
    defaultFilters.forEach((name) => {
      const li = document.createElement('li');
      li.className = 'filter-pill active';
      li.textContent = name;
      filterList.appendChild(li);
    });
  } else {
    state.filterSources.forEach((source: FilterSourceState) => {
      const li = document.createElement('li');
      li.className = `filter-pill ${source.enabled ? 'active' : ''}`;
      li.textContent = source.name;
      filterList.appendChild(li);
    });
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function onToggleChange(event: Event): Promise<void> {
  const enabled = (event.target as HTMLInputElement).checked;
  const response = await sendMessage({ type: 'SET_ENABLED', payload: enabled });

  if (response.success && currentState) {
    currentState = { ...currentState, enabled };
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

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  try {
    const [stateResponse, domain] = await Promise.all([
      sendMessage({ type: 'GET_STATE' }),
      getCurrentDomain(),
    ]);

    if (stateResponse.success && stateResponse.data) {
      currentState = stateResponse.data as ExtensionState;
      renderState(currentState, domain);
    }

    el<HTMLInputElement>('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
    el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
    el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());
  } catch (err) {
    console.error('[KBlock Popup] Init failed:', err);
  }
}

void init();
