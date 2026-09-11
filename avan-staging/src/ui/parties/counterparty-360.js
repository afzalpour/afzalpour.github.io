'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { openModal, closeModal } from '../components/modal.js';
import { buildCounterparty360 } from '../../intelligence/counterparty-360.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const cloud = HAS_BROWSER ? installAvanCloud() : null;
const KIND_FA = Object.freeze({ customer: 'مشتری', vendor: 'فروشنده', both: 'مشتری و فروشنده', other: 'سایر' });
const ENTITY_FA = Object.freeze({ individual: 'شخص حقیقی', legal: 'شخص حقوقی', unspecified: 'تعیین‌نشده' });
const INVOICE_TYPE_FA = Object.freeze({ sale: 'فروش', purchase: 'خرید' });
const STATUS_FA = Object.freeze({ draft: 'پیش‌نویس', posted: 'ثبت‌شده', reversed: 'برگشتی', cancelled: 'لغوشده' });

let installed = false;
let scheduled = 0;
let context = null;
let contextInflight = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${value}T12:00:00`));
  } catch {
    return String(value);
  }
}

function money(value) {
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0')) || String(value ?? '0');
}

function pageIsParties() {
  return String(document.getElementById('pageTitle')?.textContent || '').trim() === 'طرف‌حساب‌ها';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function workspaceQuery(fields, workspaceId, suffix = '') {
  return `select=${fields}&workspace_id=eq.${workspaceId}${suffix ? `&${suffix}` : ''}`;
}

function addButtons() {
  if (!pageIsParties()) return;
  document.querySelectorAll('tr[data-party-master-row]').forEach(row => {
    if (row.querySelector('[data-counterparty-360]')) return;
    const partyId = String(row.dataset.partyMasterRow || '').trim();
    if (!partyId) return;
    const cell = row.lastElementChild;
    if (!cell) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost small avan-counterparty-360-button';
    button.dataset.counterparty360 = partyId;
    button.textContent = 'نمای ۳۶۰';
    cell.append(' ', button);
  });
}

function scheduleButtons() {
  if (scheduled) return;
  scheduled = requestAnimationFrame(() => {
    scheduled = 0;
    addButtons();
  });
}

async function loadContext() {
  const company = await cloud.companyContext.ensure();
  if (company?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspaceId = company?.active_company?.id;
  if (!workspaceId) throw new Error('COMPANY_REQUIRED');
  const asOf = todayIso();
  if (context?.workspaceId === workspaceId && context?.asOf === asOf) return context;
  if (contextInflight) return contextInflight;

  contextInflight = (async () => {
    const fiscalRows = await cloud.select(
      'fiscal_years',
      workspaceQuery('id,date_from,date_to', workspaceId, 'order=date_from.desc&limit=1')
    );
    const fiscalFrom = fiscalRows?.[0]?.date_from;
    if (!fiscalFrom) throw new Error('FISCAL_YEAR_REQUIRED');

    const [roleRows, accounts, parties, entries, lines, invoices] = await Promise.all([
      cloud.select('account_roles', workspaceQuery('role_key,account_id', workspaceId)),
      cloud.select('accounts', workspaceQuery('id,code,name,category,is_active,is_postable', workspaceId, 'order=code.asc')),
      cloud.select('parties', workspaceQuery('id,name,kind,entity_type,legal_name,national_id,registration_no,economic_code,tax_id,phone,email,postal_code,province,city,address,contact_name,website,is_active', workspaceId, 'order=name.asc')),
      cloud.select('journal_entries', workspaceQuery('id,journal_no,entry_date,status,source_type,source_id,description', workspaceId, `entry_date=lte.${asOf}&order=entry_date.asc,journal_no.asc.nullslast`)),
      cloud.select('journal_lines', workspaceQuery('id,journal_entry_id,line_no,account_id,party_id,description,debit,credit', workspaceId, 'order=journal_entry_id.asc,line_no.asc')),
      cloud.select('invoices', workspaceQuery('id,invoice_no,invoice_type,invoice_date,due_date,party_id,status,journal_entry_id,reversal_journal_entry_id,total_amount', workspaceId, `invoice_date=lte.${asOf}&order=invoice_date.asc,invoice_no.asc.nullslast`))
    ]);

    const roles = Object.fromEntries((roleRows || [])
      .filter(row => row?.role_key && row?.account_id)
      .map(row => [row.role_key, row.account_id]));

    context = Object.freeze({
      workspaceId,
      asOf,
      fiscalFrom,
      roles,
      accounts: accounts || [],
      parties: parties || [],
      entries: entries || [],
      lines: lines || [],
      invoices: invoices || []
    });
    return context;
  })();

  try { return await contextInflight; }
  finally { contextInflight = null; }
}

function profileValue(label, value) {
  return `<div class="avan-c360-profile-item"><span>${esc(label)}</span><b>${esc(value || '—')}</b></div>`;
}

function openItemsTable(title, items) {
  const rows = (items || []).slice(0, 12).map(item => `
    <tr>
      <td>${esc(item.journalNo ?? '—')}</td>
      <td>${esc(dateFa(item.entryDate))}</td>
      <td>${esc(dateFa(item.dueDate))}</td>
      <td>${Number(item.daysPastDue || 0).toLocaleString('fa-IR')}</td>
      <td class="num">${esc(money(item.remaining))}</td>
    </tr>
  `).join('');
  return `
    <section class="avan-c360-block">
      <h3>${esc(title)}</h3>
      ${rows ? `<div class="avan-c360-table-wrap"><table><thead><tr><th>سند مبنا</th><th>تاریخ</th><th>سررسید</th><th>روز تأخیر</th><th>مانده باز</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">قلم بازی وجود ندارد.</div>'}
    </section>`;
}

