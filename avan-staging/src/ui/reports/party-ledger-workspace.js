'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';
import { buildPartyLedger } from '../../reports/party-ledger.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const C = HAS_BROWSER ? installAvanCloud() : null;

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
  return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0')) || '—';
}

function sourceLabel(type) {
  const map = {
    receipt: 'دریافت',
    payment: 'پرداخت',
    transfer: 'انتقال',
    sale_invoice: 'فاکتور فروش',
    purchase_invoice: 'فاکتور خرید',
    invoice_sale: 'فاکتور فروش',
    invoice_purchase: 'فاکتور خرید',
    reversal: 'برگشت سند',
    manual: 'سند دستی'
  };
  return map[type] || 'سند حسابداری';
}

function positionClass(net) {
  const raw = String(net ?? '0').replace('−', '-');
  if (raw.startsWith('-')) return 'neg';
  if (raw !== '0' && raw !== '0.0') return 'pos';
  return '';
}

function positionText(ledger, partyName) {
  const net = String(ledger.closing.net || '0');
  if (net.startsWith('-')) return `در پایان بازه، ما به «${partyName}» بدهکاریم.`;
  if (net !== '0' && net !== '0.0') return `در پایان بازه، ما از «${partyName}» طلبکاریم.`;
  return `در پایان بازه، وضعیت خالص با «${partyName}» تسویه است.`;
}

