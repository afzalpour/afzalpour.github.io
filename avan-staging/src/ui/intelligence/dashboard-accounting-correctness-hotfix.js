'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { projectAccountingNegativeNumbers } from '../money/accounting-negative-presentation.js';
import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../../core/money/canonical-money.js';
import { buildPartyAging } from '../../reports/party-aging.js';
import {
  buildFinancialCopilotSnapshot,
  answerBusinessQuestion
} from '../../ai/business-copilot.js';
import {
  financialCopilotSectionHtml,
  businessAnswerHtml
} from './business-copilot-view.js';
import { buildRiskAuditSnapshot } from '../../ai/risk-audit.js';
import { riskAuditSectionHtml } from './risk-audit-view.js';

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
let auditInflight = null;
let auditCached = null;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function dateFa(value) {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value || '—';
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function money(value) {
  return MoneyRuntime.formatCanonical(value);
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
  const cashTenths = (cash || []).reduce((sum, row) => sum + toTenths(row.amount, 'cash'), 0n);
  const profitTenths = (pnlMap.get('income') || 0n) - (pnlMap.get('expense') || 0n);

  return Object.freeze({
    assets: toDecimal(balanceMap.get('asset') || 0n),
    liabilities: toDecimal(balanceMap.get('liability') || 0n),
    cash: toDecimal(cashTenths),
    profit: toDecimal(profitTenths),
    profitTenths
  });
}

async function activeScope(cloud) {
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
  return Object.freeze({ workspaceId, fiscal, asOf: isoToday() });
}

async function loadMetrics() {
  const ownGeneration = generation;
  if (cached?.generation === ownGeneration && cached?.asOf === isoToday()) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const cloud = installAvanCloud();
    const scope = await activeScope(cloud);
    const [balance, profitLoss, cash] = await Promise.all([
      cloud.rpc('report_balance_sheet', { wid: scope.workspaceId, as_of: scope.asOf }),
      cloud.rpc('report_profit_loss', { wid: scope.workspaceId, dfrom: scope.fiscal.date_from, dto: scope.asOf }),
      cloud.rpc('report_cash_bank_balances', { wid: scope.workspaceId, as_of: scope.asOf })
    ]);
    const metrics = computeExactDashboardMetrics({ balance, profitLoss, cash });
    const result = Object.freeze({
      generation: ownGeneration,
      workspaceId: scope.workspaceId,
      fiscalFrom: scope.fiscal.date_from,
      asOf: scope.asOf,
      metrics
    });
    if (ownGeneration === generation) cached = result;
    return result;
  })();

  try { return await inflight; }
  finally { inflight = null; }
}

function queryWorkspace(table, fields, workspaceId, suffix = '') {
  return `select=${fields}&workspace_id=eq.${workspaceId}${suffix ? `&${suffix}` : ''}`;
}

