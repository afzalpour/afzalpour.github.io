'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { openModal, closeModal } from '../components/modal.js';
import { buildWhyNumberEvidence } from '../../reports/why-number.js?rc17-live-v3=1';
import { buildPartyAging } from '../../reports/party-aging.js?rc17-live-v3=1';
import { canonicalDecimalToTenths } from '../../core/money/canonical-money.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const AGING_METRICS = Object.freeze({
  receivables: { side: 'receivables', overdueOnly: false },
  overdue_receivables: { side: 'receivables', overdueOnly: true },
  payables: { side: 'payables', overdueOnly: false },
  overdue_payables: { side: 'payables', overdueOnly: true }
});

let installed = false;
let evidenceContext = null;
let evidenceInflight = null;
let patchFrame = 0;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function activeUnitLabel() {
  const runtime = String(window.AvanMoney?.unitLabel?.() || '').trim();
  if (runtime === 'ریال' || runtime === 'تومان') return runtime;
  const unit = String(document.documentElement.dataset.avanMoneyUnit || '').toLowerCase();
  return unit === 'rial' ? 'ریال' : 'تومان';
}

function baseHeaderText(value) {
  return String(value || '')
    .replace(/\s*\((?:ریال|تومان)\)\s*$/u, '')
    .replace(/\s+(?:ریال|تومان)\s*$/u, '')
    .trim();
}

function forceHeader(table, labels, unit) {
  if (!table) return;
  table.querySelectorAll('thead th').forEach(th => {
    const base = baseHeaderText(th.textContent);
    if (labels.has(base)) th.textContent = `${base} (${unit})`;
  });
}

function patchMoneyHeaders(root) {
  if (!root) return;
  const unit = activeUnitLabel();

  [...root.querySelectorAll('.section.card')]
    .filter(section => /مطالبات و بدهی تجاری/.test(section.textContent || ''))
    .forEach(section => section.querySelectorAll('table').forEach(table =>
      forceHeader(table, new Set(['مبلغ', 'مانده باز']), unit)
    ));

  root.querySelectorAll('h2').forEach(heading => {
    if (!/دستیار هوشمند وصول|Smart Collection Agent/.test(heading.textContent || '')) return;
    const section = heading.closest('.section.card');
    const table = section?.querySelector('table');
    forceHeader(table, new Set(['مانده', 'سررسیدگذشته']), unit);
  });

  if (/ریز مانده باز/.test(root.textContent || '')) {
    root.querySelectorAll('table').forEach(table =>
      forceHeader(table, new Set(['مانده']), unit)
    );
  }
}

function schedulePatch() {
  if (patchFrame) return;
  patchFrame = requestAnimationFrame(() => {
    patchFrame = 0;
    patchMoneyHeaders(document.getElementById('content'));
    patchMoneyHeaders(document.getElementById('modal'));
  });
}

function workspaceQuery(fields, workspaceId, suffix = '') {
  return `select=${fields}&workspace_id=eq.${workspaceId}${suffix ? `&${suffix}` : ''}`;
}