function partyLedgerHtml({ party, ledger }) {
  if (!ledger.available) {
    return `
      <h2>صورتحساب مالی — ${esc(party.name)}</h2>
      <div class="error-box">حساب‌های کنترلی دریافتنی/پرداختنی برای این شرکت تعریف نشده‌اند؛ محاسبه مانده قابل اتکا نیست.</div>
      <div class="form-actions"><button type="button" class="ghost" id="cancelModal">بستن</button></div>
    `;
  }

  const rows = ledger.rows.map(row => `
    <tr>
      <td>${dateFa(row.entryDate)}</td>
      <td>${row.journalNo ?? '—'}</td>
      <td>${esc(sourceLabel(row.sourceType))}</td>
      <td>${esc(row.accountCode ? `${row.accountCode} — ${row.accountName}` : row.accountName || '—')}</td>
      <td>${esc(row.description || '—')}</td>
      <td class="num">${money(row.debit)}</td>
      <td class="num">${money(row.credit)}</td>
      <td class="num ${positionClass(row.runningNet)}">${money(row.runningNet)}</td>
    </tr>
  `).join('');

  const hasGrossBoth = ledger.closing.receivable !== '0' && ledger.closing.payable !== '0';
  return `
    <div class="section-head">
      <div>
        <h2>صورتحساب مالی — ${esc(party.name)}</h2>
        <span class="muted">از ${dateFa(ledger.from)} تا ${dateFa(ledger.to)} · مبتنی بر دفترکل و شناسه واقعی طرف‌حساب</span>
      </div>
      <span class="cloud-badge">قابل ردیابی</span>
    </div>

    <div class="info-box"><b>${esc(positionText(ledger, party.name))}</b><br>خالص، صرفاً برای نمایش وضعیت کلی است؛ آوان مطالبات و بدهی را به‌صورت خودکار با یکدیگر تهاتر نمی‌کند.</div>

    <div class="grid4 section">
      <div class="card"><div class="kpi-label">مطالبات از طرف‌حساب</div><div class="kpi-value">${ledger.receivableConfigured ? money(ledger.closing.receivable) : 'تعریف نشده'}</div></div>
      <div class="card"><div class="kpi-label">بدهی به طرف‌حساب</div><div class="kpi-value">${ledger.payableConfigured ? money(ledger.closing.payable) : 'تعریف نشده'}</div></div>
      <div class="card"><div class="kpi-label">وضعیت خالص</div><div class="kpi-value ${positionClass(ledger.closing.net)}">${money(ledger.closing.net)}</div><div class="muted">${esc(ledger.closing.position)}</div></div>
      <div class="card"><div class="kpi-label">مانده خالص اول بازه</div><div class="kpi-value">${money(ledger.opening.net)}</div></div>
    </div>

    ${hasGrossBoth ? '<div class="info-box">این طرف‌حساب هم‌زمان مانده دریافتنی و پرداختنی دارد. صفر یا کم بودن «خالص» به معنی بسته بودن هر دو مانده نیست.</div>' : ''}

    <div class="summary-strip section">
      <span class="summary-pill">گردش بدهکار دوره ${money(ledger.period.debit)}</span>
      <span class="summary-pill">گردش بستانکار دوره ${money(ledger.period.credit)}</span>
      <span class="summary-pill">تعداد ردیف مرتبط ${ledger.rows.length}</span>
    </div>

    <div class="section">
      <div class="section-head"><div><h3>ریز گردش دریافتنی/پرداختنی</h3><span class="muted">فقط خطوط حساب‌های کنترلی که شناسه طرف‌حساب آن‌ها دقیقاً متعلق به این شخص است.</span></div></div>
      ${rows ? `
        <div style="overflow:auto">
          <table>
            <thead><tr><th>تاریخ</th><th>سند</th><th>منشأ</th><th>حساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده خالص</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : '<div class="empty">در این بازه گردش دریافتنی/پرداختنی برای این طرف‌حساب وجود ندارد.</div>'}
    </div>

    <div class="info-box">دریافت/پرداخت نقدی مستقیم که مانده دریافتنی یا پرداختنی ایجاد نمی‌کند، وضعیت باز این گزارش را تغییر نمی‌دهد؛ این گزارش برای پاسخ دقیق به «چقدر از این شخص طلبکارم یا به او بدهکارم؟» طراحی شده است.</div>
    <div class="form-actions"><button type="button" class="ghost" id="cancelModal">بستن</button></div>
  `;
}

async function activeWorkspace() {
  const context = await C.companyContext.ensure();
  if (context?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspace = context?.active_company;
  if (!workspace?.id) throw new Error('COMPANY_REQUIRED');
  return workspace;
}

async function defaultRange() {
  const workspace = await activeWorkspace();
  const fiscal = await C.select('fiscal_years', `select=id,date_from,date_to&workspace_id=eq.${workspace.id}&order=date_from.desc&limit=1`);
  return {
    from: fiscal?.[0]?.date_from || today(),
    to: today()
  };
}

async function loadPartyLedger(partyId, from, to) {
  const workspace = await activeWorkspace();
  const wid = workspace.id;
  const [parties, roleRows, accounts, entries, lines] = await Promise.all([
    C.select('parties', `select=id,name,kind,is_active&workspace_id=eq.${wid}&id=eq.${partyId}&limit=1`),
    C.select('account_roles', `select=role_key,account_id&workspace_id=eq.${wid}`),
    C.select('accounts', `select=id,code,name,is_active,is_postable&workspace_id=eq.${wid}&order=code.asc`),
    C.select('journal_entries', `select=id,journal_no,entry_date,description,source_type,source_id,status&workspace_id=eq.${wid}&entry_date=lte.${to}&order=entry_date.asc,journal_no.asc.nullslast`),
    C.select('journal_lines', `select=journal_entry_id,line_no,account_id,party_id,description,debit,credit&workspace_id=eq.${wid}&party_id=eq.${partyId}&order=journal_entry_id.asc,line_no.asc`)
  ]);

  const party = parties?.[0];
  if (!party) throw new Error('PARTY_NOT_FOUND');
  const roles = Object.fromEntries((roleRows || []).map(row => [row.role_key, row.account_id]));
  return {
    party,
    ledger: buildPartyLedger({ partyId, roles, accounts, entries, lines, from, to })
  };
}

async function openPartyLedger(partyId, requestedRange = null) {
  try {
    const range = requestedRange || await defaultRange();
    if (!range.from || !range.to || range.from > range.to) return toast('بازه تاریخ معتبر نیست.');
    openModal('<h2>صورتحساب مالی طرف‌حساب</h2><div class="loading">در حال محاسبه از دفترکل…</div>');
    await MoneyRuntime?.ready?.();
    const result = await loadPartyLedger(partyId, range.from, range.to);
    openModal(partyLedgerHtml(result));
    const close = document.getElementById('cancelModal');
    if (close) close.onclick = closeModal;
  } catch (error) {
    console.warn('[Avan party ledger]', error);
    openModal(`
      <h2>صورتحساب مالی طرف‌حساب</h2>
      <div class="error-box">اطلاعات لازم برای محاسبه صورتحساب این طرف‌حساب قابل بازیابی نیست.</div>
      <div class="form-actions"><button type="button" class="ghost" id="cancelModal">بستن</button></div>
    `);
    const close = document.getElementById('cancelModal');
    if (close) close.onclick = closeModal;
  }
}

function enhancePartyList() {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'طرف‌حساب‌ها') return;
  document.querySelectorAll('[data-edit-party]').forEach(editButton => {
    const cell = editButton.closest('td');
    if (!cell || cell.querySelector('[data-party-ledger-open]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary small';
    button.dataset.partyLedgerOpen = editButton.dataset.editParty;
    button.textContent = 'صورتحساب مالی';
    button.style.marginInlineStart = '6px';
    button.addEventListener('click', () => void openPartyLedger(button.dataset.partyLedgerOpen));
    cell.append(button);
  });
}

let reportEnhancing = false;
async function enhanceReports() {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'گزارش‌ها') return;
  const content = document.getElementById('content');
  if (!content || content.querySelector('[data-party-ledger-launcher]') || reportEnhancing) return;
  reportEnhancing = true;
  try {
    const workspace = await activeWorkspace();
    const [parties, fiscal] = await Promise.all([
      C.select('parties', `select=id,name,is_active&workspace_id=eq.${workspace.id}&order=name.asc`),
      C.select('fiscal_years', `select=date_from,date_to&workspace_id=eq.${workspace.id}&order=date_from.desc&limit=1`)
    ]);
    if (document.getElementById('pageTitle')?.textContent?.trim() !== 'گزارش‌ها' || content.querySelector('[data-party-ledger-launcher]')) return;

    const currentFrom = document.getElementById('reportFrom')?.value || fiscal?.[0]?.date_from || today();
    const currentTo = document.getElementById('reportTo')?.value || today();
    const card = document.createElement('div');
    card.className = 'card section';
    card.dataset.partyLedgerLauncher = '1';
    card.innerHTML = `
      <div class="section-head">
        <div><h2>گردش و مانده طرف‌حساب</h2><span class="muted">صورتحساب یک شخص بر اساس حساب‌های دریافتنی/پرداختنی و شناسه واقعی طرف‌حساب</span></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>طرف‌حساب</label><select data-party-ledger-party required><option value="">انتخاب کنید…</option>${(parties || []).map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.is_active ? '' : ' — بایگانی'}</option>`).join('')}</select></div>
        <div class="field"><label>از تاریخ</label><input type="date" data-party-ledger-from value="${esc(currentFrom)}"></div>
        <div class="field"><label>تا تاریخ</label><input type="date" data-party-ledger-to value="${esc(currentTo)}"></div>
      </div>
      <div class="form-actions"><button type="button" class="primary" data-party-ledger-run>مشاهده صورتحساب</button></div>
    `;
    card.querySelector('[data-party-ledger-run]').addEventListener('click', () => {
      const partyId = card.querySelector('[data-party-ledger-party]').value;
      const from = card.querySelector('[data-party-ledger-from]').value;
      const to = card.querySelector('[data-party-ledger-to]').value;
      if (!partyId) return toast('یک طرف‌حساب انتخاب کنید.');
      void openPartyLedger(partyId, { from, to });
    });
    content.prepend(card);
  } catch (error) {
    console.warn('[Avan party ledger launcher]', error);
  } finally {
    reportEnhancing = false;
  }
}

function apply() {
  enhancePartyList();
  void enhanceReports();
}

function install() {
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      apply();
    });
  };
  const content = document.getElementById('content');
  if (content) new MutationObserver(schedule).observe(content, { childList: true, subtree: true });
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:company-context-changed', schedule);
  schedule();
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}
