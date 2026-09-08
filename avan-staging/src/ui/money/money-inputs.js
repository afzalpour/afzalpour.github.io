'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from './money-runtime.js';
import { integerFromText, groupInteger } from '../../core/money/canonical-money.js';

const DEFAULT_NAMES = new Set([
  'amount', 'debit', 'credit', 'unit_price', 'discount',
  'opening_balance', 'total_amount', 'v2_amount_display',
  'cost', 'unit_cost'
]);

function isMoneyInput(input) {
  if (!(input instanceof HTMLInputElement)) return false;
  if (input.dataset.moneyInput === 'false' || input.dataset.money === 'false') return false;
  if (input.dataset.moneyInput === 'true' || input.dataset.money === 'true') return true;
  return DEFAULT_NAMES.has(input.name || '');
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

function refreshWords(input) {
  const node = wordsHost(input);
  if (!node) return;
  const next = input.value && MoneyRuntime?.isReady() ? MoneyRuntime.inputWords(input.value) : '';
  if (node.textContent !== next) node.textContent = next;
  node.hidden = !next;
}

function format(input, preserveCaret = false) {
  if (!input.value) {
    refreshWords(input);
    return;
  }
  const old = input.value;
  const caret = preserveCaret && typeof input.selectionStart === 'number' ? input.selectionStart : null;
  const count = caret === null ? null : digitsBefore(old.slice(0, caret));
  const amount = integerFromText(old);
  if (amount !== null) {
    const next = groupInteger(amount);
    if (input.value !== next) input.value = next;
    if (count !== null && document.activeElement === input) {
      const nextCaret = caretForDigits(next, count);
      try { input.setSelectionRange(nextCaret, nextCaret); } catch {}
    }
  }
  refreshWords(input);
}

function enhance(input) {
  if (!isMoneyInput(input) || input.dataset.avanMoneyInputBound === '1') return;
  input.dataset.avanMoneyInputBound = '1';
  input.classList.add('money-input-enhanced');
  if (!input.inputMode) input.inputMode = 'numeric';
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
  document.querySelectorAll('input[data-avan-money-input-bound="1"]').forEach(refreshWords);
}

export function installMoneyInputs({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanMoneyInputs?.installed) return globalObject.AvanMoneyInputs;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('money:input-enhancer', () => enhanceMoneyInputs(documentObject), { priority: 25 });
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('money-input-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('money-input-ui'));
  const api = Object.freeze({ installed: true, enhance: enhanceMoneyInputs, refreshWords: refreshWordsForAll });
  globalObject.AvanMoneyInputs = api;
  Lifecycle.schedule('money-input-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installMoneyInputs();
