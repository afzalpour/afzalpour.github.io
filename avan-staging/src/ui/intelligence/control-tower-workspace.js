'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createControlTowerSnapshotService } from '../../application/intelligence/control-tower-snapshot-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const Service = HAS_BROWSER ? createControlTowerSnapshotService({ cloud: C }) : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function money(value) {
  if (value === null || value === undefined) return 'تعریف نشده';
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value), { withUnit: true }) || '—';
}

const evidenceTypeFa = Object.freeze({
  financial_account: 'حساب مالی',
  journal_entry: 'سند حسابداری',
  journal_line: 'ردیف سند',
  party: 'طرف‌حساب',
  bank_statement_line: 'ردیف صورتحساب بانکی',
  inventory_reconciliation: 'کنترل انبار'
});

const sourceTypeFa = Object.freeze({
  invoice: 'فاکتور',
  receipt: 'دریافت',
  payment: 'پرداخت',
  transfer: 'انتقال',
  manual: 'سند دستی',
  opening: 'افتتاحیه',
  reversal: 'برگشت سند'
});

const financialKindFa = Object.freeze({
  bank: 'حساب بانکی',
  cash: 'صندوق',
  card: 'کارت',
  wallet: 'کیف پول',
  other: 'حساب مالی'
});

export function controlTowerStatusFa(status) {
  return status === 'ready' ? 'آماده' : status === 'attention' ? 'نیازمند رسیدگی' : 'عادی';
}

function metricExplanationFa(metric) {
  const explanations = {
    cash_position: 'این مبلغ، جمع مانده حساب‌های بانکی و صندوق‌های فعال تا تاریخ انتخاب‌شده است.',
    gross_receivables: 'این مبلغ، جمع مطالبات باز از طرف‌حساب‌هاست. طلب و بدهی طرف‌های مختلف با هم تهاتر نشده‌اند.',
    gross_payables: 'این مبلغ، جمع بدهی‌های باز به طرف‌حساب‌هاست. بدهی و طلب طرف‌های مختلف با هم تهاتر نشده‌اند.',
    unresolved_bank_reconciliation: 'این مبلغ، جمع ردیف‌های صورتحساب بانکی است که هنوز با تراکنش‌های ثبت‌شده تطبیق داده نشده‌اند.',
    inventory_control_risks: 'این شاخص، تعداد کنترل‌های انبار و حسابداری است که هنوز مغایرت آن‌ها تعیین تکلیف نشده است.'
  };
  return explanations[metric?.id] || metric?.explanation || 'این شاخص از ثبت‌های معتبر حسابداری شرکت محاسبه شده است.';
}

function metricCard(metric, { count = null } = {}) {
  const value = metric.value === null ? '—' : money(metric.value);
  const status = metric.status === 'attention' ? 'attention' : 'normal';
  return `
    <article class="card avan-control-tower-metric ${status}" data-control-tower-metric="${esc(metric.id)}">
      <div class="avan-control-tower-metric-head">
        <span class="kpi-label">${esc(metric.label)}</span>
        <span class="avan-control-tower-dot" aria-hidden="true"></span>
      </div>
      <div class="kpi-value" data-avan-number-output="1">${value}</div>
      ${count === null ? '' : `<div class="muted">${Number(count).toLocaleString('fa-IR')} مورد باز</div>`}
      <button type="button" class="ghost small" data-control-tower-why="${esc(metric.id)}">چرا این عدد؟</button>
    </article>
  `;
}

