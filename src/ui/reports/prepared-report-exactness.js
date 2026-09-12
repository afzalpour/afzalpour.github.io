'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import {
  reportMoneyCategoryTenths,
  reportMoneyDecimal
} from '../../reports/report-money-exact.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
let installed = false;
let generation = 0;
let inflight = null;
let scheduled = 0;

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
  return [...(root?.querySelectorAll?.('.card') || [])].find(card =>
    String(card.querySelector('.kpi-label')?.textContent || '').trim() === label
  )?.querySelector('.kpi-value') || null;
}

function projectKpi(root, label, tenths, { signed = false } = {}) {
  const node = findKpi(root, label);
  if (!node) return false;
  const canonical = reportMoneyDecimal(tenths, label);
  const formatted = MoneyRuntime.formatCanonical(canonical);
  if (node.textContent.trim() !== formatted) node.textContent = formatted;
  if (signed) {
    node.classList.toggle('neg', tenths < 0n);
    node.classList.toggle('pos', tenths >= 0n);
  }
  node.dataset.avanExactReportMoney = '1';
  node.dataset.avanCanonicalAmount = canonical;
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

async function repairProfitLoss(root, cloud, workspaceId, range) {
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
  root.dataset.avanExactReportSignature = `pnl:${workspaceId}:${range.from}:${range.to}`;
  return true;
}

async function repairBalance(root, cloud, workspaceId, range) {
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
  root.dataset.avanExactReportSignature = `balance:${workspaceId}:${range.to}`;
  return true;
}

export async function repairPreparedReportExactness() {
  const root = reportsRoot();
  if (!root) return false;
  await MoneyRuntime.ready();
  const tab = activeTab(root);
  if (tab !== 'pnl' && tab !== 'balance') return false;
  const range = reportRange();
  const ownGeneration = generation;
  const signature = tab === 'pnl'
    ? `pnl:${range.from || ''}:${range.to || ''}`
    : `balance:${range.to || ''}`;
  if (inflight?.signature === signature) return inflight.promise;

  const promise = (async () => {
    const { cloud, workspaceId } = await scope();
    if (ownGeneration !== generation || root !== reportsRoot()) return false;
    return tab === 'pnl'
      ? repairProfitLoss(root, cloud, workspaceId, range)
      : repairBalance(root, cloud, workspaceId, range);
  })();
  inflight = { signature, promise };
  try { return await promise; }
  finally { if (inflight?.promise === promise) inflight = null; }
}

function schedule() {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    repairPreparedReportExactness().catch(error =>
      console.warn('[Exact prepared reports]', error)
    );
  }, 0);
}

function invalidate() {
  generation += 1;
  inflight = null;
  schedule();
}

export function installPreparedReportExactness() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:money-unit-changed', schedule);
  window.addEventListener('avan:company-context-changed', invalidate);
  window.addEventListener('avan:company-context-cleared', invalidate);
  document.addEventListener('click', event => {
    if (event.target?.closest?.('[data-report],#applyReportRange')) {
      [0, 50, 160].forEach(delay => window.setTimeout(schedule, delay));
    }
  }, true);
  const content = document.getElementById('content');
  if (content) {
    new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  }
  schedule();
  window.AvanPreparedReportExactness = Object.freeze({
    repair: repairPreparedReportExactness,
    oneRialExact: true,
    readOnly: true
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installPreparedReportExactness, { once: true });
  } else {
    installPreparedReportExactness();
  }
}
