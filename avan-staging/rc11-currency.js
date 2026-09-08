'use strict';

import {
  setDisplayUnit,
  refreshAllMoneyInputs,
  isMoneyInputElement
} from './rc11-money.js';

const UNIT_TOMAN = 'toman';
const UNIT_RIAL = 'rial';
const UNIT_LABEL = Object.freeze({ toman: 'تومان', rial: 'ریال' });
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const GROUP_SEPARATOR = '٬';

const state = {
  unit: UNIT_TOMAN,
  workspaceId: null,
  rpcReady: false,
  loading: true,
  loadToken: 0
};

function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

function parseInteger(value) {
  const cleaned = latinDigits(value)
    .replace(/[٬,\s]/g, '')
    .replace(/[^0-9-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  try { return BigInt(cleaned); } catch { return null; }
}

function grouped(value) {
  let n = typeof value === 'bigint' ? value : parseInteger(value);
  if (n === null) return '';
  const sign = n < 0n ? '-' : '';
  if (n < 0n) n = -n;
  return sign + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
}

function canonicalToDisplay(value, unit = state.unit) {
  const n = typeof value === 'bigint' ? value : parseInteger(value);
  if (n === null) return null;
  return unit === UNIT_RIAL ? n * 10n : n;
}

function displayToCanonical(value, unit = state.unit) {
  const n = typeof value === 'bigint' ? value : parseInteger(value);
  if (n === null) return { ok: true, value: null };
  if (unit === UNIT_TOMAN) return { ok: true, value: n };
  if (n % 10n !== 0n) {
    return {
      ok: false,
      value: null,
      message: 'مبلغ ریالی باید مضرب ۱۰ باشد تا بدون اعشار به تومان ثبت شود.'
    };
  }
  return { ok: true, value: n / 10n };
}

function showMessage(message, kind = 'error') {
  const toast = document.getElementById('toast');
  if (!toast) {
    window.alert(message);
    return;
  }
  toast.textContent = message;
  toast.classList.toggle('currency-good', kind === 'success');
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show', 'currency-good'), 2600);
}

function convertMoneyInput(input, fromUnit, toUnit, { initialCanonical = false } = {}) {
  if (!isMoneyInputElement(input) || !input.value) return true;

  const n = parseInteger(input.value);
  if (n === null) return true;

  let next = n;
  if (initialCanonical && toUnit === UNIT_RIAL) {
    next = n * 10n;
  } else if (fromUnit === UNIT_TOMAN && toUnit === UNIT_RIAL) {
    next = n * 10n;
  } else if (fromUnit === UNIT_RIAL && toUnit === UNIT_TOMAN) {
    if (n % 10n !== 0n) return false;
    next = n / 10n;
  }

  input.value = grouped(next);
  input.dataset.currencyPreparedUnit = toUnit;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function prepareNewInputs(root = document) {
  const inputs = [];
  if (root instanceof HTMLInputElement) inputs.push(root);
  if (root.querySelectorAll) inputs.push(...root.querySelectorAll('input'));

  inputs.forEach(input => {
    if (!isMoneyInputElement(input)) return;
    if (input.dataset.currencyPreparedUnit === state.unit) return;

    const previous = input.dataset.currencyPreparedUnit;
    if (!previous) {
      convertMoneyInput(input, UNIT_TOMAN, state.unit, { initialCanonical: true });
    } else {
      convertMoneyInput(input, previous, state.unit);
    }
    input.dataset.currencyPreparedUnit = state.unit;
  });
}

function canSwitchInputs(fromUnit, toUnit) {
  if (fromUnit !== UNIT_RIAL || toUnit !== UNIT_TOMAN) return true;
  return [...document.querySelectorAll('input')]
    .filter(isMoneyInputElement)
    .every(input => {
      if (!input.value) return true;
      const n = parseInteger(input.value);
      return n === null || n % 10n === 0n;
    });
}

function convertExistingInputs(fromUnit, toUnit) {
  const inputs = [...document.querySelectorAll('input')].filter(isMoneyInputElement);
  for (const input of inputs) {
    if (!convertMoneyInput(input, fromUnit, toUnit)) return false;
  }
  return true;
}

function applyUnit(nextUnit, { persist = false, convertInputs = true } = {}) {
  if (![UNIT_TOMAN, UNIT_RIAL].includes(nextUnit)) return false;
  const previous = state.unit;

  if (previous === nextUnit) {
    state.unit = nextUnit;
    window.AVAN_MONEY_DISPLAY_UNIT = nextUnit;
    setDisplayUnit(nextUnit);
    refreshAllMoneyInputs();
    renderSettingsCard(true);
    return true;
  }

  if (convertInputs) {
    if (!canSwitchInputs(previous, nextUnit)) {
      showMessage('برای تغییر از ریال به تومان، مبالغ باز باید مضرب ۱۰ ریال باشند.');
      return false;
    }
    if (!convertExistingInputs(previous, nextUnit)) return false;
  }

  state.unit = nextUnit;
  window.AVAN_MONEY_DISPLAY_UNIT = nextUnit;
  setDisplayUnit(nextUnit);
  refreshAllMoneyInputs();
  renderSettingsCard(true);
  document.dispatchEvent(new CustomEvent('avan:money-unit-changed', {
    detail: { unit: nextUnit, previous, persist, workspaceId: state.workspaceId }
  }));
  return true;
}

function temporaryCanonicalizeForm(form) {
  if (state.unit !== UNIT_RIAL) return null;
  const inputs = [...form.querySelectorAll('input')].filter(isMoneyInputElement);
  const snapshots = [];

  for (const input of inputs) {
    if (!input.value) continue;
    const converted = displayToCanonical(input.value, state.unit);
    if (!converted.ok) return { error: converted.message };
    snapshots.push({ input, value: input.value, prepared: input.dataset.currencyPreparedUnit || '' });
    input.value = converted.value === null ? '' : converted.value.toString();
    input.dataset.currencyPreparedUnit = UNIT_TOMAN;
  }

  return {
    restore() {
      snapshots.forEach(({ input, value, prepared }) => {
        if (!input.isConnected) return;
        input.value = value;
        input.dataset.currencyPreparedUnit = prepared || UNIT_RIAL;
      });
      refreshAllMoneyInputs();
    }
  };
}

function installSubmitBoundary() {
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || state.unit !== UNIT_RIAL) return;

    const boundary = temporaryCanonicalizeForm(form);
    if (boundary?.error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMessage(boundary.error);
      return;
    }
    if (!boundary?.restore) return;
    window.setTimeout(() => boundary.restore(), 0);
  }, true);
}

