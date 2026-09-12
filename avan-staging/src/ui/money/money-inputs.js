'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from './money-runtime.js';
import { latinDigits, integerFromText, groupInteger } from '../../core/money/canonical-money.js';

const INTEGER_NAMES = new Set([
  'amount', 'debit', 'credit', 'unit_price', 'discount',
  'opening_balance', 'total_amount', 'v2_amount_display'
]);
const DECIMAL_NAMES = new Set(['cost', 'unit_cost']);
const INVOICE_DECIMAL_NAMES = new Set(['unit_price', 'discount']);
const DIGITAL_TWIN_GROUPED_NAMES = new Set([
  'revenue', 'collections', 'operatingCosts', 'payments',
  'revenueChange', 'collectionChange', 'operatingCostChange', 'paymentChange',
  'oneOffCashImpact'
]);

function moneyMode(input) {
  if (!(input instanceof HTMLInputElement)) return null;
  if (input.dataset.moneyInput === 'false' || input.dataset.money === 'false') return null;
  if (input.dataset.moneyDecimalInput === 'true') return 'decimal';
  if (input.closest?.('[data-digital-twin-form]') && DIGITAL_TWIN_GROUPED_NAMES.has(input.name || '')) return 'signed-decimal';
  if (input.closest?.('#invoiceForm') && INVOICE_DECIMAL_NAMES.has(input.name || '')) return 'decimal';
  if (input.dataset.moneyInput === 'true' || input.dataset.money === 'true') return 'integer';
  if (DECIMAL_NAMES.has(input.name || '')) return 'decimal';
  if (INTEGER_NAMES.has(input.name || '')) return 'integer';
  return null;
}

function caretForDigits(value, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) seen += 1;
    if (seen === count) return index + 1;
  }
  return value.length;
}

function digitsBefore(value) {
  return String(value || '').replace(/[^0-9۰-۹٠-٩]/g, '').length;
}

function wordsHost(input) {
  const field = input.closest('.field') || input.parentElement;
  if (!field) return null;
  let node = field.querySelector(':scope > .money-in-words');
  if (!node) {
    node = document.createElement('div');
    node.className = 'money-in-words';
    node.setAttribute('aria-live', 'polite');
    node.setAttribute('aria-atomic', 'true');
    input.insertAdjacentElement('afterend', node);
  }
  return node;
}

function refreshWords(input, mode) {
  const node = wordsHost(input);
  if (!node) return;
  const next = mode === 'integer' && input.value && MoneyRuntime?.isReady()
    ? MoneyRuntime.inputWords(input.value)
    : '';
  if (node.textContent !== next) node.textContent = next;
  node.hidden = !next;
}

function decimalInputText(value) {
  const normalized = latinDigits(value)
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  const dot = normalized.indexOf('.');
  const rawWhole = (dot >= 0 ? normalized.slice(0, dot) : normalized).replace(/\D/g, '');
  const rawFraction = dot >= 0
    ? normalized.slice(dot + 1).replace(/\D/g, '').slice(0, 6)
    : '';
  const hasDecimal = dot >= 0;
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || (hasDecimal ? '0' : '');
  const grouped = whole ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') : '';
  return hasDecimal ? `${grouped}٫${rawFraction}` : grouped;
}

function signedDecimalInputText(value) {
  const normalized = latinDigits(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  const negative = normalized.startsWith('-');
  const unsigned = normalized.replace(/-/g, '');
  const dot = unsigned.indexOf('.');
  const rawWhole = (dot >= 0 ? unsigned.slice(0, dot) : unsigned).replace(/\D/g, '');
  const rawFraction = dot >= 0
    ? unsigned.slice(dot + 1).replace(/\D/g, '').slice(0, 6)
    : '';
  const hasDecimal = dot >= 0;
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || (hasDecimal ? '0' : '');
  const grouped = whole ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') : '';
  const sign = negative ? '-' : '';
  return hasDecimal ? `${sign}${grouped}٫${rawFraction}` : `${sign}${grouped}`;
}

function format(input, preserveCaret = false) {
  const mode = moneyMode(input);
  if (!mode) return;
  if (!input.value) {
    refreshWords(input, mode);
    return;
  }

  const old = input.value;
  const caret = preserveCaret && typeof input.selectionStart === 'number' ? input.selectionStart : null;
  const count = caret === null ? null : digitsBefore(old.slice(0, caret));
  let next = old;

  if (mode === 'signed-decimal') {
    next = signedDecimalInputText(old);
  } else if (mode === 'decimal') {
    next = decimalInputText(old);
  } else {
    const amount = integerFromText(old);
    if (amount !== null) next = groupInteger(amount);
  }

  if (input.value !== next) input.value = next;
  if (count !== null && document.activeElement === input) {
    const nextCaret = caretForDigits(next, count);
    try { input.setSelectionRange(nextCaret, nextCaret); } catch {}
  }
  refreshWords(input, mode);
}

function enhance(input) {
  const mode = moneyMode(input);
  if (!mode || input.dataset.avanMoneyInputBound === '1') return;
  input.dataset.avanMoneyInputBound = '1';
  input.dataset.avanMoneyInputMode = mode;
  input.classList.add('money-input-enhanced');
  input.inputMode = mode === 'integer' ? 'numeric' : 'decimal';
  input.autocomplete = 'off';
  input.addEventListener('input', () => format(input, true));
  input.addEventListener('change', () => format(input, false));
  input.addEventListener('blur', () => format(input, false));
  format(input, false);
}

export function enhanceMoneyInputs(root = document) {
  if (root instanceof HTMLInputElement) enhance(root);
  root?.querySelectorAll?.('input').forEach(enhance);
}

function refreshWordsForAll() {
  document.querySelectorAll('input[data-avan-money-input-bound="1"]').forEach(input => {
    refreshWords(input, input.dataset.avanMoneyInputMode || moneyMode(input));
  });
}

export function installMoneyInputs({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanMoneyInputs?.installed) return globalObject.AvanMoneyInputs;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('money:input-enhancer', () => enhanceMoneyInputs(documentObject), { priority: 25 });
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('money-input-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('money-input-ui'));
  const api = Object.freeze({
    installed: true,
    enhance: enhanceMoneyInputs,
    refreshWords: refreshWordsForAll,
    modeFor: moneyMode
  });
  globalObject.AvanMoneyInputs = api;
  Lifecycle.schedule('money-input-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installMoneyInputs();
