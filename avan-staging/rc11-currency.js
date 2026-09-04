'use strict';

import {
  setDisplayUnit,
  refreshAllMoneyInputs,
  isMoneyInputElement
} from './rc11-money.js';

const UNIT_TOMAN = 'toman';
const UNIT_RIAL = 'rial';
const UNIT_LABEL = {
  toman: 'تومان',
  rial: 'ریال'
};

const state = {
  unit: UNIT_TOMAN,
  workspaceId: null,
  rpcReady: false,
  loading: true
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const GROUP_SEPARATOR = '٬';

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
  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
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
      message: 'مبلغ ریالی باید مضرب ۱۰ باشد تا بدون اعشار به تومان در Ledger ثبت شود.'
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
  window.setTimeout(() => {
    toast.classList.remove('show', 'currency-good');
  }, 2600);
}

function isLiveCalculatedNode(node) {
  const parent = node.parentElement;
  if (!parent) return false;
  return Boolean(
    parent.closest('#lineTotals') ||
    parent.closest('#invoiceTotal') ||
    parent.closest('[data-line-amount]')
  );
}

function rewriteMoneyTextNode(node, fromUnit, toUnit) {
  if (!(node instanceof Text)) return;
  if (node.parentElement?.closest('.money-in-words')) return;

  const fromLabel = UNIT_LABEL[fromUnit];
  const toLabel = UNIT_LABEL[toUnit];
  if (!node.nodeValue?.includes(fromLabel)) return;

  const liveCalculated = isLiveCalculatedNode(node);
  const pattern = new RegExp(`(-?[0-9۰-۹٠-٩][0-9۰-۹٠-٩٬,]*)\\s*${fromLabel}`, 'g');

  node.nodeValue = node.nodeValue.replace(pattern, (match, amount) => {
    const n = parseInteger(amount);
    if (n === null) return match;

    let converted = n;
    if (!liveCalculated) {
      if (fromUnit === UNIT_TOMAN && toUnit === UNIT_RIAL) converted = n * 10n;
      if (fromUnit === UNIT_RIAL && toUnit === UNIT_TOMAN) {
        if (n % 10n !== 0n) return match;
        converted = n / 10n;
      }
    }
    return `${grouped(converted)} ${toLabel}`;
  });
}

function walkText(root, fromUnit, toUnit) {
  if (!root || fromUnit === toUnit) return;
  if (root instanceof Text) {
    rewriteMoneyTextNode(root, fromUnit, toUnit);
    return;
  }
  if (!(root instanceof Element) && root !== document) return;
  if (root instanceof Element && root.closest?.('.money-in-words')) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('script,style,.money-in-words')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue?.includes(UNIT_LABEL[fromUnit])
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => rewriteMoneyTextNode(node, fromUnit, toUnit));
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
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dataset.currencyPreparedUnit = toUnit;
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