function settingsHost() {
  const title = document.getElementById('pageTitle');
  if (title?.textContent?.trim() !== 'تنظیمات') return null;
  return document.getElementById('content');
}

function settingsCardHtml() {
  const disabled = state.rpcReady ? '' : 'disabled';
  const status = state.loading
    ? 'در حال خواندن تنظیم واحد پول…'
    : state.rpcReady
      ? 'این تنظیم برای شرکت فعال ذخیره می‌شود.'
      : 'تنظیم واحد پول در دسترس نیست؛ واحد فعلاً تومان است.';

  return `
    <div class="section card currency-settings-card" id="currencySettingsCard">
      <div class="section-head">
        <div>
          <h2>واحد پول</h2>
          <span class="muted">مبالغ حسابداری در هسته به تومان نگهداری می‌شوند؛ این انتخاب فقط ورود و نمایش را تغییر می‌دهد.</span>
        </div>
        <span class="badge">هسته: تومان</span>
      </div>
      <div class="currency-choice" role="group" aria-label="واحد نمایش و ورود">
        <button type="button" class="${state.unit === UNIT_TOMAN ? 'active' : ''}" data-currency-unit="toman" ${disabled}>تومان</button>
        <button type="button" class="${state.unit === UNIT_RIAL ? 'active' : ''}" data-currency-unit="rial" ${disabled}>ریال</button>
      </div>
      <p class="muted currency-status">${status}</p>
      <div class="info-box currency-note">در حالت ریال، مبلغ ورودی باید مضرب ۱۰ باشد و فقط یک‌بار در مرز ثبت به تومان تبدیل می‌شود.</div>
    </div>`;
}

