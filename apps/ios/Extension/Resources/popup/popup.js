// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { DEFAULT_STATE } from '../shared/types.js';

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
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]?.url) {
            const url = new URL(tabs[0].url);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                return url.hostname;
            }
        }
    }
    catch {
    }
    try {
        const tabs = await browser.tabs.query({ active: true });
        for (const tab of tabs) {
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                const url = new URL(tab.url);
                return url.hostname;
            }
        }
    }
    catch {
    }
    return null;
}

function calculateActiveRules(state) {
    if (!state.enabled)
        return 0;
    let count = 0;
    const cats = state.filterCategories;
    if (cats.abpvn)
        count += 8420;
    if (cats.gambling)
        count += 5120;
    if (cats.easylist)
        count += 48500;
    if (cats.annoyances)
        count += 6300;
    return count;
}

function renderState(state, domain) {
    const toggle = el('main-toggle');
    const statusTitle = el('status-title');
    const statusSubtitle = el('status-subtitle');
    const domainValue = el('current-domain');
    const siteStatusPill = el('site-status-pill');
    const whitelistBtn = el('whitelist-btn');
    const removeWhitelistBtn = el('remove-whitelist-btn');

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

    const totalBlockedEl = document.getElementById('stat-total-blocked');
    const dataSavedEl = document.getElementById('stat-data-saved');
    const popupsBlockedEl = document.getElementById('stat-popups-blocked');
    const activeRulesEl = document.getElementById('stat-active-rules');

    if (totalBlockedEl)
        totalBlockedEl.textContent = state.stats.totalBlocked.toLocaleString();
    if (dataSavedEl)
        dataSavedEl.textContent = `${state.stats.bandwidthSavedMB} MB`;
    if (popupsBlockedEl)
        popupsBlockedEl.textContent = state.stats.popupsBlocked.toLocaleString();
    if (activeRulesEl)
        activeRulesEl.textContent = calculateActiveRules(state).toLocaleString();

    const cats = state.filterCategories;
    const toggleAbpvn = document.getElementById('toggle-filter-abpvn');
    const toggleGambling = document.getElementById('toggle-filter-gambling');
    const toggleAnnoyances = document.getElementById('toggle-filter-annoyances');
    const toggleEasylist = document.getElementById('toggle-filter-easylist');

    if (toggleAbpvn)
        toggleAbpvn.checked = cats.abpvn;
    if (toggleGambling)
        toggleGambling.checked = cats.gambling;
    if (toggleAnnoyances)
        toggleAnnoyances.checked = cats.annoyances;
    if (toggleEasylist)
        toggleEasylist.checked = cats.easylist;

    const segButtons = document.querySelectorAll('.seg-btn');
    segButtons.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === state.antiPopupMode);
    });

    const descEl = document.getElementById('antipopup-desc');
    if (descEl) {
        if (state.antiPopupMode === 'strict') {
            descEl.textContent = 'Nghiêm ngặt: Khóa toàn bộ window.open và bẫy clickjacking tuyệt đối.';
        }
        else if (state.antiPopupMode === 'balanced') {
            descEl.textContent = 'Cân bằng: Tự động diệt mọi pop-up quảng cáo và chuyển hướng độc hại.';
        }
        else {
            descEl.textContent = 'Tắt: Cho phép mọi pop-up (không khuyến nghị trên web phim).';
        }
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

async function onCategoryToggle(category, enabled) {
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

async function onAntiPopupModeClick(mode) {
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
    try {
        el('main-toggle').addEventListener('change', (e) => void onToggleChange(e));
        el('whitelist-btn').addEventListener('click', () => void onAddWhitelist());
        el('remove-whitelist-btn').addEventListener('click', () => void onRemoveWhitelist());

        const setupCategoryListener = (id, category) => {
            const elCheck = document.getElementById(id);
            if (elCheck) {
                elCheck.addEventListener('change', () => void onCategoryToggle(category, elCheck.checked));
            }
        };

        setupCategoryListener('toggle-filter-abpvn', 'abpvn');
        setupCategoryListener('toggle-filter-gambling', 'gambling');
        setupCategoryListener('toggle-filter-annoyances', 'annoyances');
        setupCategoryListener('toggle-filter-easylist', 'easylist');

        const segButtons = document.querySelectorAll('.seg-btn');
        segButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (mode)
                    void onAntiPopupModeClick(mode);
            });
        });
    }
    catch (err) {
        console.warn('[KBlock Popup] Listener attachment:', err);
    }

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
