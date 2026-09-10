'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { setTitle, page } from '../shell/shell-view.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast } from '../feedback/toast.js';
import { createBankReconciliationService } from '../../application/treasury/bank-reconciliation-service.js';
import {
  parseCsvText,
  inferBankStatementMapping,
  normalizeBankStatementRows,
  attachStatementFingerprints,
  parseBankMoney
} from '../../domains/treasury/bank-statement-csv.js';

const C = installAvanCloud();
const Service = createBankReconciliationService(C);

const STATUS_FA = Object.freeze({ draft: 'پیش‌نویس', ready: 'آماده تطبیق', finalized: 'نهایی‌شده', voided: 'باطل‌شده' });
const TX_FA = Object.freeze({ receipt: 'دریافت', payment: 'پرداخت', transfer: 'انتقال' });
const REASON_FA = Object.freeze({
  EXACT_AMOUNT: 'مبلغ دقیق',
  BANK_ACCOUNT_SIDE_MATCH: 'سمت حساب بانکی منطبق',
  EXACT_REFERENCE: 'شماره پیگیری منطبق',
  SAME_DAY: 'همان روز',
  DATE_WITHIN_1_DAY: 'اختلاف تاریخ حداکثر یک روز',
  DATE_WITHIN_3_DAYS: 'اختلاف تاریخ حداکثر سه روز',
  DESCRIPTION_TOKEN_MATCH: 'شرح مشابه'
});
const MAPPING_FIELDS = Object.freeze([
  ['date','تاریخ *'], ['valueDate','تاریخ مؤثر'], ['description','شرح'], ['reference','شماره پیگیری'],
  ['counterparty','طرف حساب'], ['debit','برداشت / بدهکار'], ['credit','واریز / بستانکار'],
  ['amount','مبلغ'], ['direction','جهت / نوع تراکنش'], ['balance','مانده پس از تراکنش']
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const state = {
  active: false,
  workspaceId: null,
  banks: [],
  bankId: '',
  imports: [],
  importId: '',
  lines: [],
  matches: [],
  candidates: new Map(),
  pending: null,
  sourceUnit: 'toman',
  busy: false
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));

function dateFa(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit' })
      .format(new Date(`${value}T12:00:00`));
  } catch { return String(value); }
}

function money(value, withUnit = true) {
  if (value === null || value === undefined || value === '') return '—';
  return MoneyRuntime?.formatCanonicalDecimal(String(value), { withUnit }) || String(value);
}

function bankLabel(bank) {
  const ledger = bank?.ledger_account;
  return ledger ? `${ledger.code || ''} — ${ledger.name || 'حساب بانکی'}` : 'حساب بانکی';
}

function humanError(error) {
  const code = String(error?.message || error || '');
  const known = {
    BANK_ACCOUNT_REQUIRED: 'یک حساب بانکی فعال انتخاب کنید.',
    BANK_STATEMENT_ROWS_REQUIRED: 'فایل باید حداقل یک ردیف معتبر داشته باشد.',
    BANK_STATEMENT_ROW_LIMIT_EXCEEDED: 'حداکثر ۵٬۰۰۰ ردیف در هر فایل پشتیبانی می‌شود.',
    BANK_STATEMENT_FILE_HASH_INVALID: 'اثر انگشت فایل معتبر نیست.',
    BANK_STATEMENT_IMPORT_EMPTY: 'صورت‌حساب بانکی بدون ردیف قابل ثبت نیست.',
    BANK_RECONCILIATION_UNRESOLVED_LINES: 'تا تعیین تکلیف همه ردیف‌ها، نهایی‌سازی ممکن نیست.',
    BANK_STATEMENT_BALANCE_MISMATCH: 'مانده پایانی با مانده آغازین و جمع واریز/برداشت‌ها سازگار نیست.',
    BANK_RECONCILIATION_DIRECTION_MISMATCH: 'جهت تراکنش آوان با واریز/برداشت بانک سازگار نیست.',
    BANK_RECONCILIATION_AMOUNT_MISMATCH: 'مبلغ تراکنش آوان دقیقاً با ردیف بانک برابر نیست.',
    BANK_RECONCILIATION_IMPORT_NOT_READY: 'این صورت‌حساب در وضعیت آماده تطبیق نیست.',
    BANK_STATEMENT_LINE_ALREADY_MATCHED: 'این ردیف قبلاً تطبیق داده شده است.',
    SUB_RIAL_VALUE: 'مقدار کمتر از یک ریال مجاز نیست.',
    ROLE_NOT_ALLOWED: 'نقش شما اجازه تغییر مغایرت بانکی را ندارد.',
    WORKSPACE_ACCESS_DENIED: 'دسترسی به شرکت فعال تأیید نشد.'
  };
  const key = Object.keys(known).find(item => code.includes(item));
  return key ? known[key] : 'عملیات مغایرت بانکی انجام نشد. داده‌ها و دسترسی شرکت را بررسی کنید.';
}