function applyUnit(nextUnit, { persist = false } = {}) {
  if (![UNIT_TOMAN, UNIT_RIAL].includes(nextUnit)) return false;
  const previous = state.unit;
  if (previous === nextUnit) {
    setDisplayUnit(nextUnit);
    refreshAllMoneyInputs();
    renderSettingsCard(true);
    return true;
  }

  if (!canSwitchInputs(previous, nextUnit)) {
    showMessage('برای تغییر از ریال به تومان، مبالغ باز باید مضرب ۱۰ ریال باشند.');
    return false;
  }

  if (!convertExistingInputs(previous, nextUnit)) return false;
  walkText(document.body, previous, nextUnit);
  state.unit = nextUnit;
  window.AVAN_MONEY_DISPLAY_UNIT = nextUnit;
  setDisplayUnit(nextUnit);
  refreshAllMoneyInputs();
  renderSettingsCard(true);
  document.dispatchEvent(new CustomEvent('avan:money-unit-changed', {
    detail: { unit: nextUnit, previous, persist }
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
    snapshots.push({ input, value: input.value });
    input.value = converted.value === null ? '' : converted.value.toString();
  }

  return {
    restore() {
      snapshots.forEach(({ input, value }) => {
        if (input.isConnected) input.value = value;
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
    ? 'در حال خواندن تنظیم واحد از Cloud…'
    : state.rpcReady
      ? 'این تنظیم در Workspace ذخیره می‌شود.'
      : 'Patch دیتابیس RC1.1-B هنوز نصب نشده است؛ واحد فعلاً تومان باقی می‌ماند.';

  return `
    <div class="section card currency-settings-card" id="currencySettingsCard">
      <div class="section-head">
        <div>
          <h2>واحد پول</h2>
          <span class="muted">واحد ذخیره Ledger ثابت و تومان است؛ این انتخاب فقط مرز ورود و نمایش را تبدیل می‌کند.</span>
        </div>
        <span class="badge">Ledger: تومان</span>
      </div>
      <div class="currency-choice" role="group" aria-label="واحد نمایش و ورود">
        <button type="button" class="${state.unit === UNIT_TOMAN ? 'active' : ''}" data-currency-unit="toman" ${disabled}>تومان</button>
        <button type="button" class="${state.unit === UNIT_RIAL ? 'active' : ''}" data-currency-unit="rial" ${disabled}>ریال</button>
      </div>
      <p class="muted currency-status">${status}</p>
      <div class="info-box currency-note">
        در حالت ریال، مبلغ ورودی باید مضرب ۱۰ ریال باشد؛ آوان آن را پیش از ثبت به تومان تبدیل می‌کند و گزارش‌ها را برای نمایش دوباره ×۱۰ می‌کند. هیچ سند قبلی تغییر داده نمی‌شود.
      </div>
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
        const normalized = typeof saved === 'string' ? saved : next;
        if (!applyUnit(normalized, { persist: true })) return;
        showMessage(`واحد پول روی ${UNIT_LABEL[normalized]} تنظیم شد.`, 'success');
      } catch (error) {
        console.error('[RC1.1 currency] save failed', error);
        showMessage('ذخیره واحد پول انجام نشد.');
      } finally {
        renderSettingsCard(true);
      }
    });
  });
}

async function loadCloudPreference() {
  const cloud = window.AvanCloud;
  if (!cloud?.select || !cloud?.rpc) {
    state.loading = false;
    renderSettingsCard(true);
    return;
  }

  try {
    const workspaces = await cloud.select(
      'workspaces',
      'select=id&order=created_at.asc&limit=1'
    );
    state.workspaceId = workspaces?.[0]?.id || null;
    if (!state.workspaceId) throw new Error('WORKSPACE_NOT_FOUND');

    const unit = await cloud.rpc('get_money_display_unit', { wid: state.workspaceId });
    state.rpcReady = true;
    const normalized = unit === UNIT_RIAL ? UNIT_RIAL : UNIT_TOMAN;
    applyUnit(normalized);
  } catch (error) {
    state.rpcReady = false;
    state.unit = UNIT_TOMAN;
    window.AVAN_MONEY_DISPLAY_UNIT = UNIT_TOMAN;
    setDisplayUnit(UNIT_TOMAN);
    console.warn('[RC1.1 currency] database patch unavailable', error);
  } finally {
    state.loading = false;
    renderSettingsCard(true);
  }
}

function installObserver() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return;
        if (node.nodeType === Node.ELEMENT_NODE) prepareNewInputs(node);
        if (state.unit === UNIT_RIAL) walkText(node, UNIT_TOMAN, UNIT_RIAL);
      });
    }
    renderSettingsCard();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function install() {
  window.AVAN_MONEY_DISPLAY_UNIT = UNIT_TOMAN;

  document.addEventListener('click', event => {
    const settingsButton = event.target.closest?.('[data-page="settings"]');
    if (!settingsButton || state.workspaceId || state.loading) return;
    window.setTimeout(() => loadCloudPreference(), 120);
  });
  setDisplayUnit(UNIT_TOMAN);
  prepareNewInputs(document);
  installSubmitBoundary();
  installObserver();
  loadCloudPreference();
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
