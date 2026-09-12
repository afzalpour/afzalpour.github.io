'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import {
  reportMoneyCategoryTenths,
  reportMoneyDecimal,
  sumReportMoneyTenths
} from '../../reports/report-money-exact.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
let installed = false;
let scheduled = 0;
let generation = 0;
let inflight = null;

function reportsRoot() {
  const title = String(document.getElementById('pageTitle')?.textContent || '').trim();
  return title === 'گزارش‌ها' ? document.getElementById('content') : null;
}

function activeTab(root) {
  return root?.querySelector('.tabs [data-report].active')?.dataset?.report || '';
}

function reportRange() {
  return {
    from: document.getElementById('reportFrom')?.value || null,
    to: document.getElementById('reportTo')?.value || null
  };
}

function findKpi(root, label) {
  return [...(root?.querySelectorAll?.('.card') || [])]
    .find(card => String(card.querySelector('.kpi-label')?.textContent || '').trim() === label)
    ?.querySelector('.kpi-value') || null;
}

function projectKpi(root, label, tenths, { signed = false } = {}) {
  const node = findKpi(root, label);
  if (!node) return false;
  const canonical = reportMoneyDecimal(tenths, label);
  const formatted = MoneyRuntime.formatCanonicalDecimal(canonical);
  if (node.textContent.trim() !== formatted) node.textContent = formatted;
  node.dataset.avanExactReportMoney = '2';
  node.dataset.avanCanonicalAmount = canonical;
  if (signed) {
    node.classList.toggle('neg', tenths < 0n);
    node.classList.toggle('pos', tenths >= 0n);
  }
  return true;
}

