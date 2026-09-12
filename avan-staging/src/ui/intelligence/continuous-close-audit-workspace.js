'use strict';

import './intelligence-print-export.js';
import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createContinuousCloseAuditService } from '../../application/intelligence/continuous-close-audit-service.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;
const Service = HAS_BROWSER ? createContinuousCloseAuditService({ cloud: C }) : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_FA = Object.freeze({ ready: 'آماده', attention: 'نیازمند رسیدگی', blocked: 'مسدود' });
const SEVERITY_FA = Object.freeze({ critical: 'بحرانی', high: 'بالا', medium: 'متوسط', low: 'پایین' });
const CATEGORY_FA = Object.freeze({
  integrity: 'یکپارچگی', close_readiness: 'آمادگی بستن دوره', duplicate: 'ثبت مشابه', anomaly: 'ناهنجاری'
});
const EVIDENCE_TYPE_FA = Object.freeze({
  journal_entry: 'سند حسابداری', journal_line: 'ردیف سند', invoice: 'فاکتور',
  document: 'سند هوشمند', financial_transaction: 'عملیات مالی', party: 'طرف‌حساب',
  bank_statement_line: 'ردیف صورتحساب بانکی', inventory_reconciliation: 'کنترل انبار',
  integrity_control: 'کنترل یکپارچگی'
});
const TX_TYPE_FA = Object.freeze({ receipt: 'دریافت', payment: 'پرداخت', transfer: 'انتقال' });
const DOCUMENT_STATUS_FA = Object.freeze({
  uploaded: 'بارگذاری‌شده', extracted: 'استخراج‌شده', reviewed: 'بازبینی‌شده',
  posted: 'ثبت‌شده', rejected: 'ردشده'
});
const USER_TEXT_REPLACEMENTS = Object.freeze([
  ['Close Readiness', 'آمادگی بستن دوره'],
  ['Exception Register', 'فهرست موارد نیازمند بررسی'],
  ['Continuous Close', 'بستن مستمر دوره'],
  ['Continuous Audit', 'حسابرسی مستمر'],
  ['Reconciliation', 'تطبیق و مغایرت‌گیری'],
  ['Duplicate', 'ثبت تکراری'],
  ['Integrity', 'یکپارچگی'],
  ['Anomaly', 'ناهنجاری'],
  ['read-only', 'فقط‌خواندنی'],
  ['reconciled', 'تطبیق‌شده'],
  ['Posted', 'ثبت‌شده'],
  ['Draft', 'پیش‌نویس'],
  ['party_id', 'طرف‌حساب'],
  ['Journal', 'سند حسابداری'],
  ['Ledger', 'دفتر کل'],
  ['RPC', 'کنترل پایگاه داده'],
  ['Close', 'بستن دوره'],
  ['Audit', 'حسابرسی']
]);

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const faText = value => USER_TEXT_REPLACEMENTS.reduce(
  (text, [from, to]) => text.split(from).join(to),
  String(value ?? '')
);