async function loadEvidenceContext() {
  const cloud = installAvanCloud();
  const company = await cloud.companyContext.ensure();
  if (company?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspaceId = company?.active_company?.id;
  if (!workspaceId) throw new Error('COMPANY_REQUIRED');
  const asOf = todayIso();

  if (evidenceContext?.workspaceId === workspaceId && evidenceContext?.asOf === asOf) {
    return evidenceContext;
  }
  if (evidenceInflight) return evidenceInflight;

  evidenceInflight = (async () => {
    const fiscalRows = await cloud.select(
      'fiscal_years',
      workspaceQuery('id,date_from,date_to', workspaceId, 'order=date_from.desc&limit=1')
    );
    const fiscalFrom = fiscalRows?.[0]?.date_from;
    if (!fiscalFrom) throw new Error('FISCAL_YEAR_REQUIRED');

    const [roleRows, accounts, financialAccounts, parties, entries, lines, invoices] = await Promise.all([
      cloud.select('account_roles', workspaceQuery('role_key,account_id', workspaceId)),
      cloud.select('accounts', workspaceQuery('id,code,name,category,is_active,is_postable', workspaceId, 'order=code.asc')),
      cloud.select('financial_accounts', workspaceQuery('id,kind,ledger_account_id,is_active', workspaceId)),
      cloud.select('parties', workspaceQuery('id,name,is_active', workspaceId, 'order=name.asc')),
      cloud.select('journal_entries', workspaceQuery('id,journal_no,entry_date,status,source_type,source_id,description', workspaceId, `entry_date=lte.${asOf}&order=entry_date.asc,journal_no.asc.nullslast`)),
      cloud.select('journal_lines', workspaceQuery('id,journal_entry_id,line_no,account_id,party_id,description,debit,credit', workspaceId, 'order=journal_entry_id.asc,line_no.asc')),
      cloud.select('invoices', workspaceQuery('id,invoice_no,invoice_type,invoice_date,due_date,party_id,status,journal_entry_id,reversal_journal_entry_id,total_amount', workspaceId, `invoice_date=lte.${asOf}&order=invoice_date.asc,invoice_no.asc.nullslast`))
    ]);

    const roles = Object.fromEntries((roleRows || [])
      .filter(row => row?.role_key && row?.account_id)
      .map(row => [row.role_key, row.account_id]));

    evidenceContext = Object.freeze({
      workspaceId,
      asOf,
      fiscalFrom,
      roles,
      accounts: accounts || [],
      financialAccounts: financialAccounts || [],
      parties: parties || [],
      entries: entries || [],
      lines: lines || [],
      invoices: invoices || []
    });
    return evidenceContext;
  })();

  try { return await evidenceInflight; }
  finally { evidenceInflight = null; }
}

function augmentAgingOriginJournals(evidence, metric, context, targetPartyId) {
  const config = AGING_METRICS[metric];
  if (!config) return evidence;

  const aging = buildPartyAging({
    roles: context.roles,
    parties: context.parties,
    entries: context.entries,
    lines: context.lines,
    invoices: context.invoices,
    asOf: context.asOf
  });
  const side = aging[config.side];
  const selectedParties = (side?.parties || []).filter(party =>
    !targetPartyId || party.partyId === targetPartyId
  );
  const originIds = new Set();
  for (const party of selectedParties) {
    for (const item of party.openItems || []) {
      if (config.overdueOnly && (!item.dueDate || item.dueDate >= context.asOf)) continue;
      if (item.journalEntryId) originIds.add(String(item.journalEntryId));
    }
  }

  const merged = new Map((evidence.journals || []).map(entry => [String(entry.id), entry]));
  for (const entry of context.entries) {
    if (originIds.has(String(entry.id))) merged.set(String(entry.id), entry);
  }
  const journals = [...merged.values()].sort((a, b) => {
    const ad = String(a.entry_date || '');
    const bd = String(b.entry_date || '');
    if (ad !== bd) return bd.localeCompare(ad);
    return Number(b.journal_no || 0) - Number(a.journal_no || 0);
  });

  return Object.freeze({
    ...evidence,
    journals: Object.freeze(journals),
    journalCount: journals.length,
    contracts: Object.freeze({
      ...(evidence.contracts || {}),
      originJournalGuaranteed: true
    })
  });
}

function amountsMatch(expected, calculated) {
  if (calculated === null || calculated === undefined) return null;
  const a = canonicalDecimalToTenths(String(expected ?? '0'));
  const b = canonicalDecimalToTenths(String(calculated ?? '0'));
  return a !== null && b !== null ? a === b : null;
}

function formatMoney(value) {
  return MoneyRuntime?.formatCanonical?.(value) || String(value ?? '—');
}

function evidenceModalHtml({ evidence, amount, label }) {
  const matched = amountsMatch(amount, evidence.calculatedAmount);
  const journalRows = (evidence.journals || []).slice(0, 30).map(entry => `
    <tr>
      <td>${esc(entry.journal_no ?? '—')}</td>
      <td>${esc(dateFa(entry.entry_date))}</td>
      <td>${esc(entry.description || entry.source_type || '—')}</td>
    </tr>
  `).join('');
  const accountRows = (evidence.accounts || []).slice(0, 20).map(account => `
    <tr><td>${esc(account.code || '—')}</td><td>${esc(account.name || '—')}</td></tr>
  `).join('');

  return `
    <div class="section-head">
      <div>
        <h2>چرا این عدد؟ — ${esc(label || evidence.title)}</h2>
        <span class="muted">ردیابی مستقیم از دفتر کل و سررسیدهای باز</span>
      </div>
      <span class="cloud-badge">شواهد حسابداری</span>
    </div>
    <div class="card section">
      <div class="kpi-label">عدد پاسخ</div>
      <div class="kpi-value">${esc(formatMoney(amount))}</div>
    </div>
    <div class="info-box section">
      <b>منطق محاسبه:</b> ${esc(evidence.calculationNote || 'ردیابی از دفتر کل')}
      <br><b>تعداد اسناد مؤثر:</b> ${Number(evidence.journalCount || 0).toLocaleString('fa-IR')}
      ${matched === true ? '<br><b>کنترل تطبیق:</b> عدد پاسخ با محاسبه Evidence یکسان است.' : ''}
      ${matched === false ? `<br><b>کنترل تطبیق:</b> نیازمند بررسی — محاسبه Evidence: ${esc(formatMoney(evidence.calculatedAmount))}` : ''}
    </div>
    <div class="section">
      <h3>حساب‌های مرتبط</h3>
      ${accountRows ? `<table><thead><tr><th>کد</th><th>حساب</th></tr></thead><tbody>${accountRows}</tbody></table>` : '<div class="empty">حساب مرتبطی برای نمایش وجود ندارد.</div>'}
    </div>
    <div class="section">
      <h3>اسناد مؤثر</h3>
      ${journalRows ? `<table><thead><tr><th>شماره سند</th><th>تاریخ</th><th>شرح</th></tr></thead><tbody>${journalRows}</tbody></table>` : '<div class="empty">برای این عدد سند مؤثری پیدا نشد.</div>'}
    </div>
    <div class="form-actions"><button type="button" class="ghost" id="dashboardLiveEvidenceClose">بستن</button></div>
  `;
}

async function openEvidence(button) {
  await MoneyRuntime?.ready?.();
  const context = await loadEvidenceContext();
  const metric = String(button.dataset.businessEvidenceMetric || '').trim();
  const amount = String(button.dataset.businessEvidenceAmount ?? '0');
  const label = String(button.dataset.businessEvidenceLabel || '').trim();
  const targetPartyId = button.dataset.businessEvidencePartyId || null;
  const targetAccountId = button.dataset.businessEvidenceAccountId || null;

  let evidence = buildWhyNumberEvidence({
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
  evidence = augmentAgingOriginJournals(evidence, metric, context, targetPartyId);

  openModal(evidenceModalHtml({ evidence, amount, label }));
  document.getElementById('dashboardLiveEvidenceClose')?.addEventListener('click', closeModal, { once: true });
  window.AvanAccountingNegative?.project?.();
  schedulePatch();
}

function interceptEvidenceClick(event) {
  const button = event.target?.closest?.('[data-business-evidence-metric]');
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (button.disabled) return;
  button.disabled = true;

  Promise.resolve(openEvidence(button))
    .catch(error => {
      console.warn('[Dashboard live evidence v3]', error);
      openModal(`
        <h2>چرا این عدد؟</h2>
        <div class="error-box">شواهد این عدد در حال حاضر قابل بارگذاری نیست.</div>
        <div class="form-actions"><button type="button" class="ghost" id="dashboardLiveEvidenceClose">بستن</button></div>
      `);
      document.getElementById('dashboardLiveEvidenceClose')?.addEventListener('click', closeModal, { once: true });
    })
    .finally(() => { button.disabled = false; });
}

function invalidateEvidence() {
  evidenceContext = null;
  evidenceInflight = null;
}

export function installDashboardLiveContractV3() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;

  window.addEventListener('click', interceptEvidenceClick, true);
  window.addEventListener('avan:page-rendered', schedulePatch);
  window.addEventListener('avan:money-unit-changed', schedulePatch);
  window.addEventListener('avan:company-context-changed', () => {
    invalidateEvidence();
    schedulePatch();
  });
  window.addEventListener('avan:company-context-cleared', invalidateEvidence);

  const content = document.getElementById('content');
  const modal = document.getElementById('modal');
  if (content) new MutationObserver(schedulePatch).observe(content, { childList: true, subtree: true });
  if (modal) new MutationObserver(schedulePatch).observe(modal, { childList: true, subtree: true });

  schedulePatch();
  window.AvanDashboardLiveContractV3 = Object.freeze({
    patch: schedulePatch,
    loadEvidenceContext
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDashboardLiveContractV3, { once: true });
  } else {
    installDashboardLiveContractV3();
  }
}
