'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { latinDigits } from '../../core/money/canonical-money.js';

function normalizedDecimal(value) {
  const raw = latinDigits(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return null;
  return raw;
}

export function groupSettlementAmount(value) {
  const raw = normalizedDecimal(value);
  if (raw === null || raw === '' || raw === '-') return String(value ?? '');
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const hasDot = unsigned.includes('.');
  const [wholeRaw = '', fraction = ''] = unsigned.split('.');
  const whole = (wholeRaw || '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${negative ? '-' : ''}${grouped}${hasDot ? `٫${fraction}` : ''}`;
}

function wordsHost(input) {
  const field = input?.closest?.('.field') || input?.parentElement;
  if (!field) return null;
  let host = field.querySelector(':scope > [data-avan-settlement-words]');
  if (!host) {
    host = document.createElement('small');
    host.dataset.avanSettlementWords = '1';
    host.className = 'money-in-words avan-settlement-amount-words';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'true');
    input.insertAdjacentElement('afterend', host);
  }
  return host;
}

export function presentSettlementAmount(input, { preserveCaret = false } = {}) {
  if (!input || !MoneyRuntime?.isReady()) return false;
  const before = String(input.value || '');
  const selection = preserveCaret && typeof input.selectionStart === 'number' ? input.selectionStart : null;
  const digitsBefore = selection === null
    ? null
    : before.slice(0, selection).replace(/[^0-9۰-۹٠-٩]/g, '').length;
  const next = groupSettlementAmount(before);
  if (next !== before) input.value = next;

  if (digitsBefore !== null && document.activeElement === input) {
    let seen = 0;
    let caret = 0;
    for (; caret < next.length; caret += 1) {
      if (/\d/.test(next[caret])) seen += 1;
      if (seen >= digitsBefore) { caret += 1; break; }
    }
    try { input.setSelectionRange(caret, caret); } catch {}
  }

  const host = wordsHost(input);
  if (!host) return true;
  const words = before.trim() ? MoneyRuntime.inputWords(input.value) : '';
  const text = words ? `به حروف: ${words}` : '';
  if (host.textContent !== text) host.textContent = text;
  host.hidden = !text;
  return true;
}

export function presentSettlementAmounts(documentObject = document) {
  const box = documentObject.querySelector?.('#invoiceForm [data-avan-settlement-v2]');
  if (!box || !MoneyRuntime?.isReady()) return false;
  box.querySelectorAll('[name="v2_amount_display"],[data-v60-fixed-amount]').forEach(input => {
    presentSettlementAmount(input);
  });
  return true;
}

export function installSettlementMoneyPresentation({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanSettlementMoneyPresentation?.installed) return globalObject.AvanSettlementMoneyPresentation;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('settlement:money-presentation', () => presentSettlementAmounts(documentObject), { priority: 47 });

  documentObject.addEventListener('input', event => {
    if (!event.target?.matches?.('#invoiceForm [name="v2_amount_display"]')) return;
    presentSettlementAmount(event.target, { preserveCaret: true });
  });
  documentObject.addEventListener('change', event => {
    if (event.target?.matches?.('#invoiceForm [name="v2_amount_display"]')) {
      presentSettlementAmount(event.target);
      return;
    }
    if (event.target?.matches?.('#invoiceForm [name="v60_plan_type"]')) {
      queueMicrotask(() => presentSettlementAmounts(documentObject));
    }
  });
  documentObject.addEventListener('click', event => {
    if (event.target?.closest?.('[data-v2-add-plan],[data-v2-split3]')) {
      queueMicrotask(() => presentSettlementAmounts(documentObject));
    }
  });
  documentObject.addEventListener('avan:invoice-money-changed', () => queueMicrotask(() => presentSettlementAmounts(documentObject)));
  documentObject.addEventListener('avan:money-unit-changed', () => queueMicrotask(() => presentSettlementAmounts(documentObject)));
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('settlement-money-page'));

  const api = Object.freeze({ installed: true, present: () => presentSettlementAmounts(documentObject) });
  globalObject.AvanSettlementMoneyPresentation = api;
  Lifecycle.schedule('settlement-money-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installSettlementMoneyPresentation();
}
