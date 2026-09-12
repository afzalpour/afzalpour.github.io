'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { projectAccountingNegativeNumbers } from '../money/accounting-negative-presentation.js';
import { openModal, closeModal } from '../components/modal.js';
import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../../core/money/canonical-money.js';
import { buildWhyNumberEvidence } from '../../reports/why-number.js';
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
let evidenceCached = null;

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
    const [
      roleRows,
      accounts,
      financialAccounts,
      parties,
      entries,
      lines,
      invoices,
      transactions,
      documents,
      integrity,
      invoiceIntegrity
    ] = await Promise.all([
      cloud.select('account_roles', queryWorkspace('account_roles', 'role_key,account_id', wid)),
      cloud.select('accounts', queryWorkspace('accounts', 'id,code,name,category,is_active,is_postable', wid)),
      cloud.select('financial_accounts', queryWorkspace('financial_accounts', 'id,kind,ledger_account_id,is_active', wid)),
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

    if (ownGeneration === generation) {
      evidenceCached = Object.freeze({
        generation: ownGeneration,
        workspaceId: wid,
        fiscalFrom: metricState.fiscalFrom,
        asOf: metricState.asOf,
        roles,
        accounts: accounts || [],
        financialAccounts: financialAccounts || [],
        parties: parties || [],
        entries: entries || [],
        lines: lines || [],
        invoices: invoices || []
      });
    }

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
    projectAccountingNegativeNumbers(document);
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

function evidenceStatus(expected, calculated) {
  if (calculated === null || calculated === undefined) return null;
  try {
    return toTenths(expected, 'business_evidence_expected') ===
      toTenths(calculated, 'business_evidence_calculated');
  } catch {
    return null;
  }
}

function businessEvidenceModalHtml({ evidence, amount, label }) {
  const accountRows = (evidence.accounts || []).slice(0, 12).map(account => `
    <tr>
      <td>${esc(account.code || '')}</td>
      <td>${esc(account.name || '')}</td>
      <td>${esc(account.category || '—')}</td>
    </tr>
  `).join('');
  const journalRows = (evidence.journals || []).slice(0, 16).map(entry => `
    <tr>
      <td>${entry.journal_no ?? '—'}</td>
      <td>${dateFa(entry.entry_date)}</td>
      <td>${esc(entry.description || '')}</td>
    </tr>
  `).join('');
  const matched = evidenceStatus(amount, evidence.calculatedAmount);
  const scopeText = evidence.scope === 'range'
    ? `${dateFa(evidence.from)} تا ${dateFa(evidence.to)}`
    : `تا ${dateFa(evidence.to)}`;
  const checkHtml = matched === true
    ? '<div class="success-box section">کنترل تطبیق ردیفی: مبلغ نمایش‌داده‌شده با محاسبه Evidence یکسان است.</div>'
    : matched === false
      ? `<div class="error-box section">کنترل تطبیق ردیفی نیازمند بررسی است. محاسبه Evidence: <b>${esc(money(evidence.calculatedAmount))}</b></div>`
      : '';

  return `
    <div class="section-head">
      <div>
        <h2>چرا این عدد؟ — ${esc(label || evidence.title)}</h2>
        <span class="muted">شواهد حسابداری و مسیر محاسبه از دفتر کل</span>
      </div>
      <span class="cloud-badge">Evidence</span>
    </div>

    <div class="grid4">
      <div class="card">
        <div class="kpi-label">عدد پاسخ</div>
        <div class="kpi-value small-kpi">${esc(money(amount))}</div>
      </div>
      <div class="card">
        <div class="kpi-label">منبع محاسبه</div>
        <div class="kpi-value small-kpi">${esc(evidence.sourceReport || 'Ledger')}</div>
      </div>
      <div class="card">
        <div class="kpi-label">حساب‌های مرتبط</div>
        <div class="kpi-value small-kpi">${Number(evidence.accountCount || 0).toLocaleString('fa-IR')}</div>
      </div>
      <div class="card">
        <div class="kpi-label">شواهد دفتر کل</div>
        <div class="kpi-value small-kpi">${Number(evidence.lineCount || 0).toLocaleString('fa-IR')} ردیف / ${Number(evidence.journalCount || 0).toLocaleString('fa-IR')} سند</div>
      </div>
    </div>

    <div class="info-box section">
      <b>منطق:</b> ${esc(evidence.calculationNote || 'ردیابی از گزارش معتبر تا دفتر کل.')}
      <br><br>
      <b>بازه:</b> ${esc(scopeText)}
    </div>

    ${checkHtml}

    <div class="section">
      <h3>حساب‌های مرتبط</h3>
      ${accountRows ? `
        <table>
          <thead><tr><th>کد</th><th>حساب</th><th>گروه</th></tr></thead>
          <tbody>${accountRows}</tbody>
        </table>
      ` : '<div class="empty">حساب مرتبطی برای نمایش وجود ندارد.</div>'}
    </div>

    <div class="section">
      <h3>اسناد مؤثر</h3>
      ${journalRows ? `
        <table>
          <thead><tr><th>سند</th><th>تاریخ</th><th>شرح</th></tr></thead>
          <tbody>${journalRows}</tbody>
        </table>
      ` : '<div class="empty">سند مرتبطی در این بازه پیدا نشد.</div>'}
    </div>

    <div class="form-actions"><button type="button" class="ghost" id="businessEvidenceClose">بستن</button></div>
  `;
}

async function openBusinessEvidence(button) {
  await MoneyRuntime.ready();
  await loadAuditSnapshot();
  const context = evidenceCached;
  if (!context) throw new Error('BUSINESS_EVIDENCE_CONTEXT_REQUIRED');
  const metric = String(button.dataset.businessEvidenceMetric || '').trim();
  const amount = String(button.dataset.businessEvidenceAmount ?? '0');
  const label = String(button.dataset.businessEvidenceLabel || '').trim();
  const targetPartyId = button.dataset.businessEvidencePartyId || null;
  const targetAccountId = button.dataset.businessEvidenceAccountId || null;

  const evidence = buildWhyNumberEvidence({
    metric,
    accounts: context.accounts,
    financialAccounts: context.financialAccounts,
    roles: context.roles,
    parties: context.parties,
    entries: context.entries,
    lines: context.lines,
    invoices: context.invoices,
    from: context.fiscalFrom,
    to: context.asOf,
    targetPartyId,
    targetAccountId
  });

  openModal(businessEvidenceModalHtml({ evidence, amount, label }));
  const close = document.getElementById('businessEvidenceClose');
  if (close) close.onclick = closeModal;
  projectAccountingNegativeNumbers(document);
}

function onBusinessEvidenceClick(event) {
  const button = event.target?.closest?.('[data-business-evidence-metric]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (button.disabled) return;
  button.disabled = true;
  Promise.resolve(openBusinessEvidence(button))
    .catch(error => {
      console.warn('[Business evidence]', error);
      openModal(`
        <h2>چرا این عدد؟</h2>
        <div class="error-box">شواهد این عدد در حال حاضر قابل بارگذاری نیست. لطفاً دوباره تلاش کنید.</div>
        <div class="form-actions"><button type="button" class="ghost" id="businessEvidenceClose">بستن</button></div>
      `);
      const close = document.getElementById('businessEvidenceClose');
      if (close) close.onclick = closeModal;
    })
    .finally(() => { button.disabled = false; });
}

function installBusinessEvidenceStyle() {
  if (document.getElementById('avanBusinessEvidenceStyle')) return;
  const style = document.createElement('style');
  style.id = 'avanBusinessEvidenceStyle';
  style.textContent = `
    .avan-business-metric-evidence{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;vertical-align:middle}
    .avan-business-money-value{font-variant-numeric:tabular-nums;white-space:nowrap}
    .avan-business-evidence-button{white-space:nowrap}
  `;
  document.head.append(style);
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
  evidenceCached = null;
}

export function installDashboardAccountingCorrectnessHotfix() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installBusinessEvidenceStyle();
  document.addEventListener('click', onBusinessEvidenceClick, true);

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