function invoicesTable(snapshot) {
  const rows = snapshot.invoices.slice(0, 10).map(invoice => `
    <tr>
      <td>${esc(invoice.invoiceNo ?? '—')}</td>
      <td>${esc(INVOICE_TYPE_FA[invoice.invoiceType] || invoice.invoiceType || '—')}</td>
      <td>${esc(dateFa(invoice.invoiceDate))}</td>
      <td>${esc(dateFa(invoice.dueDate))}</td>
      <td>${esc(STATUS_FA[invoice.status] || invoice.status || '—')}</td>
      <td class="num">${esc(money(invoice.totalAmount))}</td>
    </tr>
  `).join('');
  return `<section class="avan-c360-block"><h3>آخرین فاکتورها</h3>${rows ? `<div class="avan-c360-table-wrap"><table><thead><tr><th>شماره</th><th>نوع</th><th>تاریخ</th><th>سررسید</th><th>وضعیت</th><th>مبلغ</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">فاکتوری برای این طرف‌حساب ثبت نشده است.</div>'}</section>`;
}

function ledgerTable(snapshot) {
  const rows = [...snapshot.ledger.rows].reverse().slice(0, 12).map(row => `
    <tr>
      <td>${esc(row.journalNo ?? '—')}</td>
      <td>${esc(dateFa(row.entryDate))}</td>
      <td>${esc(row.accountCode)} — ${esc(row.accountName)}</td>
      <td>${esc(row.description || '—')}</td>
      <td class="num">${esc(money(row.debit))}</td>
      <td class="num">${esc(money(row.credit))}</td>
      <td class="num" data-avan-accounting-negative>${esc(money(row.runningNet))}</td>
    </tr>
  `).join('');
  return `<section class="avan-c360-block"><h3>آخرین گردش‌های دفتر طرف‌حساب</h3>${rows ? `<div class="avan-c360-table-wrap"><table><thead><tr><th>سند</th><th>تاریخ</th><th>حساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده جاری</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">گردش دریافتنی/پرداختنی در این دوره وجود ندارد.</div>'}</section>`;
}

function evidenceTable(snapshot) {
  const rows = snapshot.evidence.slice(0, 15).map(entry => `
    <tr><td>${esc(entry.journalNo ?? '—')}</td><td>${esc(dateFa(entry.entryDate))}</td><td>${esc(entry.description || entry.sourceType || '—')}</td></tr>
  `).join('');
  return `<section class="avan-c360-block"><h3>شواهد و اسناد مؤثر</h3>${rows ? `<div class="avan-c360-table-wrap"><table><thead><tr><th>شماره سند</th><th>تاریخ</th><th>شرح/منبع</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">سند مؤثری در دوره جاری وجود ندارد.</div>'}</section>`;
}

function risksHtml(snapshot) {
  if (!snapshot.risks.length) return '<span class="badge avan-c360-risk-ok">مورد قابل توجهی شناسایی نشد</span>';
  return snapshot.risks.map(risk => `<span class="badge avan-c360-risk">${esc(risk.label)}</span>`).join(' ');
}