function renderSettingsCard(force = false) {
  const host = settingsHost();
  if (!host) return;

  let card = document.getElementById('currencySettingsCard');
  if (card && !force) return;
  if (!card) {
    host.insertAdjacentHTML('afterbegin', settingsCardHtml());
    card = document.getElementById('currencySettingsCard');
  } else {
    card.outerHTML = settingsCardHtml();
    card = document.getElementById('currencySettingsCard');
  }

  card?.querySelectorAll('[data-currency-unit]').forEach(button => {
    button.addEventListener('click', async () => {
      const next = button.dataset.currencyUnit;
      if (next === state.unit || !state.rpcReady || !state.workspaceId) return;
      button.disabled = true;
      try {
        const saved = await window.AvanCloud.rpc('set_money_display_unit', {
          wid: state.workspaceId,
          p_unit: next
        });
        const normalized = saved === UNIT_RIAL ? UNIT_RIAL : UNIT_TOMAN;
        if (!applyUnit(normalized, { persist: true })) return;
        showMessage(`واحد پول روی ${UNIT_LABEL[normalized]} تنظیم شد.`, 'success');
      } catch (error) {
        console.error('[Avan currency] save failed', error);
        showMessage('ذخیره واحد پول انجام نشد.');
      } finally {
        renderSettingsCard(true);
      }
    });
  });
}

async function activeCompanyId() {
  const cloud = window.AvanCloud;
  const context = cloud?.companyContext;
  if (context?.active?.()?.id) return context.active().id;
  if (context?.ensure) {
    const snapshot = await context.ensure();
    return snapshot?.active_company?.id || null;
  }
  return null;
}

async function loadCloudPreference({ companyChanged = false } = {}) {
  const cloud = window.AvanCloud;
  const token = ++state.loadToken;
  state.loading = true;

  if (!cloud?.rpc || !cloud?.companyContext) {
    state.loading = false;
    state.rpcReady = false;
    renderSettingsCard(true);
    return;
  }

  try {
    const wid = await activeCompanyId();
    if (token !== state.loadToken) return;
    if (!wid) throw new Error('COMPANY_REQUIRED');

    const unit = await cloud.rpc('get_money_display_unit', { wid });
    if (token !== state.loadToken) return;

    state.workspaceId = wid;
    state.rpcReady = true;
    const normalized = unit === UNIT_RIAL ? UNIT_RIAL : UNIT_TOMAN;
    applyUnit(normalized, { convertInputs: !companyChanged });
    prepareNewInputs(document);
  } catch (error) {
    if (token !== state.loadToken) return;
    state.workspaceId = null;
    state.rpcReady = false;
    state.unit = UNIT_TOMAN;
    window.AVAN_MONEY_DISPLAY_UNIT = UNIT_TOMAN;
    setDisplayUnit(UNIT_TOMAN);
    console.warn('[Avan currency] preference unavailable', error);
  } finally {
    if (token === state.loadToken) {
      state.loading = false;
      renderSettingsCard(true);
    }
  }
}

function installObserver() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareNewInputs(node);
      });
    }
    renderSettingsCard();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function install() {
  window.AVAN_MONEY_DISPLAY_UNIT = UNIT_TOMAN;
  setDisplayUnit(UNIT_TOMAN);
  prepareNewInputs(document);
  installSubmitBoundary();
  installObserver();

  window.addEventListener('avan:company-context-changed', () => {
    loadCloudPreference({ companyChanged: true });
  });

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-page="settings"]')) renderSettingsCard(true);
  }, true);

  loadCloudPreference();

  window.AvanCurrency = Object.freeze({
    unit: () => state.unit,
    workspaceId: () => state.workspaceId,
    canonicalToDisplay,
    displayToCanonical,
    prepare: prepareNewInputs,
    reload: () => loadCloudPreference({ companyChanged: true })
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

export {
  canonicalToDisplay,
  displayToCanonical,
  applyUnit
};
