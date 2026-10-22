// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// ─── DOM Helpers ──────────────────────────────────────────────────────────────
function el(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Element #${id} not found`);
    return element;
}
// ─── State ────────────────────────────────────────────────────────────────────
let currentState = null;
let currentDomain = null;
// ─── Communication ────────────────────────────────────────────────────────────
async function sendMessage(message) {
    return browser.runtime.sendMessage(message);
}
async function getCurrentDomain() {
    try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab?.url)
            return null;
        const url = new URL(tab.url);
        return url.hostname;
    }
    catch {
        return null;
    }
}
// ─── Rendering ────────────────────────────────────────────────────────────────
function renderState(state, domain) {
    const toggle = el('main-toggle');
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
    }
    else {
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
        }
        else {
            siteStatusPill.textContent = state.enabled ? 'Đang chặn' : 'Tạm dừng';
            siteStatusPill.className = 'site-status-pill';
            whitelistBtn.classList.remove('hidden');
            removeWhitelistBtn.classList.add('hidden');
        }
    }
    else {
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
    }
    else {
        state.filterSources.forEach((source) => {
            const li = document.createElement('li');
            li.className = `filter-pill ${source.enabled ? 'active' : ''}`;
            li.textContent = source.name;
            filterList.appendChild(li);
        });
    }
}
// ─── Event Handlers ───────────────────────────────────────────────────────────
async function onToggleChange(event) {
    const enabled = event.target.checked;
    const response = await sendMessage({ type: 'SET_ENABLED', payload: enabled });
    if (response.success && currentState) {
        currentState = { ...currentState, enabled };
        renderState(currentState, currentDomain);
    }
}
async function onAddWhitelist() {
    if (!currentDomain)
        return;
    const response = await sendMessage({
        type: 'ADD_WHITELIST_DOMAIN',
        payload: currentDomain,
    });
    if (response.success && currentState) {
        currentState = {
            ...currentState,
            whitelist: response.data,
        };
        renderState(currentState, currentDomain);
    }
}
async function onRemoveWhitelist() {
    if (!currentDomain)
        return;
    const response = await sendMessage({
        type: 'REMOVE_WHITELIST_DOMAIN',
        payload: currentDomain,
    });
    if (response.success && currentState) {
        currentState = {
            ...currentState,
            whitelist: response.data,
        };
        renderState(currentState, currentDomain);
    }
}
// ─── Entry Point ──────────────────────────────────────────────────────────────
async function init() {
    try {
        const [stateResponse, domain] = await Promise.all([
            sendMessage({ type: 'GET_STATE' }),
            getCurrentDomain(),
        ]);
        if (stateResponse.success && stateResponse.data) {
            currentState = stateResponse.data;
            renderState(currentState, domain);
        }
        el('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
        el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
        el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());
    }
    catch (err) {
        console.error('[KBlock Popup] Init failed:', err);
    }
}
void init();
export {};
