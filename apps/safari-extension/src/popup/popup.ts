// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * KBlock — Extension Popup Script
 *
 * Responsibilities:
 * - Display current extension state (enabled/disabled, filter sources)
 * - Show current tab domain
 * - Allow toggling extension on/off
 * - Allow adding/removing current domain from whitelist
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
  const statusCard = el('status-card');
  const statusTitle = el('status-title');
  const statusSubtitle = el('status-subtitle');
  const statusIcon = el('status-icon');
  const domainValue = el('current-domain');
  const whitelistBtn = el('whitelist-btn');
  const removeWhitelistBtn = el('remove-whitelist-btn');
  const filterList = el('filter-list');
  const versionLabel = el('version-label');

  // Toggle state
  toggle.checked = state.enabled;
  document.body.classList.toggle('extension-disabled', !state.enabled);

  // Status
  if (state.enabled) {
    statusCard.classList.remove('status--disabled');
    statusIcon.textContent = '🛡️';
    statusTitle.textContent = 'Đang bảo vệ';
    statusSubtitle.textContent = 'Quảng cáo đang bị chặn';
  } else {
    statusCard.classList.add('status--disabled');
    statusIcon.textContent = '⏸️';
    statusTitle.textContent = 'Đã tắt';
    statusSubtitle.textContent = 'KBlock đang tạm dừng';
  }

  // Domain
  currentDomain = domain;
  if (domain) {
    domainValue.textContent = domain;

    const isWhitelisted = state.whitelist.includes(domain);
    whitelistBtn.classList.toggle('hidden', isWhitelisted);
    removeWhitelistBtn.classList.toggle('hidden', !isWhitelisted);
  } else {
    domainValue.textContent = 'Không xác định';
    whitelistBtn.classList.add('hidden');
    removeWhitelistBtn.classList.add('hidden');
  }

  // Filter list
  filterList.innerHTML = '';
  if (state.filterSources.length === 0) {
    const li = document.createElement('li');
    li.className = 'filter-item';
    li.textContent = 'Không có bộ lọc nào';
    filterList.appendChild(li);
  } else {
    state.filterSources.forEach((source: FilterSourceState) => {
      const li = document.createElement('li');
      li.className = 'filter-item';

      const name = document.createElement('span');
      name.className = 'filter-item-name';
      name.textContent = source.name;

      const badge = document.createElement('span');
      badge.className = 'filter-item-badge';

      if (!source.enabled) {
        badge.classList.add('filter-item-badge--disabled');
        badge.textContent = 'Tắt';
      } else if (source.status === 'error') {
        badge.classList.add('filter-item-badge--error');
        badge.textContent = 'Lỗi';
      } else {
        badge.classList.add('filter-item-badge--active');
        badge.textContent = 'Bật';
      }

      li.appendChild(name);
      li.appendChild(badge);
      filterList.appendChild(li);
    });
  }

  // Version
  const manifest = browser.runtime.getManifest();
  versionLabel.textContent = `v${manifest.version}`;
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
    // Load state and domain in parallel
    const [stateResponse, domain] = await Promise.all([
      sendMessage({ type: 'GET_STATE' }),
      getCurrentDomain(),
    ]);

    if (stateResponse.success && stateResponse.data) {
      currentState = stateResponse.data as ExtensionState;
      renderState(currentState, domain);
    }

    // Wire up event listeners
    el<HTMLInputElement>('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
    el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
    el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());
  } catch (err) {
    console.error('[KBlock Popup] Init failed:', err);
  }
}

void init();
