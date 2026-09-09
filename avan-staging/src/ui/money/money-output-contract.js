'use strict';

import { sumCanonicalDecimals } from '../../core/money/canonical-money.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { MoneyRuntime } from './money-runtime.js';

const FINANCIAL_PAGES = new Set([
  'داشبورد', 'فاکتورها', 'اسناد حسابداری', 'گزارش‌ها', 'کالا و انبار'
]);
const MONEY_HEADING = /(بدهکار|بستانکار|مبلغ|مانده|خالص|جمع|فی|قیمت|بهای|ارزش|فروش|خرید|درآمد|هزینه|دارایی|بدهی|حقوق مالکانه|سود|زیان|مالیات|تخفیف)/;
const TRAILING_UNIT = /(?:\s*\((?:تومان|ریال)\))+\s*$/;
const VALUE_UNIT_SUFFIX = /\s+(?:تومان|ریال)\s*$/u;

function installReportPresentationStyle(documentObject) {
  if (documentObject.getElementById('avanReportPresentationContractStyle')) return;
  const style = documentObject.createElement('style');
  style.id = 'avanReportPresentationContractStyle';
  style.textContent = `
    #content[data-avan-report-surface="1"]{direction:rtl}
    #content[data-avan-report-surface="1"] .tabs [data-report]{
      text-align:center!important;justify-content:center!important;align-items:center!important;
    }
    #content[data-avan-report-surface="1"] table thead th{
      text-align:center!important;vertical-align:middle!important;
    }
    #content[data-avan-report-surface="1"] [data-report-title],
    #content[data-avan-report-surface="1"] .report-title{
      display:block!important;width:100%!important;text-align:center!important;
    }
    #content[data-avan-report-surface="1"] td.num,
    #content[data-avan-report-surface="1"] .num{
      direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;
    }
  `;
  documentObject.head.append(style);
}

function cleanHeading(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().replace(TRAILING_UNIT, '').trim();
}

function annotateHeaders(root, unitLabel, { inlineUnit = false } = {}) {
  root?.querySelectorAll?.('table thead th').forEach(th => {
    const base = cleanHeading(th.dataset.avanMoneyHeaderBase || th.textContent);
    if (!base || !MONEY_HEADING.test(base)) {
      delete th.dataset.avanMoneyColumn;
      delete th.dataset.avanMoneyHeaderBase;
      delete th.dataset.avanMoneyUnit;
      return;
    }
    const next = inlineUnit ? `${base} (${unitLabel})` : base;
    if (th.textContent !== next) th.textContent = next;
    th.dataset.avanMoneyColumn = '1';
    th.dataset.avanMoneyHeaderBase = base;
    th.dataset.avanMoneyUnit = unitLabel;
  });
}

function centerReportHeaders(root) {
  root?.querySelectorAll?.('table thead th').forEach(th => {
    th.style.setProperty('text-align', 'center', 'important');
    th.style.setProperty('vertical-align', 'middle', 'important');
    th.dataset.avanReportHeaderAlign = 'center';
  });
}

function centerPreparedReportTitles(root) {
  if (!root) return;
  root.querySelectorAll('[data-report-title],.report-title').forEach(heading => {
    heading.style.setProperty('text-align', 'center', 'important');
    heading.style.setProperty('width', '100%', 'important');
    heading.dataset.avanReportTitleAlign = 'center';
  });
  root.querySelectorAll('.tabs [data-report]').forEach(button => {
    button.style.setProperty('text-align', 'center', 'important');
    button.style.setProperty('justify-content', 'center', 'important');
    button.dataset.avanReportTitleAlign = 'center';
  });
}

function cleanMoneyCellText(raw) {
  return String(raw ?? '').replace(VALUE_UNIT_SUFFIX, '').trim();
}

function moneyColumnIndexes(table) {
  const headers = [...(table.querySelectorAll?.('thead tr:last-child th') || [])];
  return headers.map((th, index) => th.dataset.avanMoneyColumn === '1' ? index : -1).filter(index => index >= 0);
}

function stripRepeatedUnitsFromReportTables(root) {
  root?.querySelectorAll?.('table').forEach(table => {
    const indexes = moneyColumnIndexes(table);
    if (!indexes.length) return;
    table.querySelectorAll('tbody tr, tfoot tr').forEach(row => {
      const cells = [...row.children];
      indexes.forEach(index => {
        const cell = cells[index];
        if (!cell || cell.children.length) return;
        const next = cleanMoneyCellText(cell.textContent);
        if (cell.textContent !== next) cell.textContent = next;
      });
    });
  });
}