async function activeWorkspaceId() {
  const context = await C.companyContext.ensure();
  if (context?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const id = context?.active_company?.id || null;
  if (!id) throw new Error('COMPANY_REQUIRED');
  return id;
}

function setOwnNavActive(active) {
  const own = document.querySelector('[data-avan-bank-reconciliation-nav]');
  if (active) document.querySelectorAll('.sidebar [data-page].active').forEach(node => node.classList.remove('active'));
  own?.classList.toggle('active', active);
}

function ensureNavEntry() {
  const nav = document.getElementById('nav');
  if (!nav || nav.querySelector('[data-avan-bank-reconciliation-nav]')) return;
  const reports = nav.querySelector('[data-page="reports"]');
  const label = document.createElement('div');
  label.className = 'nav-label';
  label.dataset.avanTreasuryLabel = '1';
  label.textContent = 'خزانه‌داری';
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.avanBankReconciliationNav = '1';
  button.innerHTML = '<span>≋</span>مغایرت بانکی';
  button.addEventListener('click', () => void openWorkspace());
  if (reports) {
    const reportLabel = [...nav.querySelectorAll('.nav-label')].find(node => node.textContent.trim() === 'گزارش');
    (reportLabel || reports).before(label, button);
  } else nav.append(label, button);
}

function ensureReportsEntry() {
  const title = document.getElementById('pageTitle')?.textContent?.trim();
  const content = document.getElementById('content');
  if (title !== 'گزارش‌ها' || !content || content.querySelector('[data-bank-reconciliation-entry]')) return;
  const card = document.createElement('section');
  card.className = 'section card avan-bank-entry-card';
  card.dataset.bankReconciliationEntry = '1';
  card.innerHTML = `<div class="section-head"><div><h2>مغایرت بانکی</h2><span class="muted">ورود صورت‌حساب بانک، تطبیق با دریافت/پرداخت/انتقال و کنترل مانده</span></div><button type="button" class="primary">ورود به فضای مغایرت بانکی</button></div>`;
  card.querySelector('button')?.addEventListener('click', () => void openWorkspace());
  content.prepend(card);
}

function installStyle() {
  if (document.getElementById('avanBankReconciliationStyle')) return;
  const style = document.createElement('style');
  style.id = 'avanBankReconciliationStyle';
  style.textContent = `
  .avan-bank-workspace{display:grid;gap:16px;direction:rtl}.avan-bank-warning{border-inline-start:4px solid var(--brand2)}
  .avan-bank-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:end}.avan-bank-toolbar .field{margin:0}
  .avan-bank-grid{display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,2fr);gap:16px;align-items:start}.avan-bank-import-list{display:grid;gap:8px;max-height:520px;overflow:auto}
  .avan-bank-import{width:100%;text-align:right;border:1px solid var(--line);background:var(--surface2);border-radius:12px;padding:12px;cursor:pointer}.avan-bank-import.active{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-soft)}
  .avan-bank-import strong,.avan-bank-import span{display:block}.avan-bank-import span{font-size:12px;color:var(--muted);margin-top:4px}
  .avan-bank-preview-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.avan-bank-preview-map .field{margin:0}.avan-bank-preview-table{max-height:320px;overflow:auto}
  .avan-bank-summary{display:flex;gap:8px;flex-wrap:wrap}.avan-bank-line-actions{display:flex;gap:6px;flex-wrap:wrap}.avan-bank-candidates{display:grid;gap:8px;padding:10px;background:var(--surface2);border-radius:10px}
  .avan-bank-candidate{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface)}
  .avan-bank-candidate-main{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.avan-bank-reasons{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.avan-bank-reason{font-size:11px;padding:3px 7px;border-radius:999px;background:var(--brand-soft)}
  .avan-bank-score{font-weight:900;font-size:18px;min-width:44px;text-align:center}.avan-bank-line-matched{background:color-mix(in srgb,var(--good) 6%,transparent)}.avan-bank-line-ignored{opacity:.72}
  .avan-bank-empty{padding:24px;text-align:center;color:var(--muted)}.avan-bank-entry-card{margin-bottom:16px}.avan-bank-validation{margin-top:10px}.avan-bank-validation ul{margin:6px 0 0;padding-right:18px}
  @media(max-width:900px){.avan-bank-grid{grid-template-columns:1fr}.avan-bank-preview-map{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:620px){.avan-bank-toolbar,.avan-bank-preview-map{grid-template-columns:1fr}.avan-bank-candidate{grid-template-columns:1fr}.avan-bank-workspace table{min-width:760px}.avan-bank-table-wrap{overflow:auto;-webkit-overflow-scrolling:touch}}
  `;
  document.head.appendChild(style);
}

function importOption(importRow) {
  const status = STATUS_FA[importRow.status] || importRow.status;
  const range = [importRow.statement_from, importRow.statement_to].filter(Boolean).map(dateFa).join(' تا ') || 'بدون بازه';
  return `<button type="button" class="avan-bank-import ${state.importId===importRow.id?'active':''}" data-bank-import-id="${esc(importRow.id)}"><strong>${esc(importRow.file_name)}</strong><span>${esc(status)} · ${Number(importRow.row_count || 0).toLocaleString('fa-IR')} ردیف</span><span>${esc(range)}</span></button>`;
}

function mappingSelect(field, label) {
  const selected = state.pending?.mapping?.[field] || '';
  const headers = state.pending?.parsed?.headers || [];
  return `<div class="field"><label>${esc(label)}</label><select data-bank-map="${esc(field)}"><option value="">— استفاده نشود —</option>${headers.map(header => `<option value="${esc(header)}" ${selected===header?'selected':''}>${esc(header)}</option>`).join('')}</select></div>`;
}

function renderPreviewHtml() {
  const pending = state.pending;
  if (!pending) return '<div class="muted">فایل CSV را انتخاب کنید؛ هیچ داده‌ای قبل از تأیید شما ذخیره نمی‌شود.</div>';
  const result = normalizeBankStatementRows(pending.parsed, { mapping: pending.mapping, sourceUnit: state.sourceUnit });
  pending.normalized = result;
  const raw = pending.parsed.rows.slice(0, 6);
  const errors = result.errors.slice(0, 8);
  return `
    <div class="section-head"><div><h3>پیش‌نمایش و نگاشت ستون‌ها</h3><span class="muted">${esc(pending.file.name)} · ${pending.parsed.rows.length.toLocaleString('fa-IR')} ردیف · جداکننده ${pending.parsed.delimiter==='\t'?'Tab':esc(pending.parsed.delimiter)}</span></div></div>
    <div class="avan-bank-preview-map">${MAPPING_FIELDS.map(([field,label]) => mappingSelect(field,label)).join('')}</div>
    <div class="form-grid section">
      <div class="field"><label>مانده آغازین (اختیاری)</label><input data-bank-opening inputmode="decimal" value="${esc(pending.openingBalance || '')}" placeholder="مثلاً ۱۲۵۰۰۰"></div>
      <div class="field"><label>مانده پایانی (اختیاری)</label><input data-bank-closing inputmode="decimal" value="${esc(pending.closingBalance || '')}" placeholder="مثلاً ۱۳۰۰۰۰"></div>
    </div>
    <div class="avan-bank-validation ${errors.length?'error-box':'success-box'}">${errors.length
      ? `<b>ثبت مسدود است؛ ${result.errors.length.toLocaleString('fa-IR')} خطا:</b><ul>${errors.map(error => `<li>ردیف ${Number(error.sourceLine).toLocaleString('fa-IR')}: ${esc(error.message)}</li>`).join('')}</ul>${result.errors.length>errors.length?'<div>… خطاهای بیشتری نیز وجود دارد.</div>':''}`
      : `<b>${result.rows.length.toLocaleString('fa-IR')} ردیف معتبر است.</b> مبلغ‌ها با دقت یک ریال به تومان Canonical تبدیل می‌شوند.`}</div>
    <div class="avan-bank-preview-table avan-bank-table-wrap section"><table><thead><tr>${pending.parsed.headers.slice(0,8).map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${raw.map(row=>`<tr>${pending.parsed.headers.slice(0,8).map(h=>`<td>${esc(row.values[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="form-actions"><button type="button" class="primary" data-bank-persist-preview ${errors.length?'disabled':''}>ثبت صورت‌حساب و ورود به تطبیق</button><button type="button" class="ghost" data-bank-clear-preview>پاک کردن پیش‌نمایش</button></div>`;
}

function candidateHtml(lineId, candidate) {
  const reasons = (candidate.reason_codes || []).map(code => REASON_FA[code] || code);
  return `<div class="avan-bank-candidate"><div><div class="avan-bank-candidate-main"><b>${esc(TX_FA[candidate.tx_type] || candidate.tx_type || 'تراکنش')}</b><span>${esc(dateFa(candidate.tx_date))}</span><strong>${esc(money(candidate.amount))}</strong>${candidate.reference?`<span>پیگیری: ${esc(candidate.reference)}</span>`:''}</div><div class="muted">${esc(candidate.description || 'بدون شرح')}</div><div class="avan-bank-reasons">${reasons.map(reason=>`<span class="avan-bank-reason">${esc(reason)}</span>`).join('')}</div></div><div><div class="avan-bank-score">${Number(candidate.score || 0).toLocaleString('fa-IR')}</div><button type="button" class="good-btn small" data-bank-confirm-line="${esc(lineId)}" data-bank-confirm-tx="${esc(candidate.transaction_id)}">تأیید تطبیق</button></div></div>`;
}

function detailsHtml() {
  const selected = state.imports.find(item => item.id === state.importId);
  if (!selected) return '<div class="avan-bank-empty">یک صورت‌حساب را برای بررسی انتخاب کنید.</div>';
  const activeMatches = Service.activeMatchesForLines(state.matches, state.lines);
  let matched = 0, ignored = 0;
  for (const line of state.lines) {
    if (activeMatches.has(String(line.id))) matched += 1;
    else if (line.ignored_at) ignored += 1;
  }
  const unresolved = state.lines.length - matched - ignored;
  return `
    <div class="section-head"><div><h3>${esc(selected.file_name)}</h3><span class="muted">${STATUS_FA[selected.status] || esc(selected.status)} · ${dateFa(selected.statement_from)} تا ${dateFa(selected.statement_to)}</span></div>${selected.status==='ready'?`<button type="button" class="primary" data-bank-finalize ${unresolved?'disabled':''}>نهایی‌سازی صورت‌حساب</button>`:''}</div>
    <div class="avan-bank-summary"><span class="summary-pill">کل ${state.lines.length.toLocaleString('fa-IR')}</span><span class="summary-pill pos">تطبیق‌شده ${matched.toLocaleString('fa-IR')}</span><span class="summary-pill">نادیده‌گرفته ${ignored.toLocaleString('fa-IR')}</span><span class="summary-pill ${unresolved?'neg':'pos'}">تعیین‌تکلیف‌نشده ${unresolved.toLocaleString('fa-IR')}</span></div>
    ${(selected.opening_balance!==null||selected.closing_balance!==null)?`<div class="info-box">مانده آغازین: <b>${esc(money(selected.opening_balance))}</b> · مانده پایانی: <b>${esc(money(selected.closing_balance))}</b></div>`:''}
    <div class="avan-bank-table-wrap"><table><thead><tr><th>ردیف</th><th>تاریخ</th><th>شرح / پیگیری</th><th>واریز</th><th>برداشت</th><th>وضعیت</th><th>اقدام</th></tr></thead><tbody>
    ${state.lines.map(line => {
      const match = activeMatches.get(String(line.id));
      const rowClass = match ? 'avan-bank-line-matched' : line.ignored_at ? 'avan-bank-line-ignored' : '';
      const candidates = state.candidates.get(String(line.id));
      const status = match ? 'تطبیق‌شده' : line.ignored_at ? 'نادیده‌گرفته‌شده' : 'باز';
      const canAct = selected.status === 'ready' && !match && !line.ignored_at;
      return `<tr class="${rowClass}"><td>${Number(line.line_no).toLocaleString('fa-IR')}</td><td>${esc(dateFa(line.booking_date))}</td><td><b>${esc(line.description || '—')}</b><br><span class="muted">${line.reference_no?`پیگیری: ${esc(line.reference_no)}`:'بدون شماره پیگیری'}${line.counterparty?` · ${esc(line.counterparty)}`:''}</span></td><td class="num">${line.direction==='credit'?esc(money(line.amount,false)):'—'}</td><td class="num">${line.direction==='debit'?esc(money(line.amount,false)):'—'}</td><td><span class="badge">${status}</span></td><td><div class="avan-bank-line-actions">${canAct?`<button type="button" class="ghost small" data-bank-candidates="${esc(line.id)}">پیشنهادهای تطبیق</button><button type="button" class="ghost small" data-bank-ignore="${esc(line.id)}">نادیده گرفتن</button>`:''}${match&&selected.status==='ready'?`<button type="button" class="danger small" data-bank-void="${esc(match.id)}">لغو تطبیق</button>`:''}</div></td></tr>
      ${Array.isArray(candidates)?`<tr><td colspan="7"><div class="avan-bank-candidates">${candidates.length?candidates.map(candidate=>candidateHtml(line.id,candidate)).join(''):'<div class="muted">کاندید معتبر با مبلغ و سمت بانکی دقیق در بازه تاریخ یافت نشد.</div>'}</div></td></tr>`:''}`;
    }).join('')}
    </tbody></table></div>`;
}

function workspaceHtml() {
  return `<section class="avan-bank-workspace" data-avan-bank-workspace="1">
    <div class="section-head"><div><h2>مغایرت بانکی</h2><span class="muted">صورت‌حساب بانک ↔ دریافت / پرداخت / انتقال ثبت‌شده در آوان</span></div><span class="cloud-badge">کنترل انسانی</span></div>
    <div class="info-box avan-bank-warning"><b>پیشنهاد تطبیق است؛ هیچ سند حسابداری به‌صورت خودکار ثبت نمی‌شود.</b><br>حتی امتیاز ۱۰۰ فقط پیشنهاد است و تا کلیک شما روی «تأیید تطبیق» هیچ Match ثبت نمی‌شود.</div>
    ${!state.banks.length?'<div class="card avan-bank-empty"><b>حساب بانکی فعالی وجود ندارد.</b><br>ابتدا در حساب‌ها/تنظیمات یک حساب بانکی معتبر ایجاد کنید.</div>':`
    <div class="card avan-bank-toolbar"><div class="field"><label for="avanBankAccount">حساب بانکی</label><select id="avanBankAccount">${state.banks.map(bank=>`<option value="${esc(bank.id)}" ${state.bankId===bank.id?'selected':''}>${esc(bankLabel(bank))}</option>`).join('')}</select></div><button type="button" class="ghost" data-bank-refresh>بازخوانی</button></div>
    <div class="card"><div class="section-head"><div><h3>ورود صورت‌حساب CSV</h3><span class="muted">پیش‌نمایش و نگاشت در مرورگر انجام می‌شود؛ ثبت فقط پس از اعتبارسنجی کامل.</span></div></div><div class="form-grid"><div class="field"><label>واحد مبالغ داخل فایل</label><select id="avanBankSourceUnit"><option value="toman" ${state.sourceUnit==='toman'?'selected':''}>تومان</option><option value="rial" ${state.sourceUnit==='rial'?'selected':''}>ریال</option></select><small>این انتخاب فقط واحد فایل ورودی است و واحد ذخیره Canonical آوان را تغییر نمی‌دهد.</small></div><div class="field"><label>فایل CSV</label><input id="avanBankCsvFile" type="file" accept=".csv,text/csv,text/plain"><small>حداکثر ۲ مگابایت و ۵٬۰۰۰ ردیف.</small></div></div><div id="avanBankPreview" class="section">${renderPreviewHtml()}</div></div>
    <div class="avan-bank-grid"><aside class="card"><div class="section-head"><div><h3>صورت‌حساب‌های این بانک</h3><span class="muted">آخرین Importها</span></div></div><div class="avan-bank-import-list">${state.imports.length?state.imports.map(importOption).join(''):'<div class="muted">هنوز صورت‌حسابی ثبت نشده است.</div>'}</div></aside><main class="card" id="avanBankDetails">${detailsHtml()}</main></div>`}
  </section>`;
}

function rerender() {
  if (!state.active) return;
  page(workspaceHtml());
  setOwnNavActive(true);
  bindWorkspace();
  window.AvanMoneyOutput?.project?.();
}

async function loadBankState({ keepImport = true } = {}) {
  state.imports = state.bankId ? await Service.listImports(state.workspaceId, state.bankId) : [];
  if (!keepImport || !state.imports.some(item => item.id === state.importId)) state.importId = state.imports[0]?.id || '';
  await loadImportDetails();
}

async function loadImportDetails() {
  state.candidates = new Map();
  if (!state.importId || !state.bankId) { state.lines = []; state.matches = []; return; }
  [state.lines, state.matches] = await Promise.all([
    Service.listLines(state.workspaceId, state.importId),
    Service.listMatches(state.workspaceId, state.bankId)
  ]);
}

async function refreshAll({ keepImport = true } = {}) {
  state.banks = await Service.listBankAccounts(state.workspaceId);
  if (!state.banks.some(bank => bank.id === state.bankId)) state.bankId = state.banks[0]?.id || '';
  await loadBankState({ keepImport });
}

async function openWorkspace() {
  try {
    state.active = true;
    installStyle();
    await MoneyRuntime?.ready?.();
    state.sourceUnit = MoneyRuntime?.unit?.() === 'rial' ? 'rial' : 'toman';
    state.workspaceId = await activeWorkspaceId();
    setTitle('مغایرت بانکی');
    setOwnNavActive(true);
    page('<div class="loading">در حال خواندن صورت‌حساب‌های بانکی…</div>');
    await refreshAll({ keepImport: false });
    rerender();
  } catch (error) {
    page(`<div class="error-box">${esc(humanError(error))}</div>`);
  }
}

async function sha256File(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

function refreshPreviewOnly() {
  const host = document.getElementById('avanBankPreview');
  if (!host || !state.pending) return;
  host.innerHTML = renderPreviewHtml();
  bindPreview();
}

function bindPreview() {
  document.querySelectorAll('[data-bank-map]').forEach(select => {
    select.addEventListener('change', () => {
      state.pending.mapping[select.dataset.bankMap] = select.value;
      refreshPreviewOnly();
    });
  });
  const opening = document.querySelector('[data-bank-opening]');
  const closing = document.querySelector('[data-bank-closing]');
  opening?.addEventListener('input', () => { state.pending.openingBalance = opening.value; });
  closing?.addEventListener('input', () => { state.pending.closingBalance = closing.value; });
  document.querySelector('[data-bank-clear-preview]')?.addEventListener('click', () => { state.pending = null; refreshPreviewOnly(); rerender(); });
  document.querySelector('[data-bank-persist-preview]')?.addEventListener('click', () => void persistPreview());
}

async function persistPreview() {
  if (state.busy || !state.pending) return;
  const normalized = normalizeBankStatementRows(state.pending.parsed, { mapping: state.pending.mapping, sourceUnit: state.sourceUnit });
  if (normalized.errors.length || !normalized.rows.length) return toast('ابتدا خطاهای فایل و نگاشت ستون‌ها را برطرف کنید');
  const openingRaw = String(state.pending.openingBalance || '').trim();
  const closingRaw = String(state.pending.closingBalance || '').trim();
  const opening = openingRaw ? parseBankMoney(openingRaw, { sourceUnit: state.sourceUnit, allowNegative: true }) : null;
  const closing = closingRaw ? parseBankMoney(closingRaw, { sourceUnit: state.sourceUnit, allowNegative: true }) : null;
  if (opening && !opening.ok) return toast('مانده آغازین معتبر نیست یا دقت آن کمتر از یک ریال است');
  if (closing && !closing.ok) return toast('مانده پایانی معتبر نیست یا دقت آن کمتر از یک ریال است');

  state.busy = true;
  try {
    const rows = await attachStatementFingerprints(normalized.rows);
    const dates = rows.map(row => row.booking_date).sort();
    const importId = await Service.importStatement({
      workspaceId: state.workspaceId,
      financialAccountId: state.bankId,
      fileName: state.pending.file.name,
      fileSha256: state.pending.fileSha256,
      statementFrom: dates[0],
      statementTo: dates.at(-1),
      openingBalance: opening?.canonical ?? null,
      closingBalance: closing?.canonical ?? null,
      rows
    });
    state.pending = null;
    await loadBankState({ keepImport: false });
    if (importId && state.imports.some(item => item.id === importId)) state.importId = importId;
    await loadImportDetails();
    rerender();
    toast('صورت‌حساب بانکی ثبت شد و برای تطبیق آماده است');
  } catch (error) {
    toast(humanError(error));
  } finally { state.busy = false; }
}

function reasonModal({ title, label, submitText, onSubmit }) {
  openModal(`<h2>${esc(title)}</h2><form id="avanBankReasonForm"><div class="field"><label>${esc(label)}</label><textarea name="reason" rows="3" required></textarea></div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">${esc(submitText)}</button></div></form>`);
  document.getElementById('cancelModal').onclick = closeModal;
  document.getElementById('avanBankReasonForm').onsubmit = async event => {
    event.preventDefault();
    const reason = new FormData(event.target).get('reason')?.trim();
    if (!reason) return;
    try { await onSubmit(reason); closeModal(); await loadBankState(); rerender(); }
    catch (error) { toast(humanError(error)); }
  };
}

function bindWorkspace() {
  const bankSelect = document.getElementById('avanBankAccount');
  bankSelect?.addEventListener('change', async () => {
    state.bankId = bankSelect.value; state.importId = ''; state.pending = null;
    try { await loadBankState({ keepImport: false }); rerender(); } catch (error) { toast(humanError(error)); }
  });
  document.getElementById('avanBankSourceUnit')?.addEventListener('change', event => {
    state.sourceUnit = event.target.value;
    if (state.pending) refreshPreviewOnly();
  });
  document.getElementById('avanBankCsvFile')?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { event.target.value = ''; return toast('حجم فایل بیشتر از ۲ مگابایت است'); }
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      state.pending = { file, fileSha256: await sha256File(file), parsed, mapping: inferBankStatementMapping(parsed.headers), normalized: null, openingBalance: '', closingBalance: '' };
      refreshPreviewOnly();
    } catch (error) {
      state.pending = null;
      toast(String(error?.message || '').includes('ROW_LIMIT') ? 'تعداد ردیف‌های فایل بیشتر از ۵٬۰۰۰ است' : 'ساختار CSV قابل خواندن نیست');
    }
  });
  document.querySelector('[data-bank-refresh]')?.addEventListener('click', async () => {
    try { await refreshAll(); rerender(); toast('اطلاعات بانکی بازخوانی شد'); } catch (error) { toast(humanError(error)); }
  });
  document.querySelectorAll('[data-bank-import-id]').forEach(button => button.addEventListener('click', async () => {
    state.importId = button.dataset.bankImportId;
    try { await loadImportDetails(); rerender(); } catch (error) { toast(humanError(error)); }
  }));
  document.querySelectorAll('[data-bank-candidates]').forEach(button => button.addEventListener('click', async () => {
    const lineId = button.dataset.bankCandidates;
    button.disabled = true;
    try { state.candidates.set(lineId, await Service.candidates(state.workspaceId, lineId, 3) || []); rerender(); }
    catch (error) { toast(humanError(error)); }
  }));
  document.querySelectorAll('[data-bank-confirm-line]').forEach(button => button.addEventListener('click', async () => {
    const lineId = button.dataset.bankConfirmLine;
    const txId = button.dataset.bankConfirmTx;
    const candidate = (state.candidates.get(lineId) || []).find(item => String(item.transaction_id) === String(txId));
    if (!candidate) return toast('پیشنهاد انتخاب‌شده دیگر معتبر نیست؛ پیشنهادها را دوباره دریافت کنید');
    button.disabled = true;
    try {
      await Service.confirmMatch({ workspaceId: state.workspaceId, financialAccountId: state.bankId, statementLineId: lineId, candidate });
      await loadImportDetails(); rerender(); toast('تطبیق با تأیید شما ثبت شد');
    } catch (error) { toast(humanError(error)); }
  }));
  document.querySelectorAll('[data-bank-ignore]').forEach(button => button.addEventListener('click', () => {
    const lineId = button.dataset.bankIgnore;
    reasonModal({ title:'نادیده گرفتن ردیف بانک', label:'دلیل نادیده گرفتن', submitText:'ثبت دلیل', onSubmit: reason => Service.ignoreLine(state.workspaceId, lineId, reason) });
  }));
  document.querySelectorAll('[data-bank-void]').forEach(button => button.addEventListener('click', () => {
    const matchId = button.dataset.bankVoid;
    reasonModal({ title:'لغو تطبیق', label:'دلیل لغو تطبیق', submitText:'لغو تطبیق', onSubmit: reason => Service.voidMatch(state.workspaceId, matchId, reason) });
  }));
  document.querySelector('[data-bank-finalize]')?.addEventListener('click', async buttonEvent => {
    if (!confirm('صورت‌حساب نهایی شود؟ پس از نهایی‌سازی Evidence آن قفل می‌شود.')) return;
    buttonEvent.currentTarget.disabled = true;
    try { await Service.finalizeImport(state.workspaceId, state.importId); await loadBankState(); rerender(); toast('صورت‌حساب بانکی نهایی شد'); }
    catch (error) { toast(humanError(error)); }
  });
  bindPreview();
}

function install() {
  installStyle();
  ensureNavEntry();
  ensureReportsEntry();
  window.addEventListener('avan:page-rendered', event => {
    const title = event.detail?.title || document.getElementById('pageTitle')?.textContent?.trim();
    if (title !== 'مغایرت بانکی') { state.active = false; setOwnNavActive(false); }
    ensureReportsEntry();
  });
  window.addEventListener('avan:company-context-changed', () => {
    state.workspaceId = null; state.banks = []; state.bankId = ''; state.imports = []; state.importId = ''; state.lines = []; state.matches = []; state.candidates = new Map(); state.pending = null;
  });
  window.AvanBankReconciliation = Object.freeze({ installed: true, open: openWorkspace });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
}