function readinessHtml(readiness) {
  const ready = readiness.status === 'ready';
  const blockerLabels = {
    bank_reconciliation_open: 'مغایرت بانکی باز',
    inventory_reconciliation_open: 'مغایرت کنترل انبار',
    receivable_lines_without_party: 'دریافتنی بدون طرف‌حساب',
    payable_lines_without_party: 'پرداختنی بدون طرف‌حساب'
  };
  return `
    <section class="card avan-control-tower-readiness ${ready ? 'ready' : 'attention'}">
      <div class="section-head">
        <div>
          <h2>آمادگی بستن حساب‌ها</h2>
          <span class="muted">در این مرحله امتیاز ساختگی تولید نمی‌شود؛ فقط مانع‌های واقعی نمایش داده می‌شوند.</span>
        </div>
        <span class="cloud-badge">${controlTowerStatusFa(readiness.status)}</span>
      </div>
      ${ready
        ? '<div class="success-box">در کنترل‌های فعلی، مانع باز برای بستن حساب‌ها دیده نشد.</div>'
        : `<div class="avan-control-tower-blockers">${readiness.blockers.map(item => `<span class="summary-pill">${esc(blockerLabels[item] || item)}</span>`).join('')}</div>`}
    </section>
  `;
}

function actionsHtml(actions) {
  return `
    <section class="card avan-control-tower-actions">
      <div class="section-head">
        <div><h2>اقدام‌های اولویت‌دار</h2><span class="muted">پیشنهادهای کنترلی؛ هیچ اقدامی خودکار ثبت یا پرداخت نمی‌شود.</span></div>
        <span class="summary-pill">${Number(actions.length).toLocaleString('fa-IR')} اقدام</span>
      </div>
      ${actions.length ? `<div class="avan-control-tower-action-list">
        ${actions.map(action => `
          <div class="avan-control-tower-action">
            <div><b>${esc(action.title)}</b><span class="muted">${Number(action.count || 0).toLocaleString('fa-IR')} مورد</span></div>
            <button type="button" class="ghost small" data-control-tower-action-evidence="${esc(action.id)}">مشاهده شواهد</button>
          </div>
        `).join('')}
      </div>` : '<div class="success-box">اقدام کنترلی فوری از شاخص‌های فعلی استخراج نشد.</div>'}
    </section>
  `;
}

export function controlTowerPageHtml({ workspace, snapshot }) {
  return `
    <div class="avan-control-tower" data-control-tower-page>
      <section class="card avan-control-tower-hero">
        <div>
          <div class="eyebrow">نمای واقعی · مبتنی بر شواهد</div>
          <h2>برج کنترل مالی</h2>
          <p class="muted">یک نمای مدیریتی از وضعیت مالی «${esc(workspace.name)}»؛ اعداد از دفترکل و زیردفترهای معتبر خوانده می‌شوند و توسط هوش مصنوعی ساخته نشده‌اند.</p>
        </div>
        <form data-control-tower-date-form class="avan-control-tower-date-form">
          <div class="field">
            <label>تا تاریخ</label>
            <input type="date" name="asOf" value="${esc(snapshot.asOf)}" required>
          </div>
          <button type="submit" class="primary">به‌روزرسانی</button>
        </form>
      </section>

      <div class="grid4 avan-control-tower-grid">
        ${metricCard(snapshot.metrics.cash)}
        ${metricCard(snapshot.metrics.receivables)}
        ${metricCard(snapshot.metrics.payables)}
        ${metricCard(snapshot.metrics.bank, { count: snapshot.metrics.bank.count })}
        ${metricCard(snapshot.metrics.inventory, { count: snapshot.metrics.inventory.count })}
      </div>

      ${readinessHtml(snapshot.closeReadiness)}
      ${actionsHtml(snapshot.actions)}
    </div>
  `;
}

let currentResult = null;
let installed = false;

function setControlTowerNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-control-tower-nav]')?.classList.toggle('active', Boolean(active));
}

function idsOf(evidence, type) {
  return [...new Set((evidence || [])
    .filter(ref => ref?.type === type && UUID_RE.test(String(ref?.id || '')))
    .map(ref => String(ref.id)))];
}