function canonicalColumnSum(table, index) {
  const values = [];
  for (const row of table.querySelectorAll('tbody tr')) {
    const cell = row.children[index];
    if (!cell) continue;
    const displayed = cleanMoneyCellText(cell.textContent).replace(/^−/, '-');
    const parsed = MoneyRuntime.parseDecimalInput(displayed || '0');
    if (!parsed.ok) return null;
    values.push(parsed.value);
  }
  try { return sumCanonicalDecimals(values); }
  catch { return null; }
}

function repairTrialBalanceSummary(root) {
  const table = [...(root?.querySelectorAll?.('table') || [])].find(candidate => {
    const bases = [...candidate.querySelectorAll('thead th')].map(th => th.dataset.avanMoneyHeaderBase || cleanHeading(th.textContent));
    return bases.includes('گردش بدهکار') && bases.includes('گردش بستانکار');
  });
  if (!table) return;
  const headers = [...table.querySelectorAll('thead tr:last-child th')];
  const debitIndex = headers.findIndex(th => (th.dataset.avanMoneyHeaderBase || cleanHeading(th.textContent)) === 'گردش بدهکار');
  const creditIndex = headers.findIndex(th => (th.dataset.avanMoneyHeaderBase || cleanHeading(th.textContent)) === 'گردش بستانکار');
  if (debitIndex < 0 || creditIndex < 0) return;
  const debit = canonicalColumnSum(table, debitIndex);
  const credit = canonicalColumnSum(table, creditIndex);
  if (debit === null || credit === null) return;
  const summary = root.querySelector('.summary-strip');
  if (!summary) return;
  const pills = [...summary.querySelectorAll('.summary-pill')];
  const debitPill = pills.find(node => /^بدهکار\b/.test(node.textContent.trim()));
  const creditPill = pills.find(node => /^بستانکار\b/.test(node.textContent.trim()));
  const balancePill = pills.find(node => /^(?:متوازن|نامتوازن)\b/.test(node.textContent.trim()));
  if (debitPill) debitPill.textContent = `بدهکار ${MoneyRuntime.formatCanonicalDecimal(debit)}`;
  if (creditPill) creditPill.textContent = `بستانکار ${MoneyRuntime.formatCanonicalDecimal(credit)}`;
  if (balancePill) {
    const balanced = debit === credit;
    balancePill.textContent = balanced ? 'متوازن' : 'نامتوازن';
    balancePill.classList.toggle('pos', balanced);
    balancePill.classList.toggle('neg', !balanced);
  }
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
  installReportPresentationStyle(documentObject);
  const unitLabel = MoneyRuntime.unitLabel();
  const title = documentObject.getElementById('pageTitle')?.textContent?.trim() || '';
  const content = documentObject.getElementById('content');
  if (content) {
    if (title === 'گزارش‌ها') content.dataset.avanReportSurface = '1';
    else delete content.dataset.avanReportSurface;
  }
  if (content && FINANCIAL_PAGES.has(title)) {
    ensureUnitBadge(content, unitLabel, false);
    const isPreparedReports = title === 'گزارش‌ها';
    annotateHeaders(content, unitLabel, { inlineUnit: isPreparedReports });
    if (isPreparedReports) {
      repairTrialBalanceSummary(content);
      stripRepeatedUnitsFromReportTables(content);
      centerReportHeaders(content);
      centerPreparedReportTitles(content);
    }
  }

  const backdrop = documentObject.getElementById('modalBackdrop');
  const modal = documentObject.getElementById('modal');
  if (modal && !backdrop?.hidden) {
    const heading = modal.querySelector('h2')?.textContent?.trim() || '';
    if (/^(فاکتور|سند |دریافت|پرداخت|انتقال|مانده افتتاحیه|گزارش)/.test(heading)) {
      ensureUnitBadge(modal, unitLabel, true);
      annotateHeaders(modal, unitLabel, { inlineUnit: true });
      stripRepeatedUnitsFromReportTables(modal);
      centerReportHeaders(modal);
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
    if (event.target.closest?.('[data-page],[data-view-invoice],[data-view-journal],[data-action],[data-report],[data-run-custom-report]')) {
      [0, 40, 140].forEach(delay => globalObject.setTimeout(() => Lifecycle.schedule(`money-output-click-${delay}`), delay));
    }
  }, true);
  const api = Object.freeze({
    installed: true,
    project: () => projectMoneyOutput(documentObject),
    annotateHeaders,
    centerReportHeaders,
    centerPreparedReportTitles,
    stripRepeatedUnitsFromReportTables
  });
  globalObject.AvanMoneyOutput = api;
  Lifecycle.schedule('money-output-ready');
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installMoneyOutputContract();