async function loadAuditSnapshot() {
  const metricState = await loadMetrics();
  const ownGeneration = generation;
  if (
    auditCached?.generation === ownGeneration &&
    auditCached?.workspaceId === metricState.workspaceId &&
    auditCached?.asOf === metricState.asOf
  ) return auditCached;
  if (auditInflight) return auditInflight;

  auditInflight = (async () => {
    const cloud = installAvanCloud();
    const wid = metricState.workspaceId;
    const [roleRows, accounts, parties, entries, lines, invoices, transactions, documents, integrity, invoiceIntegrity] = await Promise.all([
      cloud.select('account_roles', queryWorkspace('account_roles', 'role_key,account_id', wid)),
      cloud.select('accounts', queryWorkspace('accounts', 'id,name,category,is_active,is_postable', wid)),
      cloud.select('parties', queryWorkspace('parties', 'id,name,kind,is_active,created_at', wid, 'order=name.asc')),
      cloud.select('journal_entries', queryWorkspace('journal_entries', 'id,journal_no,entry_date,status,source_type,source_id,description', wid, `entry_date=lte.${metricState.asOf}&order=entry_date.asc,journal_no.asc.nullslast`)),
      cloud.select('journal_lines', queryWorkspace('journal_lines', 'id,journal_entry_id,line_no,account_id,party_id,description,debit,credit', wid, 'order=journal_entry_id.asc,line_no.asc')),
      cloud.select('invoices', queryWorkspace('invoices', 'id,invoice_no,invoice_type,invoice_date,due_date,party_id,status,journal_entry_id,reversal_journal_entry_id,total_amount', wid, `invoice_date=lte.${metricState.asOf}&order=invoice_date.asc,invoice_no.asc.nullslast`)),
      cloud.select('financial_transactions', queryWorkspace('financial_transactions', 'id,tx_date,tx_type,amount,party_id,from_account_id,to_account_id,counterpart_account_id,created_at', wid, 'order=tx_date.desc,created_at.desc&limit=100')),
      cloud.select('documents', queryWorkspace('documents', 'id,status,file_hash,linked_journal_entry_id,created_at', wid, 'order=created_at.desc')),
      cloud.rpc('avan_core_integrity', { wid }),
      cloud.rpc('invoice_integrity', { wid })
    ]);

    const roles = Object.fromEntries((roleRows || [])
      .filter(row => row?.role_key && row?.account_id)
      .map(row => [row.role_key, row.account_id]));
    const aging = buildPartyAging({
      roles,
      parties: parties || [],
      entries: entries || [],
      lines: lines || [],
      invoices: invoices || [],
      asOf: metricState.asOf
    });
    const copilot = buildFinancialCopilotSnapshot({
      asOf: metricState.asOf,
      fiscalFrom: metricState.fiscalFrom,
      assets: metricState.metrics.assets,
      liabilities: metricState.metrics.liabilities,
      profit: metricState.metrics.profit,
      cash: metricState.metrics.cash,
      aging,
      accounts: accounts || [],
      entries: entries || [],
      lines: lines || [],
      documents: documents || [],
      invoices: invoices || [],
      integrity
    });
    const risk = buildRiskAuditSnapshot({
      asOf: metricState.asOf,
      cash: metricState.metrics.cash,
      aging,
      parties: parties || [],
      invoices: invoices || [],
      transactions: transactions || [],
      documents: documents || [],
      integrity,
      invoiceIntegrity
    });

    const result = Object.freeze({
      generation: ownGeneration,
      workspaceId: wid,
      asOf: metricState.asOf,
      metrics: metricState.metrics,
      aging,
      copilot,
      risk,
      contracts: Object.freeze({
        companyScoped: true,
        explicitWorkspaceFilter: true,
        oneRialExact: true,
        readOnly: true,
        writeOperations: 0
      })
    });
    if (ownGeneration === generation) auditCached = result;
    return result;
  })();

  try { return await auditInflight; }
  finally { auditInflight = null; }
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

function findSection(root, headingText) {
  const heading = [...root.querySelectorAll('h2')].find(node =>
    String(node.textContent || '').includes(headingText)
  );
  return heading?.closest('.section.card') || null;
}

function bindExactBusinessCopilot(section, snapshot) {
  const form = section?.querySelector('#businessAskForm');
  if (!form) return;
  form.onsubmit = event => {
    event.preventDefault();
    const query = String(section.querySelector('#businessAskQuery')?.value || '').trim();
    if (!query) return;
    const answer = answerBusinessQuestion({ query, snapshot });
    const box = section.querySelector('#businessAskAnswer');
    if (!box) return;
    box.innerHTML = businessAnswerHtml(answer, { money, esc });
    box.querySelectorAll('[data-business-why]').forEach(button => {
      button.onclick = () => {
        const metric = button.dataset.businessWhy;
        const amount = button.dataset.businessAmount;
        const source = document.querySelector(`[data-why-number="${CSS.escape(metric)}"]`);
        if (source) {
          if (amount !== undefined) source.dataset.whyAmount = amount;
          source.click();
        }
      };
    });
  };
}

function replaceCopilot(root, snapshot) {
  const current = findSection(root, 'Avan Intelligence');
  if (!current) return false;
  const currentVersion = current.dataset.avanExactAuditKey;
  const nextVersion = `${snapshot.asOf}:${snapshot.workspaceId}`;
  if (currentVersion === nextVersion) return false;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = financialCopilotSectionHtml(snapshot.copilot, { money, esc, dateFa }).trim();
  const next = wrapper.firstElementChild;
  if (!next) return false;
  next.dataset.avanExactAuditKey = nextVersion;
  current.replaceWith(next);
  bindExactBusinessCopilot(next, snapshot.copilot);
  return true;
}

function patchRisk(root, snapshot) {
  const current = findSection(root, 'Business Risk Radar');
  if (!current) return false;
  const nextVersion = `${snapshot.asOf}:${snapshot.workspaceId}`;
  if (current.dataset.avanExactAuditKey === nextVersion) return false;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = riskAuditSectionHtml(snapshot.risk, { money, dateFa, esc }).trim();
  const exact = wrapper.firstElementChild;
  if (!exact) return false;

  const currentBadge = current.querySelector(':scope > .section-head .cloud-badge');
  const exactBadge = exact.querySelector(':scope > .section-head .cloud-badge');
  if (currentBadge && exactBadge) currentBadge.textContent = exactBadge.textContent;

  const currentFactor = current.querySelector('.avan-risk-factor-grid') || current.querySelector(':scope > .success-box.section');
  const exactFactor = exact.querySelector('.avan-risk-factor-grid') || exact.querySelector(':scope > .success-box.section');
  if (currentFactor && exactFactor) currentFactor.replaceWith(exactFactor);
  else if (!currentFactor && exactFactor) current.querySelector(':scope > .section-head')?.after(exactFactor);

  current.dataset.avanExactAuditKey = nextVersion;
  return true;
}

async function refresh() {
  const root = dashboardRoot();
  if (!root) return false;
  try {
    await MoneyRuntime.ready();
    const snapshot = await loadAuditSnapshot();
    if (root !== dashboardRoot()) return false;
    applyMetrics(root, snapshot.metrics);
    replaceCopilot(root, snapshot);
    patchRisk(root, snapshot);
    projectAccountingNegativeNumbers(document);
    window.dispatchEvent(new CustomEvent('avan:dashboard-authoritative-metrics', { detail: snapshot.metrics }));
    window.dispatchEvent(new CustomEvent('avan:dashboard-accounting-audit-ready', {
      detail: Object.freeze({
        workspaceId: snapshot.workspaceId,
        asOf: snapshot.asOf,
        oneRialExact: true,
        companyScoped: true
      })
    }));
    return true;
  } catch (error) {
    console.warn('[Dashboard accounting correctness audit]', error);
    return false;
  }
}

function invalidate() {
  generation += 1;
  cached = null;
  inflight = null;
  auditCached = null;
  auditInflight = null;
}

export function installDashboardAccountingCorrectnessHotfix() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;

  window.addEventListener('avan:page-rendered', () => queueMicrotask(refresh));
  window.addEventListener('avan:company-context-changed', () => {
    invalidate();
    queueMicrotask(refresh);
  });
  window.addEventListener('avan:company-context-cleared', invalidate);

  const content = document.getElementById('content');
  if (content) {
    const observer = new MutationObserver(mutations => {
      if (!auditCached || !dashboardRoot()) return;
      const surfaceReplacement = mutations.some(mutation =>
        mutation.target === content && [...mutation.addedNodes].some(node => node.nodeType === 1)
      );
      if (surfaceReplacement) queueMicrotask(refresh);
    });
    observer.observe(content, { childList: true, subtree: false });
  }

  queueMicrotask(refresh);
  window.AvanDashboardAccountingCorrectness = Object.freeze({
    refresh,
    computeExactDashboardMetrics,
    snapshot: () => auditCached
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDashboardAccountingCorrectnessHotfix, { once: true });
  } else {
    installDashboardAccountingCorrectnessHotfix();
  }
}