async function loadEvidenceDetails(evidence = []) {
  const workspaceId = String(currentResult?.workspace?.id || '');
  const empty = {
    financialById: new Map(), accountById: new Map(), journalById: new Map(),
    partyById: new Map(), bankLineById: new Map()
  };
  if (!C?.select || !UUID_RE.test(workspaceId)) return empty;

  const financialIds = idsOf(evidence, 'financial_account');
  const partyIds = idsOf(evidence, 'party');
  const bankLineIds = idsOf(evidence, 'bank_statement_line');
  const journalIds = new Set(idsOf(evidence, 'journal_entry'));
  for (const ref of evidence || []) {
    if (ref?.type !== 'journal_line') continue;
    const journalId = String(ref.id || '').split(':')[0];
    if (UUID_RE.test(journalId)) journalIds.add(journalId);
  }

  const [financialAccounts, journalEntries, parties, bankLines] = await Promise.all([
    financialIds.length
      ? C.select('financial_accounts', `select=id,ledger_account_id,kind,bank_name&workspace_id=eq.${workspaceId}&id=in.(${financialIds.join(',')})`)
      : Promise.resolve([]),
    journalIds.size
      ? C.select('journal_entries', `select=id,journal_no,entry_date,source_type,description&workspace_id=eq.${workspaceId}&id=in.(${[...journalIds].join(',')})`)
      : Promise.resolve([]),
    partyIds.length
      ? C.select('parties', `select=id,name&workspace_id=eq.${workspaceId}&id=in.(${partyIds.join(',')})`)
      : Promise.resolve([]),
    bankLineIds.length
      ? C.select('bank_statement_lines', `select=id,booking_date,direction,amount,description&workspace_id=eq.${workspaceId}&id=in.(${bankLineIds.join(',')})`)
      : Promise.resolve([])
  ]);

  const ledgerIds = [...new Set((financialAccounts || [])
    .map(row => String(row?.ledger_account_id || ''))
    .filter(id => UUID_RE.test(id)))];
  const accounts = ledgerIds.length
    ? await C.select('accounts', `select=id,code,name&workspace_id=eq.${workspaceId}&id=in.(${ledgerIds.join(',')})`)
    : [];

  return {
    financialById: new Map((financialAccounts || []).map(row => [String(row.id), row])),
    accountById: new Map((accounts || []).map(row => [String(row.id), row])),
    journalById: new Map((journalEntries || []).map(row => [String(row.id), row])),
    partyById: new Map((parties || []).map(row => [String(row.id), row])),
    bankLineById: new Map((bankLines || []).map(row => [String(row.id), row]))
  };
}