function today() { return new Date().toISOString().slice(0, 10); }
function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${String(value).slice(0, 10)}T12:00:00`));
  } catch { return String(value); }
}
function money(value) {
  if (value === null || value === undefined) return '—';
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value), { withUnit: true }) || String(value);
}

function severityBadge(severity) {
  return `<span class="avan-cca-severity ${esc(severity)}">${esc(SEVERITY_FA[severity] || severity)}</span>`;
}

function summaryCards(summary) {
  return `<div class="grid4 avan-cca-summary">
    <article class="card"><span class="kpi-label">کنترل بازِ بستن دوره</span><div class="kpi-value">${Number(summary.closeControlsOpen || 0).toLocaleString('fa-IR')}</div></article>
    <article class="card"><span class="kpi-label">کل موارد نیازمند بررسی</span><div class="kpi-value">${Number(summary.total || 0).toLocaleString('fa-IR')}</div></article>
    <article class="card"><span class="kpi-label">بحرانی</span><div class="kpi-value">${Number(summary.critical || 0).toLocaleString('fa-IR')}</div></article>
    <article class="card"><span class="kpi-label">ریسک بالا</span><div class="kpi-value">${Number(summary.high || 0).toLocaleString('fa-IR')}</div></article>
  </div>`;
}

function closeControlsHtml(snapshot) {
  const controls = snapshot.close.controls || [];
  return `<section class="card avan-cca-section">
    <div class="section-head">
      <div><h2>آمادگی بستن دوره</h2><span class="muted">کنترل‌های قطعی تا ${dateFa(snapshot.asOf)}؛ بدون امتیاز ساختگی</span></div>
      <span class="cloud-badge avan-cca-status ${esc(snapshot.close.status)}">${esc(STATUS_FA[snapshot.close.status] || snapshot.close.status)}</span>
    </div>
    ${snapshot.close.alreadyClosed ? '<div class="info-box">دوره‌ای شامل تاریخ انتخاب‌شده قبلاً بسته شده است؛ این نما فقط برای کنترل و حسابرسی است و چیزی را تغییر نمی‌دهد.</div>' : ''}
    ${controls.length ? `<div class="avan-cca-table-wrap"><table>
      <thead><tr><th>سطح</th><th>کنترل</th><th>توضیح</th><th>تعداد</th><th>شواهد</th></tr></thead>
      <tbody>${controls.map(item => `<tr>
        <td>${severityBadge(item.severity)}</td>
        <td><b>${esc(faText(item.title))}</b></td>
        <td>${esc(faText(item.description))}</td>
        <td>${Number(item.count || 0).toLocaleString('fa-IR')}</td>
        <td><button type="button" class="ghost small" data-cca-evidence="control:${esc(item.id)}">مشاهده شواهد</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="success-box">در کنترل‌های فعلی، مانع بازی برای بستن دوره دیده نشد.</div>'}
  </section>`;
}

function exceptionRegisterHtml(snapshot) {
  const exceptions = snapshot.audit.exceptions || [];
  return `<section class="card avan-cca-section" id="avanCcaExceptionRegister">
    <div class="section-head">
      <div><h2>فهرست موارد نیازمند بررسی</h2><span class="muted">کنترل‌های یکپارچگی، ثبت‌های مشابه، مغایرت‌ها و ناهنجاری‌ها در یک فهرست قابل ردیابی</span></div>
      <span class="summary-pill">${Number(exceptions.length).toLocaleString('fa-IR')} مورد</span>
    </div>
    ${exceptions.length ? `<div class="avan-cca-table-wrap"><table>
      <thead><tr><th>سطح</th><th>دسته</th><th>مورد</th><th>توضیح</th><th>مقدار</th><th>شواهد</th></tr></thead>
      <tbody>${exceptions.map(item => `<tr>
        <td>${severityBadge(item.severity)}</td>
        <td>${esc(CATEGORY_FA[item.category] || faText(item.category))}</td>
        <td><b>${esc(faText(item.title))}</b>${item.count > 1 ? `<span class="muted avan-cca-count">${Number(item.count).toLocaleString('fa-IR')} مورد</span>` : ''}</td>
        <td>${esc(faText(item.description))}</td>
        <td class="num">${item.value === null || item.value === undefined ? '—' : money(item.value)}</td>
        <td><button type="button" class="ghost small" data-cca-evidence="exception:${esc(item.id)}">مشاهده شواهد</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<div class="success-box">در کنترل‌های فعلی، مورد بازی برای بررسی شناسایی نشد.</div>'}
    <div class="info-box section">هشدار ثبت مشابه یا رفتار غیرعادی به معنی خطا، تقلب یا تخلف قطعی نیست. آوان فقط موارد قابل بررسی و شواهد مرتبط را نشان می‌دهد؛ تصمیم درباره اصلاح ثبت یا بستن دوره با کاربر و حسابدار است.</div>
  </section>`;
}

export function continuousCloseAuditPageHtml({ workspace, snapshot }) {
  return `<div class="avan-cca" data-continuous-close-audit-page>
    <section class="card avan-cca-hero">
      <div>
        <div class="eyebrow">کنترل مستمر بستن دوره و حسابرسی</div>
        <h2>بستن و حسابرسی پیوسته</h2>
        <p class="muted">آمادگی بستن دوره و موارد نیازمند بررسی حسابرسی «${esc(workspace.name)}» بر پایه دفتر کل و زیردفترهای معتبر؛ فقط‌خواندنی، با دقت یک ریال و قابل ردیابی.</p>
      </div>
      <form data-cca-date-form class="avan-cca-date-form">
        <div class="field"><label>تا تاریخ</label><input type="date" name="asOf" value="${esc(snapshot.asOf)}" required></div>
        <button type="submit" class="primary">اجرای کنترل‌ها</button>
      </form>
    </section>
    ${summaryCards(snapshot.audit.summary)}
    ${closeControlsHtml(snapshot)}
    ${exceptionRegisterHtml(snapshot)}
  </div>`;
}

let currentResult = null;
let installed = false;

function evidenceIds(evidence, type) {
  const ids = [];
  for (const ref of evidence || []) {
    if (ref?.type !== type) continue;
    const id = String(ref.id || '');
    if (UUID_RE.test(id)) ids.push(id);
  }
  return [...new Set(ids)];
}

function journalIdsFromEvidence(evidence) {
  const ids = new Set(evidenceIds(evidence, 'journal_entry'));
  for (const ref of evidence || []) {
    if (ref?.type !== 'journal_line') continue;
    const journalId = String(ref.id || '').split(':')[0];
    if (UUID_RE.test(journalId)) ids.add(journalId);
  }
  return [...ids];
}

async function loadEvidenceDetails(evidence) {
  const wid = String(currentResult?.workspace?.id || '');
  const empty = { journals: new Map(), invoices: new Map(), documents: new Map(), transactions: new Map(), parties: new Map(), bankLines: new Map() };
  if (!UUID_RE.test(wid)) return empty;

  const journalIds = journalIdsFromEvidence(evidence);
  const invoiceIds = evidenceIds(evidence, 'invoice');
  const documentIds = evidenceIds(evidence, 'document');
  const transactionIds = evidenceIds(evidence, 'financial_transaction');
  const partyIds = evidenceIds(evidence, 'party');
  const bankLineIds = evidenceIds(evidence, 'bank_statement_line');

  const [journals, invoices, documents, transactions, parties, bankLines] = await Promise.all([
    journalIds.length ? C.select('journal_entries', `select=id,journal_no,entry_date,source_type,description&workspace_id=eq.${wid}&id=in.(${journalIds.join(',')})`) : [],
    invoiceIds.length ? C.select('invoices', `select=id,invoice_no,invoice_type,invoice_date,total_amount,description&workspace_id=eq.${wid}&id=in.(${invoiceIds.join(',')})`) : [],
    documentIds.length ? C.select('documents', `select=id,file_name,document_type,status,source_document_date,total_amount&workspace_id=eq.${wid}&id=in.(${documentIds.join(',')})`) : [],
    transactionIds.length ? C.select('financial_transactions', `select=id,tx_date,tx_type,amount,description&workspace_id=eq.${wid}&id=in.(${transactionIds.join(',')})`) : [],
    partyIds.length ? C.select('parties', `select=id,name&workspace_id=eq.${wid}&id=in.(${partyIds.join(',')})`) : [],
    bankLineIds.length ? C.select('bank_statement_lines', `select=id,booking_date,direction,amount,description,reference_no&workspace_id=eq.${wid}&id=in.(${bankLineIds.join(',')})`) : []
  ]);

  return {
    journals: new Map((journals || []).map(row => [String(row.id), row])),
    invoices: new Map((invoices || []).map(row => [String(row.id), row])),
    documents: new Map((documents || []).map(row => [String(row.id), row])),
    transactions: new Map((transactions || []).map(row => [String(row.id), row])),
    parties: new Map((parties || []).map(row => [String(row.id), row])),
    bankLines: new Map((bankLines || []).map(row => [String(row.id), row]))
  };
}

function humanEvidence(ref, details) {
  const id = String(ref?.id || '');
  if (ref?.type === 'journal_entry') {
    const row = details.journals.get(id);
    return { title: row?.journal_no !== null && row?.journal_no !== undefined ? `سند حسابداری شماره ${row.journal_no}` : 'سند حسابداری مؤثر', meta: [row?.entry_date ? dateFa(row.entry_date) : null, row?.description].filter(Boolean).join(' · ') || 'ثبت حسابداری مرتبط' };
  }
  if (ref?.type === 'journal_line') {
    const [journalId, lineNo] = id.split(':');
    const row = details.journals.get(journalId);
    return { title: row?.journal_no !== null && row?.journal_no !== undefined ? `ردیف ${lineNo || 'مرتبط'} از سند شماره ${row.journal_no}` : 'ردیف حسابداری مرتبط', meta: row?.entry_date ? dateFa(row.entry_date) : 'کنترل حساب کنترلی' };
  }
  if (ref?.type === 'invoice') {
    const row = details.invoices.get(id);
    return { title: row?.invoice_no !== null && row?.invoice_no !== undefined ? `فاکتور شماره ${row.invoice_no}` : 'فاکتور مرتبط', meta: [row?.invoice_date ? dateFa(row.invoice_date) : null, row?.total_amount !== undefined ? money(row.total_amount) : null, row?.description].filter(Boolean).join(' · ') || 'فاکتور مؤثر در کنترل' };
  }
  if (ref?.type === 'document') {
    const row = details.documents.get(id);
    const status = DOCUMENT_STATUS_FA[row?.status] || row?.status;
    return { title: row?.file_name || 'سند هوشمند مرتبط', meta: [row?.source_document_date ? dateFa(row.source_document_date) : null, status ? `وضعیت ${status}` : null].filter(Boolean).join(' · ') || 'سند ورودی مرتبط' };
  }
  if (ref?.type === 'financial_transaction') {
    const row = details.transactions.get(id);
    const txType = TX_TYPE_FA[row?.tx_type] || row?.tx_type;
    return { title: row?.tx_date ? `عملیات مالی ${dateFa(row.tx_date)}` : 'عملیات مالی مرتبط', meta: [txType || null, row?.amount !== undefined ? money(row.amount) : null, row?.description].filter(Boolean).join(' · ') || 'عملیات مؤثر در هشدار' };
  }
  if (ref?.type === 'party') {
    const row = details.parties.get(id);
    return { title: row?.name || 'طرف‌حساب مرتبط', meta: 'طرف‌حساب مؤثر در کنترل' };
  }
  if (ref?.type === 'bank_statement_line') {
    const row = details.bankLines.get(id);
    return { title: row?.booking_date ? `صورتحساب بانکی — ${dateFa(row.booking_date)}` : 'ردیف صورتحساب بانکی', meta: [row?.amount !== undefined ? money(row.amount) : null, row?.reference_no || null, row?.description].filter(Boolean).join(' · ') || 'مغایرت بانکی باز' };
  }
  if (ref?.type === 'inventory_reconciliation') return { title: 'کنترل مغایرت انبار و حسابداری', meta: 'فرایند تطبیق هنوز کامل نشده است.' };
  if (ref?.type === 'integrity_control') return { title: 'کنترل یکپارچگی دفتر کل و فاکتور', meta: 'نتیجه کنترل معتبر پایگاه داده' };
  return { title: EVIDENCE_TYPE_FA[ref?.type] || 'مرجع حسابداری', meta: 'مرجع مؤثر در این کنترل' };
}

function evidenceRowsHtml(evidence, details) {
  if (!evidence.length) return '<div class="empty">این کنترل از نتیجه تجمیعی معتبر به‌دست آمده و مرجع ردیفی جداگانه ندارد.</div>';
  return evidence.slice(0, 30).map(ref => {
    const item = humanEvidence(ref, details);
    return `<div class="avan-cca-evidence-row"><b>${esc(item.title)}</b><span class="muted">${esc(item.meta)}</span></div>`;
  }).join('');
}

async function evidenceModal(title, description, evidence = []) {
  openModal(`<div data-cca-evidence-modal data-avan-money-unit-badge="suppress">
    <div class="section-head"><div><h2>${esc(faText(title))}</h2><span class="muted">شواهد حسابداری</span></div><span class="cloud-badge">قابل ردیابی</span></div>
    <div class="info-box">${esc(faText(description))}</div>
    <div class="section avan-cca-evidence-list" data-cca-evidence-body><div class="loading">در حال آماده‌سازی شواهد…</div></div>
    <div class="form-actions"><button type="button" class="ghost" data-cca-close-evidence>بستن</button></div>
  </div>`);
  document.querySelector('[data-cca-close-evidence]')?.addEventListener('click', closeModal, { once: true });

  let details;
  try { details = await loadEvidenceDetails(evidence); }
  catch (error) {
    console.error('[Avan Continuous Close/Audit evidence]', error);
    details = { journals: new Map(), invoices: new Map(), documents: new Map(), transactions: new Map(), parties: new Map(), bankLines: new Map() };
  }

  const modalRoot = document.querySelector('[data-cca-evidence-modal]');
  const body = modalRoot?.querySelector('[data-cca-evidence-body]');
  if (!body) return;
  body.innerHTML = evidenceRowsHtml(evidence, details);
  if (evidence.length > 30) {
    body.insertAdjacentHTML('afterend', `<div class="muted">و ${Number(evidence.length - 30).toLocaleString('fa-IR')} مرجع دیگر</div>`);
  }
}

function bindPageActions() {
  const root = document.querySelector('[data-continuous-close-audit-page]');
  if (!root || !currentResult) return;
  root.querySelector('[data-cca-date-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const asOf = String(new FormData(event.currentTarget).get('asOf') || '');
    if (!asOf) return toast('تاریخ مبنا را انتخاب کنید.');
    void openContinuousCloseAudit(asOf);
  });
  root.querySelectorAll('[data-cca-evidence]').forEach(button => button.addEventListener('click', () => {
    const [kind, id] = String(button.dataset.ccaEvidence || '').split(':');
    const item = kind === 'control'
      ? currentResult.snapshot.close.controls.find(row => row.id === id)
      : currentResult.snapshot.audit.exceptions.find(row => row.id === id);
    if (item) void evidenceModal(item.title, item.description, item.evidence || []);
  }));
}

function setNavActive(active) {
  document.querySelectorAll('#nav button.active').forEach(button => button.classList.remove('active'));
  document.querySelector('[data-continuous-close-audit-nav]')?.classList.toggle('active', Boolean(active));
}

export async function openContinuousCloseAudit(asOf = today()) {
  if (!HAS_BROWSER || !Service) return null;
  try {
    setTitle('بستن و حسابرسی پیوسته');
    setNavActive(true);
    page('<div class="loading">در حال اجرای کنترل‌های بستن دوره و حسابرسی…</div>');
    await MoneyRuntime?.ready?.();
    currentResult = await Service.load({ asOf });
    page(continuousCloseAuditPageHtml(currentResult));
    setNavActive(true);
    bindPageActions();
    window.dispatchEvent(new CustomEvent('avan:continuous-close-audit-rendered', { detail: { workspace_id: currentResult.workspace.id, as_of: currentResult.snapshot.asOf } }));
    return currentResult;
  } catch (error) {
    console.error('[Avan Continuous Close/Audit]', error);
    page('<div class="error-box">کنترل‌های بستن و حسابرسی پیوسته در این لحظه قابل محاسبه نیستند. دوباره تلاش کنید.</div>');
    return null;
  }
}

function installSidebarEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-continuous-close-audit-nav]')) return;
  if (!nav.querySelector('[data-control-tower-nav-label]')) {
    const label = document.createElement('div'); label.className = 'nav-label'; label.textContent = 'هوشمندی مالی'; nav.append(label);
  }
  const button = document.createElement('button');
  button.type = 'button'; button.dataset.continuousCloseAuditNav = '1'; button.innerHTML = '<span>✓</span>بستن و حسابرسی پیوسته';
  button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); closeModal(); void openContinuousCloseAudit(); });
  nav.append(button);
}

function installReportsLauncher() {
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-cca-report-launcher]')) return;
  const card = document.createElement('section');
  card.className = 'card avan-cca-report-launcher'; card.dataset.ccaReportLauncher = '1';
  card.innerHTML = '<div><b>✓ بستن و حسابرسی پیوسته</b><span class="muted">آمادگی بستن دوره و فهرست موارد نیازمند بررسی، همراه با شواهد حسابداری</span></div><button type="button" class="primary">اجرای کنترل‌ها</button>';
  card.querySelector('button')?.addEventListener('click', () => void openContinuousCloseAudit());
  content.prepend(card);
}

function onPageRendered(event) {
  const title = String(event?.detail?.title || document.getElementById('pageTitle')?.textContent || '');
  if (title === 'گزارش‌ها') installReportsLauncher();
  if (title !== 'بستن و حسابرسی پیوسته') document.querySelector('[data-continuous-close-audit-nav]')?.classList.remove('active');
}

export function installContinuousCloseAuditWorkspace() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  installSidebarEntry();
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-context-changed', () => {
    if (document.querySelector('[data-continuous-close-audit-page]')) void openContinuousCloseAudit();
  });
  if (document.getElementById('pageTitle')?.textContent === 'گزارش‌ها') installReportsLauncher();
  window.AvanContinuousCloseAudit = Object.freeze({ open: openContinuousCloseAudit });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installContinuousCloseAuditWorkspace, { once: true });
  else installContinuousCloseAuditWorkspace();
}
