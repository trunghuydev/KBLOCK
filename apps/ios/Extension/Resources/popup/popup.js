// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
/**
 * KBlock — Extension Popup Script (iOS Action Sheet Optimized)
 */
import { DEFAULT_STATE, } from '../shared/types';
function el(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Element #${id} not found`);
    return element;
}
let currentState = null;
let currentDomain = null;
async function sendMessage(message) {
    try {
        return (await browser.runtime.sendMessage(message));
    }
    catch (err) {
        console.warn('[KBlock Popup] sendMessage error:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Message failed' };
    }
}
async function getCurrentDomain() {
    try {
        // Primary query
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]?.url) {
            const url = new URL(tabs[0].url);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                return url.hostname;
            }
        }
    }
    catch {
        // Ignore and try fallback
    }
    try {
        // iOS Safari fallback: query active tab across all windows
        const tabs = await browser.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                const url = new URL(tab.url);
                return url.hostname;
            }
        }
    }
    catch {
        // Ignore
    }
    return null;
}
function renderState(state, domain) {
    const toggle = el('main-toggle');
    const statusTitle = el('status-title');
    const statusSubtitle = el('status-subtitle');
    const domainValue = el('current-domain');
    const siteStatusPill = el('site-status-pill');
    const whitelistBtn = el('whitelist-btn');
    const removeWhitelistBtn = el('remove-whitelist-btn');
    const filtersActive = document.getElementById('filters-active');
    // Master Toggle
    toggle.checked = state.enabled;
    document.body.classList.toggle('extension-disabled', !state.enabled);
    if (state.enabled) {
        statusTitle.textContent = 'Đang bảo vệ';
        statusSubtitle.textContent = 'Quảng cáo & Pop-up đang bị chặn';
    }
    else {
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
        }
        else {
            siteStatusPill.textContent = state.enabled ? 'Đang lọc' : 'Tạm dừng';
            siteStatusPill.className = 'badge';
            whitelistBtn.classList.remove('hidden');
            removeWhitelistBtn.classList.add('hidden');
        }
    }
    else {
        domainValue.textContent = 'Trang web hiện tại';
        siteStatusPill.textContent = state.enabled ? 'Đang lọc' : 'Tạm dừng';
        siteStatusPill.className = 'badge';
        whitelistBtn.classList.add('hidden');
        removeWhitelistBtn.classList.add('hidden');
    }
    if (filtersActive) {
        const count = (state.filterSources && state.filterSources.length > 0)
            ? state.filterSources.filter(s => s.enabled).length
            : 3;
        filtersActive.textContent = `${count} Bộ lọc`;
    }
}
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
async function init() {
    // Always attach event listeners first so UI is immediately interactive
    try {
        el('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
        el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
        el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());
    }
    catch (err) {
        console.warn('[KBlock Popup] Listener attachment:', err);
    }
    // Load state and current domain with safe fallbacks
    let state = { ...DEFAULT_STATE };
    let domain = null;
    try {
        const [stateResponse, detectedDomain] = await Promise.all([
            sendMessage({ type: 'GET_STATE' }),
            getCurrentDomain(),
        ]);
        if (stateResponse.success && stateResponse.data) {
            state = stateResponse.data;
        }
        domain = detectedDomain;
    }
    catch (err) {
        console.warn('[KBlock Popup] State fetch fallback to default:', err);
    }
    currentState = state;
    renderState(currentState, domain);
}
void init();