function humanEvidenceRef(ref, details) {
  if (ref?.type === 'financial_account') {
    const financial = details.financialById.get(String(ref.id));
    const account = financial?.ledger_account_id ? details.accountById.get(String(financial.ledger_account_id)) : null;
    const kind = financialKindFa[String(financial?.kind || '')] || 'حساب مالی';
    return {
      title: financial?.bank_name ? `${kind} — ${financial.bank_name}` : kind,
      meta: [account?.code ? `کد حساب ${account.code}` : null, account?.name || null].filter(Boolean).join(' · ') || 'حساب مؤثر در این شاخص'
    };
  }

  if (ref?.type === 'journal_entry') {
    const journal = details.journalById.get(String(ref.id));
    return {
      title: journal?.journal_no !== null && journal?.journal_no !== undefined ? `سند حسابداری شماره ${journal.journal_no}` : 'سند حسابداری مؤثر',
      meta: [
        journal?.entry_date ? `تاریخ ${dateFa(String(journal.entry_date).slice(0, 10))}` : null,
        journal?.source_type ? (sourceTypeFa[journal.source_type] || 'ثبت حسابداری') : null,
        journal?.description || null
      ].filter(Boolean).join(' · ') || 'سند مؤثر در محاسبه این شاخص'
    };
  }

  if (ref?.type === 'journal_line') {
    const [journalId, lineNo] = String(ref.id || '').split(':');
    const journal = details.journalById.get(journalId);
    return {
      title: journal?.journal_no !== null && journal?.journal_no !== undefined
        ? `ردیف ${lineNo || 'مرتبط'} از سند شماره ${journal.journal_no}`
        : `ردیف حسابداری ${lineNo || 'مرتبط'}`,
      meta: journal?.entry_date ? `تاریخ سند ${dateFa(String(journal.entry_date).slice(0, 10))}` : 'ردیف نیازمند بررسی در سند حسابداری'
    };
  }

  if (ref?.type === 'party') {
    const party = details.partyById.get(String(ref.id));
    return { title: party?.name || 'طرف‌حساب مرتبط', meta: 'طرف‌حساب مؤثر در مانده دریافتنی یا پرداختنی' };
  }

  if (ref?.type === 'bank_statement_line') {
    const line = details.bankLineById.get(String(ref.id));
    const direction = ['credit', 'in', 'deposit'].includes(String(line?.direction || '').toLowerCase()) ? 'واریز' : 'برداشت';
    return {
      title: line?.booking_date ? `صورتحساب بانکی — ${dateFa(String(line.booking_date).slice(0, 10))}` : 'ردیف صورتحساب بانکی',
      meta: [direction, line?.amount !== undefined ? money(line.amount) : null, line?.description || null].filter(Boolean).join(' · ') || 'ردیف بانکی تطبیق‌داده‌نشده'
    };
  }

  if (ref?.type === 'inventory_reconciliation') {
    return { title: 'کنترل مغایرت انبار و حسابداری', meta: 'این کنترل هنوز به وضعیت تطبیق‌شده نرسیده است.' };
  }

  return { title: evidenceTypeFa[ref?.type] || 'مرجع حسابداری', meta: 'مرجع مؤثر در محاسبه این شاخص' };
}

async function evidenceModal(title, explanation, evidence = []) {
  openModal(`
    <div data-control-tower-evidence-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">شواهد حسابداری</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="info-box">${esc(explanation || 'این شاخص از ثبت‌های معتبر حسابداری شرکت محاسبه شده است.')}</div>
      <div class="loading">در حال آماده‌سازی عنوان حساب‌ها و اسناد…</div>
    </div>
  `);

  let details;
  try {
    details = await loadEvidenceDetails(evidence);
  } catch (error) {
    console.error('[Avan Control Tower evidence]', error);
    details = { financialById: new Map(), accountById: new Map(), journalById: new Map(), partyById: new Map(), bankLineById: new Map() };
  }

  const grouped = new Map();
  evidence.forEach(ref => {
    if (!ref?.type || !ref?.id) return;
    if (!grouped.has(ref.type)) grouped.set(ref.type, []);
    grouped.get(ref.type).push(ref);
  });

  openModal(`
    <div data-control-tower-evidence-modal>
      <div class="section-head"><div><h2>${esc(title)}</h2><span class="muted">شواهد حسابداری</span></div><span class="cloud-badge">قابل ردیابی</span></div>
      <div class="info-box">${esc(explanation || 'این شاخص از ثبت‌های معتبر حسابداری شرکت محاسبه شده است.')}</div>
      <div class="section avan-control-tower-evidence-list">
        ${grouped.size ? [...grouped.entries()].map(([type, refs]) => `
          <div class="card">
            <div class="section-head"><b>${esc(evidenceTypeFa[type] || 'مرجع حسابداری')}</b><span class="muted">${Number(refs.length).toLocaleString('fa-IR')} مرجع</span></div>
            <div class="avan-control-tower-evidence-human-list">
              ${refs.slice(0, 12).map(ref => {
                const human = humanEvidenceRef(ref, details);
                return `<div class="avan-control-tower-evidence-human-row"><b>${esc(human.title)}</b><span class="muted">${esc(human.meta)}</span></div>`;
              }).join('')}
            </div>
            ${refs.length > 12 ? `<span class="muted">و ${Number(refs.length - 12).toLocaleString('fa-IR')} مرجع دیگر</span>` : ''}
          </div>
        `).join('') : '<div class="empty">برای این شاخص در وضعیت فعلی مرجع جزئی وجود ندارد.</div>'}
      </div>
      <div class="form-actions"><button type="button" class="ghost" data-control-tower-close-evidence>بستن</button></div>
    </div>
  `);
  document.querySelector('[data-control-tower-close-evidence]')?.addEventListener('click', closeModal, { once: true });
}

