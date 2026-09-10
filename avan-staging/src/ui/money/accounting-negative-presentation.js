'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const DIGITS = '0-9۰-۹٠-٩';
const NUMBER_SOURCE = `[${DIGITS}]+(?:[٬,][${DIGITS}]{3})*(?:[٫.][${DIGITS}]+)?`;
const FULL_NEGATIVE = new RegExp(`^\\s*[−-]\\s*${NUMBER_SOURCE}(?:\\s*(?:تومان|ریال|٪|%))?\\s*$`, 'u');
const TRAILING_NEGATIVE = new RegExp(`[−-]\\s*${NUMBER_SOURCE}(?:\\s*(?:تومان|ریال|٪|%))?\\s*$`, 'u');
const NEGATIVE_TOKEN = new RegExp(`(^|[^${DIGITS}])([−-])\\s*(${NUMBER_SOURCE})(?=$|[^${DIGITS}])`, 'gu');

const FULL_VALUE_SELECTOR = [
  'td',
  '.num',
  '.kpi-value',
  '.summary-value',
  '.metric-value',
  '[data-avan-report-number-cell="1"]',
  '[data-avan-number-output="1"]'
].join(',');

const MIXED_VALUE_SELECTOR = [
  '.summary-pill',
  '.line-total > *',
  '[data-avan-negative-mixed-output="1"]'
].join(',');

function installStyle(documentObject) {
  if (documentObject.getElementById('avanAccountingNegativeStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanAccountingNegativeStyle';
  style.textContent = `
    .avan-accounting-negative{
      color:var(--bad,#b23b3b)!important;
      font-weight:700!important;
      white-space:nowrap;
      unicode-bidi:isolate;
    }
    .avan-accounting-negative::before{content:'('}
    .avan-accounting-negative::after{content:')'}
    .avan-accounting-negative-sign{
      display:inline-block!important;
      width:0!important;
      max-width:0!important;
      overflow:hidden!important;
      font-size:0!important;
      line-height:0!important;
      color:transparent!important;
      user-select:none;
    }
  `;
  documentObject.head.append(style);
}

function candidateMode(element) {
  const text = String(element?.textContent || '').trim();
  if (!text || element.closest?.('.avan-accounting-negative')) return null;
  if (element.matches?.(FULL_VALUE_SELECTOR) && FULL_NEGATIVE.test(text)) return 'full';
  if (element.matches?.(MIXED_VALUE_SELECTOR) && TRAILING_NEGATIVE.test(text)) return 'mixed';
  return null;
}

function wrapNegativeTokens(element, documentObject) {
  const walker = documentObject.createTreeWalker(
    element,
    (documentObject.defaultView?.NodeFilter || NodeFilter).SHOW_TEXT
  );
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    if (!node.nodeValue || node.parentElement?.closest?.('.avan-accounting-negative')) return;
    const raw = node.nodeValue;
    NEGATIVE_TOKEN.lastIndex = 0;
    if (!NEGATIVE_TOKEN.test(raw)) return;
    NEGATIVE_TOKEN.lastIndex = 0;

    const fragment = documentObject.createDocumentFragment();
    let cursor = 0;
    let match;
    while ((match = NEGATIVE_TOKEN.exec(raw))) {
      const [whole, prefix, sign, amount] = match;
      const signIndex = match.index + prefix.length;
      fragment.append(documentObject.createTextNode(raw.slice(cursor, signIndex)));

      const wrapper = documentObject.createElement('span');
      wrapper.className = 'avan-accounting-negative';
      wrapper.dataset.avanNegativePresentation = '1';
      wrapper.setAttribute('aria-label', `منفی ${amount}`);

      const signNode = documentObject.createElement('span');
      signNode.className = 'avan-accounting-negative-sign';
      signNode.textContent = sign;
      signNode.setAttribute('aria-hidden', 'true');

      const amountNode = documentObject.createElement('span');
      amountNode.className = 'avan-accounting-negative-absolute';
      amountNode.textContent = amount;
      amountNode.setAttribute('aria-hidden', 'true');

      wrapper.append(signNode, amountNode);
      fragment.append(wrapper);
      cursor = match.index + whole.length;
    }
    fragment.append(documentObject.createTextNode(raw.slice(cursor)));
    node.replaceWith(fragment);
  });
}

export function projectAccountingNegativeNumbers(documentObject = document) {
  installStyle(documentObject);
  const roots = [
    documentObject.getElementById('content'),
    documentObject.getElementById('modal')
  ].filter(Boolean);

  roots.forEach(root => {
    const candidates = new Set(root.querySelectorAll(`${FULL_VALUE_SELECTOR},${MIXED_VALUE_SELECTOR}`));
    if (root.matches?.(`${FULL_VALUE_SELECTOR},${MIXED_VALUE_SELECTOR}`)) candidates.add(root);
    candidates.forEach(element => {
      if (!candidateMode(element)) return;
      wrapNegativeTokens(element, documentObject);
    });
  });
  return true;
}

export function installAccountingNegativePresentation({
  globalObject = window,
  documentObject = document
} = {}) {
  if (globalObject.AvanAccountingNegative?.installed) return globalObject.AvanAccountingNegative;
  const lifecycle = installUiLifecycle({ globalObject, documentObject });
  lifecycle.use(
    'numbers:accounting-negative-presentation',
    () => projectAccountingNegativeNumbers(documentObject),
    { priority: 900 }
  );
  const api = Object.freeze({
    installed: true,
    project: () => projectAccountingNegativeNumbers(documentObject)
  });
  globalObject.AvanAccountingNegative = api;
  lifecycle.schedule('accounting-negative-ready', 'register');
  return api;
}

if (HAS_BROWSER) installAccountingNegativePresentation();
