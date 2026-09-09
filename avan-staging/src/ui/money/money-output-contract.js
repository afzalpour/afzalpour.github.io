'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from './money-runtime.js';

const FINANCIAL_PAGES = new Set([
  'داشبورد', 'فاکتورها', 'اسناد حسابداری', 'گزارش‌ها', 'کالا و انبار'
]);
const MONEY_HEADING = /(بدهکار|بستانکار|مبلغ|مانده|خالص|جمع|فی|قیمت|بهای|ارزش|فروش|خرید|درآمد|هزینه|دارایی|بدهی|حقوق مالکانه|سود|زیان|مالیات|تخفیف)/;
const TRAILING_UNIT = /(?:\s*\((?:تومان|ریال)\))+\s*$/;

function cleanHeading(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().replace(TRAILING_UNIT, '').trim();
}

function annotateHeaders(root, unitLabel) {
  root?.querySelectorAll?.('table thead th').forEach(th => {
    const base = cleanHeading(th.dataset.avanMoneyHeaderBase || th.textContent);
    if (!base || !MONEY_HEADING.test(base)) {
      delete th.dataset.avanMoneyColumn;
      delete th.dataset.avanMoneyHeaderBase;
      delete th.dataset.avanMoneyUnit;
      return;
    }
    if (th.textContent !== base) th.textContent = base;
    th.dataset.avanMoneyColumn = '1';
    th.dataset.avanMoneyHeaderBase = base;
    th.dataset.avanMoneyUnit = unitLabel;
  });
}

function ensureUnitBadge(root, unitLabel, detail = false) {
  if (!root) return;
  let badge = [...root.children].find(node => node.classList?.contains('avan-output-money-unit')) || null;
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'avan-output-money-unit';
    badge.innerHTML = '<span>واحد مبالغ</span><strong></strong>';
    if (detail) {
      const head = root.querySelector('.section-head');
      if (head) head.after(badge); else root.prepend(badge);
    } else {
      const toolbar = [...root.children].find(node => node.classList?.contains('avan-export-toolbar'));
      if (toolbar) toolbar.after(badge); else root.prepend(badge);
    }
  }
  const strong = badge.querySelector('strong');
  if (strong && strong.textContent !== unitLabel) strong.textContent = unitLabel;
  badge.dataset.moneyUnit = unitLabel;
}

export function projectMoneyOutput(documentObject = document) {
  if (!MoneyRuntime?.isReady()) return false;
  const unitLabel = MoneyRuntime.unitLabel();
  const title = documentObject.getElementById('pageTitle')?.textContent?.trim() || '';
  const content = documentObject.getElementById('content');
  if (content && FINANCIAL_PAGES.has(title)) {
    ensureUnitBadge(content, unitLabel, false);
    annotateHeaders(content, unitLabel);
  }

  const backdrop = documentObject.getElementById('modalBackdrop');
  const modal = documentObject.getElementById('modal');
  if (modal && !backdrop?.hidden) {
    const heading = modal.querySelector('h2')?.textContent?.trim() || '';
    if (/^(فاکتور|سند |دریافت|پرداخت|انتقال|مانده افتتاحیه)/.test(heading)) {
      ensureUnitBadge(modal, unitLabel, true);
      annotateHeaders(modal, unitLabel);
    }
  }
  return true;
}

export function installMoneyOutputContract({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanMoneyOutput?.installed) return globalObject.AvanMoneyOutput;
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  Lifecycle.use('money:output-contract', () => projectMoneyOutput(documentObject), { priority: 850 });
  globalObject.addEventListener('avan:page-rendered', () => Lifecycle.schedule('money-output-page'));
  documentObject.addEventListener('avan:ui-changed', () => Lifecycle.schedule('money-output-ui'));
  documentObject.addEventListener('click', event => {
    if (event.target.closest?.('[data-page],[data-view-invoice],[data-view-journal],[data-action]')) {
      window.setTimeout(() => Lifecycle.schedule('money-output-click'), 0);
    }
  }, true);
  const api = Object.freeze({ installed: true, project: () => projectMoneyOutput(documentObject), annotateHeaders });
  globalObject.AvanMoneyOutput = api;
  Lifecycle.schedule('money-output-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installMoneyOutputContract();