function bindPageActions() {
  const root = document.querySelector('[data-control-tower-page]');
  if (!root || !currentResult) return;

  root.querySelector('[data-control-tower-date-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const asOf = String(data.get('asOf') || '');
    if (!asOf) return toast('تاریخ مبنا را انتخاب کنید.');
    void openControlTower(asOf);
  });

  root.querySelectorAll('[data-control-tower-why]').forEach(button => {
    button.addEventListener('click', () => {
      const metric = Object.values(currentResult.snapshot.metrics).find(item => item.id === button.dataset.controlTowerWhy);
      if (!metric) return;
      void evidenceModal(metric.label, metricExplanationFa(metric), metric.evidence);
    });
  });

  root.querySelectorAll('[data-control-tower-action-evidence]').forEach(button => {
    button.addEventListener('click', () => {
      const action = currentResult.snapshot.actions.find(item => item.id === button.dataset.controlTowerActionEvidence);
      if (!action) return;
      void evidenceModal(action.title, 'این مورد به‌دلیل وجود ثبت یا مغایرت باز در حسابداری نیازمند بررسی است. شواهد مؤثر در ادامه آمده‌اند.', action.evidence);
    });
  });
}

export async function openControlTower(asOf = today()) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    setTitle('برج کنترل مالی');
    setControlTowerNavActive(true);
    page('<div class="loading">در حال ساخت نمای مالی از دفترکل…</div>');
    await MoneyRuntime?.ready?.();
    currentResult = await Service.load({ asOf });
    page(controlTowerPageHtml(currentResult));
    setControlTowerNavActive(true);
    bindPageActions();
    window.dispatchEvent(new CustomEvent('avan:control-tower-rendered', {
      detail: { workspace_id: currentResult.workspace.id, as_of: currentResult.snapshot.asOf }
    }));
    return currentResult;
  } catch (error) {
    console.error('[Avan Control Tower]', error);
    page('<div class="error-box">برج کنترل مالی در این لحظه قابل محاسبه نیست. دوباره تلاش کنید.</div>');
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-control-tower-nav]')) return;
  const label = document.createElement('div');
  label.className = 'nav-label';
  label.dataset.controlTowerNavLabel = '1';
  label.textContent = 'هوشمندی مالی';
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.controlTowerNav = '1';
  button.innerHTML = '<span>◈</span>برج کنترل مالی';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closeModal();
    void openControlTower();
  });
  nav.append(label, button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-control-tower-report-launcher]')) return;
  const card = document.createElement('section');
  card.className = 'card avan-control-tower-report-launcher';
  card.dataset.controlTowerReportLauncher = '1';
  card.innerHTML = `
    <div><b>◈ برج کنترل مالی</b><span class="muted">نقدینگی، مطالبات، بدهی‌ها، مغایرت‌ها و آمادگی بستن در یک نما</span></div>
    <button type="button" class="primary">مشاهده برج کنترل</button>
  `;
  card.querySelector('button')?.addEventListener('click', () => void openControlTower());
  content.prepend(card);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title !== 'برج کنترل مالی') document.querySelector('[data-control-tower-nav]')?.classList.remove('active');
}

export function installControlTowerWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => {
    if (document.querySelector('[data-control-tower-page]')) void openControlTower();
  });
  if (document.getElementById('pageTitle')?.textContent === 'گزارش‌ها') installReportsLauncher();
  window.AvanControlTower = Object.freeze({ open: openControlTower });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installControlTowerWorkspace, { once: true });
  else installControlTowerWorkspace();
}