async function scope() {
  const cloud = installAvanCloud();
  const company = await cloud.companyContext.ensure();
  if (company?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspaceId = company?.active_company?.id;
  if (!workspaceId) throw new Error('COMPANY_REQUIRED');
  return { cloud, workspaceId };
}

async function exactPrepared(root, tab, range, cloud, workspaceId) {
  if (tab === 'pnl') {
    if (!range.from || !range.to) return false;
    const rows = await cloud.rpc('report_profit_loss', {
      wid: workspaceId,
      dfrom: range.from,
      dto: range.to
    });
    const values = reportMoneyCategoryTenths(rows || []);
    const income = values.income || 0n;
    const expense = values.expense || 0n;
    const profit = income - expense;
    projectKpi(root, 'درآمد', income);
    projectKpi(root, 'هزینه', expense);
    projectKpi(root, 'سود/زیان', profit, { signed: true });
    root.dataset.avanExactReportSignature = `v2:pnl:${workspaceId}:${range.from}:${range.to}`;
    return true;
  }

  if (tab === 'balance') {
    if (!range.to) return false;
    const rows = await cloud.rpc('report_balance_sheet', {
      wid: workspaceId,
      as_of: range.to
    });
    const values = reportMoneyCategoryTenths(rows || []);
    const assets = values.asset || 0n;
    const liabilities = values.liability || 0n;
    const equity = (values.equity || 0n) + (values.current_profit || 0n);
    const diff = assets - (liabilities + equity);
    projectKpi(root, 'دارایی', assets);
    projectKpi(root, 'بدهی', liabilities, { signed: true });
    projectKpi(root, 'حقوق مالکانه + سود جاری', equity, { signed: true });
    projectKpi(root, 'اختلاف تراز', diff, { signed: true });
    root.dataset.avanExactReportSignature = `v2:balance:${workspaceId}:${range.to}`;
    return true;
  }

  return false;
}

function naturalReportButton(root) {
  return root?.querySelector('[data-nl-why-number]') || null;
}

function naturalMetricValue(rows, metric) {
  if (metric === 'cash') {
    return sumReportMoneyTenths((rows || []).map(row => row.amount), 'natural:cash');
  }
  const values = reportMoneyCategoryTenths(rows || []);
  if (metric === 'income') return values.income || 0n;
  if (metric === 'expense') return values.expense || 0n;
  if (metric === 'profit') return (values.income || 0n) - (values.expense || 0n);
  if (metric === 'assets') return values.asset || 0n;
  if (metric === 'liabilities') return values.liability || 0n;
  return null;
}

async function exactNatural(root, cloud, workspaceId) {
  const button = naturalReportButton(root);
  if (!button) return false;
  const metric = String(button.dataset.nlWhyNumber || '').trim();
  const from = String(button.dataset.nlWhyFrom || '').trim();
  const to = String(button.dataset.nlWhyTo || '').trim();
  if (!metric || !to) return false;

  let rows = [];
  if (metric === 'income' || metric === 'expense' || metric === 'profit') {
    if (!from) return false;
    rows = await cloud.rpc('report_profit_loss', {
      wid: workspaceId,
      dfrom: from,
      dto: to
    });
  } else if (metric === 'assets' || metric === 'liabilities') {
    rows = await cloud.rpc('report_balance_sheet', {
      wid: workspaceId,
      as_of: to
    });
  } else if (metric === 'cash') {
    rows = await cloud.rpc('report_cash_bank_balances', {
      wid: workspaceId,
      as_of: to
    });
  } else {
    return false;
  }

  const tenths = naturalMetricValue(rows || [], metric);
  if (tenths === null) return false;
  const canonical = reportMoneyDecimal(tenths, `natural:${metric}`);
  const card = button.closest('.card.section');
  const valueNode = card?.querySelector('.kpi-value');
  if (!valueNode) return false;
  const formatted = MoneyRuntime.formatCanonicalDecimal(canonical);
  if (valueNode.textContent.trim() !== formatted) valueNode.textContent = formatted;
  valueNode.dataset.avanExactReportMoney = '2';
  valueNode.dataset.avanCanonicalAmount = canonical;
  button.dataset.nlWhyAmount = canonical;
  card.dataset.avanNaturalReportExact = '1';
  return true;
}

export async function repairExactReportsLiveV2() {
  const root = reportsRoot();
  if (!root) return false;
  await MoneyRuntime.ready();
  const tab = activeTab(root);
  const range = reportRange();
  const ownGeneration = generation;
  const signature = [
    ownGeneration,
    tab,
    range.from || '',
    range.to || '',
    naturalReportButton(root)?.dataset?.nlWhyNumber || '',
    naturalReportButton(root)?.dataset?.nlWhyFrom || '',
    naturalReportButton(root)?.dataset?.nlWhyTo || ''
  ].join('|');

  if (inflight?.signature === signature) return inflight.promise;
  const promise = (async () => {
    const { cloud, workspaceId } = await scope();
    if (ownGeneration !== generation || root !== reportsRoot()) return false;
    const prepared = await exactPrepared(root, tab, range, cloud, workspaceId);
    if (ownGeneration !== generation || root !== reportsRoot()) return false;
    const natural = await exactNatural(root, cloud, workspaceId);
    return prepared || natural;
  })();
  inflight = { signature, promise };
  try { return await promise; }
  finally { if (inflight?.promise === promise) inflight = null; }
}

function schedule(delay = 25) {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    repairExactReportsLiveV2().catch(error => console.warn('[Exact reports live v2]', error));
  }, delay);
}

function invalidate() {
  generation += 1;
  inflight = null;
  schedule();
}

export function installExactReportsLiveV2() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  window.addEventListener('avan:page-rendered', () => schedule());
  window.addEventListener('avan:money-unit-changed', invalidate);
  window.addEventListener('avan:company-context-changed', invalidate);
  window.addEventListener('avan:company-context-cleared', invalidate);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-report],#applyReportRange,#nlReportSubmit,[data-nl-example]')) {
      [0, 100, 300, 700].forEach(delay => window.setTimeout(() => schedule(0), delay));
    }
  }, true);
  const content = document.getElementById('content');
  if (content) {
    new MutationObserver(() => {
      if (reportsRoot()) schedule(40);
    }).observe(content, { childList: true, subtree: true });
  }
  schedule();
  window.AvanExactReportsLiveV2 = Object.freeze({
    repair: repairExactReportsLiveV2,
    oneRialExact: true,
    readOnly: true,
    authoritative: true
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installExactReportsLiveV2, { once: true });
  } else {
    installExactReportsLiveV2();
  }
}