function modalHtml(snapshot) {
  const p = snapshot.party;
  const f = snapshot.financial;
  const missing = p.missingFields.length ? p.missingFields.join('، ') : '—';
  return `
    <div class="avan-counterparty-360" data-counterparty-360-modal data-party-id="${esc(p.id)}">
      <div class="section-head avan-c360-head">
        <div>
          <h2>نمای ۳۶۰ — ${esc(p.name)}</h2>
          <div class="avan-c360-badges"><span class="badge">${esc(KIND_FA[p.kind] || 'سایر')}</span><span class="badge">${esc(ENTITY_FA[p.entityType] || 'تعیین‌نشده')}</span><span class="cloud-badge">Ledger + Evidence</span></div>
        </div>
        <button type="button" class="ghost" id="avanCounterparty360Close">بستن</button>
      </div>

      <div class="info-box section">مطالبات و بدهی‌های این طرف‌حساب عمداً جدا نمایش داده می‌شوند و به‌صورت خودکار با هم تهاتر نمی‌شوند. تمام اعداد از Ledger و FIFO دقیق یک‌ریالی خوانده می‌شوند.</div>

      <section class="avan-c360-kpis section">
        <div class="card"><div class="kpi-label">مطالبه باز</div><div class="kpi-value">${esc(money(f.receivable))}</div></div>
        <div class="card"><div class="kpi-label">مطالبه سررسیدگذشته</div><div class="kpi-value ${f.overdueReceivable !== '0' ? 'neg' : ''}">${esc(money(f.overdueReceivable))}</div></div>
        <div class="card"><div class="kpi-label">بدهی باز</div><div class="kpi-value">${esc(money(f.payable))}</div></div>
        <div class="card"><div class="kpi-label">بدهی سررسیدگذشته</div><div class="kpi-value ${f.overduePayable !== '0' ? 'neg' : ''}">${esc(money(f.overduePayable))}</div></div>
      </section>

      <section class="avan-c360-block">
        <div class="section-head"><div><h3>پرونده هویتی و مالیاتی</h3><span class="muted">آخرین فعالیت: ${esc(dateFa(snapshot.lastActivityDate))} · قدیمی‌ترین سررسید باز: ${esc(dateFa(f.oldestDueDate))}</span></div></div>
        <div class="avan-c360-profile-grid">
          ${profileValue('نام رسمی/حقوقی', p.legalName)}
          ${profileValue('کد ملی/شناسه ملی', p.nationalId)}
          ${profileValue('شماره ثبت', p.registrationNo)}
          ${profileValue('کد اقتصادی', p.economicCode)}
          ${profileValue('شناسه مالیاتی', p.taxId)}
          ${profileValue('تلفن', p.phone)}
          ${profileValue('ایمیل', p.email)}
          ${profileValue('کدپستی', p.postalCode)}
          ${profileValue('استان / شهر', [p.province, p.city].filter(Boolean).join(' / '))}
          ${profileValue('مسئول تماس', p.contactName)}
          ${profileValue('وب‌سایت', p.website)}
          ${profileValue('فیلدهای نیازمند تکمیل', missing)}
        </div>
        <div class="avan-c360-address"><span>آدرس</span><b>${esc(p.address || '—')}</b></div>
      </section>

      <section class="avan-c360-block"><h3>کنترل و ریسک قطعی</h3><div class="avan-c360-risk-list">${risksHtml(snapshot)}</div></section>
      ${openItemsTable('اقلام باز مطالبات', f.receivableOpenItems)}
      ${openItemsTable('اقلام باز بدهی‌ها', f.payableOpenItems)}
      ${invoicesTable(snapshot)}
      ${ledgerTable(snapshot)}
      ${evidenceTable(snapshot)}
    </div>`;
}

async function openCounterparty360(partyId) {
  await MoneyRuntime?.ready?.();
  const ctx = await loadContext();
  const party = ctx.parties.find(item => String(item.id) === String(partyId));
  if (!party) throw new Error('COUNTERPARTY_360_PARTY_NOT_FOUND');
  const snapshot = buildCounterparty360({
    party,
    roles: ctx.roles,
    accounts: ctx.accounts,
    entries: ctx.entries,
    lines: ctx.lines,
    invoices: ctx.invoices,
    fiscalFrom: ctx.fiscalFrom,
    asOf: ctx.asOf
  });
  openModal(modalHtml(snapshot));
  document.getElementById('avanCounterparty360Close')?.addEventListener('click', closeModal, { once: true });
  window.AvanAccountingNegative?.project?.();
  return snapshot;
}

function handleClick(event) {
  const button = event.target?.closest?.('[data-counterparty-360]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const partyId = button.dataset.counterparty360;
  if (!partyId || button.disabled) return;
  button.disabled = true;
  openCounterparty360(partyId)
    .catch(error => {
      console.warn('[Counterparty 360]', error);
      openModal('<h2>نمای ۳۶۰ طرف‌حساب</h2><div class="error-box">اطلاعات ۳۶۰ این طرف‌حساب در حال حاضر قابل بارگذاری نیست.</div><div class="form-actions"><button type="button" class="ghost" id="avanCounterparty360Close">بستن</button></div>');
      document.getElementById('avanCounterparty360Close')?.addEventListener('click', closeModal, { once: true });
    })
    .finally(() => { button.disabled = false; });
}

function invalidate() {
  context = null;
  contextInflight = null;
  scheduleButtons();
}

export function installCounterparty360() {
  if (!HAS_BROWSER || installed) return false;
  installed = true;
  document.addEventListener('click', handleClick, true);
  window.addEventListener('avan:page-rendered', scheduleButtons);
  window.addEventListener('avan:company-context-changed', invalidate);
  window.addEventListener('avan:company-context-cleared', invalidate);
  const content = document.getElementById('content');
  if (content) new MutationObserver(scheduleButtons).observe(content, { childList: true, subtree: true });
  scheduleButtons();
  window.AvanCounterparty360 = Object.freeze({
    open: openCounterparty360,
    refresh: invalidate,
    readOnly: true,
    oneRialExact: true
  });
  return true;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCounterparty360, { once: true });
  } else {
    installCounterparty360();
  }
}
