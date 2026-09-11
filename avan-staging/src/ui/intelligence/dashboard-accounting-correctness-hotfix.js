'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../../core/money/canonical-money.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const METRIC_LABELS = Object.freeze({
  'دارایی': 'assets',
  'بانک و صندوق': 'cash',
  'بدهی': 'liabilities',
  'سود/زیان سال': 'profit'
});

let installed = false;
let generation = 0;
let inflight = null;
let cached = null;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function toTenths(value, field) {
  const tenths = canonicalDecimalToTenths(String(value ?? '0'));
  if (tenths === null) throw new Error(`DASHBOARD_INVALID_CANONICAL_MONEY:${field}`);
  return tenths;
}

function toDecimal(tenths) {
  const value = canonicalTenthsToDecimal(tenths);
  if (value === null) throw new Error('DASHBOARD_CANONICAL_MONEY_SERIALIZE_FAILED');
  return value;
}

export function computeExactDashboardMetrics({ balance = [], profitLoss = [], cash = [] } = {}) {
  const balanceMap = new Map((balance || []).map(row => [
    String(row.category || ''),
    toTenths(row.amount, `balance:${row.category}`)
  ]));
  const pnlMap = new Map((profitLoss || []).map(row => [
    String(row.category || ''),
    toTenths(row.amount, `pnl:${row.category}`)
  ]));
  const cashTenths = (cash || []).reduce(
    (sum, row) => sum + toTenths(row.amount, 'cash'),
    0n
  );
  const profitTenths =
    (pnlMap.get('income') || 0n) -
    (pnlMap.get('expense') || 0n);

  return Object.freeze({
    assets: toDecimal(balanceMap.get('asset') || 0n),
    liabilities: toDecimal(balanceMap.get('liability') || 0n),
    cash: toDecimal(cashTenths),
    profit: toDecimal(profitTenths),
    profitTenths
  });
}

async function loadMetrics() {
  const ownGeneration = generation;
  if (cached?.generation === ownGeneration && cached?.asOf === isoToday()) return cached.metrics;
  if (inflight) return inflight;

  inflight = (async () => {
    const cloud = installAvanCloud();
    const state = await cloud.companyContext.ensure();
    if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const workspaceId = state?.active_company?.id;
    if (!workspaceId) throw new Error('COMPANY_REQUIRED');

    const fiscalRows = await cloud.select(
      'fiscal_years',
      `select=id,date_from,date_to&workspace_id=eq.${workspaceId}&order=date_from.desc&limit=1`
    );
    const fiscal = fiscalRows?.[0];
    if (!fiscal?.date_from) throw new Error('FISCAL_YEAR_REQUIRED');
    const asOf = isoToday();

    const [balance, profitLoss, cash] = await Promise.all([
      cloud.rpc('report_balance_sheet', { wid: workspaceId, as_of: asOf }),
      cloud.rpc('report_profit_loss', { wid: workspaceId, dfrom: fiscal.date_from, dto: asOf }),
      cloud.rpc('report_cash_bank_balances', { wid: workspaceId, as_of: asOf })
    ]);

    const metrics = computeExactDashboardMetrics({ balance, profitLoss, cash });
    if (ownGeneration === generation) {
      cached = Object.freeze({ generation, asOf, workspaceId, metrics });
    }
    return metrics;
  })();

  try { return await inflight; }
  finally { inflight = null; }
}

function dashboardRoot() {
  const title = String(document.getElementById('pageTitle')?.textContent || '').trim();
  return title === 'داشبورد' ? document.getElementById('content') : null;
}

function applyMetrics(root, metrics) {
  if (!root || !metrics) return false;
  const primaryGrid = root.querySelector(':scope > .grid4') || root.querySelector('.grid4');
  if (!primaryGrid) return false;

  let changed = false;
  primaryGrid.querySelectorAll(':scope > .card').forEach(card => {
    const label = String(card.querySelector('.kpi-label')?.textContent || '').trim();
    const key = METRIC_LABELS[label];
    if (!key) return;
    const canonical = metrics[key];
    const value = card.querySelector('.kpi-value');
    if (value) {
      const next = MoneyRuntime.formatCanonical(canonical);
      if (value.textContent.trim() !== next) {
        value.textContent = next;
        changed = true;
      }
      if (key === 'profit') {
        const negative = toTenths(canonical, 'profit') < 0n;
        value.classList.toggle('neg', negative);
        value.classList.toggle('pos', !negative);
      }
    }
    const why = card.querySelector('[data-why-number]');
    if (why && why.dataset.whyAmount !== canonical) {
      why.dataset.whyAmount = canonical;
      changed = true;
    }
  });
  return changed;
}

async function refresh() {
  const root = dashboardRoot();
  if (!root) return false;
  try {
    await MoneyRuntime.ready();
    const metrics = await loadMetrics();
    if (root !== dashboardRoot()) return false;
    applyMetrics(root, metrics);
    window.dispatchEvent(new CustomEvent('avan:dashboard-authoritative-metrics', { detail: metrics }));
    return true;
  } catch (error) {
    console.warn('[Dashboard exact money hotfix]', error);
    return false;
  }
}

export function installDashboardAccountingCorrectnessHotfix() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;

  window.addEventListener('avan:page-rendered', () => queueMicrotask(refresh));
  window.addEventListener('avan:company-context-changed', () => {
    generation += 1;
    cached = null;
    inflight = null;
    queueMicrotask(refresh);
  });
  window.addEventListener('avan:company-context-cleared', () => {
    generation += 1;
    cached = null;
    inflight = null;
  });

  const content = document.getElementById('content');
  if (content) {
    const observer = new MutationObserver(() => {
      if (!cached?.metrics || !dashboardRoot()) return;
      queueMicrotask(() => applyMetrics(dashboardRoot(), cached.metrics));
    });
    observer.observe(content, { childList: true, subtree: true });
  }

  queueMicrotask(refresh);
  window.AvanDashboardAccountingCorrectness = Object.freeze({
    refresh,
    computeExactDashboardMetrics
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      installDashboardAccountingCorrectnessHotfix,
      { once: true }
    );
  } else {
    installDashboardAccountingCorrectnessHotfix();
  }
}
