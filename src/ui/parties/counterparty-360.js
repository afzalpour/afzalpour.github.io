'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { MoneyRuntime } from '../money/money-runtime.js';
import { openModal, closeModal } from '../components/modal.js';
import { buildCounterparty360 } from '../../intelligence/counterparty-360.js';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const cloud = HAS_BROWSER ? installAvanCloud() : null;
const KIND_FA = Object.freeze({ customer: 'مشتری', vendor: 'فروشنده', both: 'مشتری و فروشنده', other: 'سایر' });
const ENTITY_FA = Object.freeze({ individual: 'شخص حقیقی', legal: 'شخص حقوقی', unspecified: 'تعیین‌نشده' });
const INVOICE_FA = Object.freeze({ sale: 'فروش', purchase: 'خرید' });
const STATUS_FA = Object.freeze({ draft: 'پیش‌نویس', posted: 'ثبت‌شده', reversed: 'برگشتی', cancelled: 'لغوشده' });
let installed = false;
let context = null;
let contextInflight = null;
let openSequence = 0;

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
function money(value) { return MoneyRuntime?.formatCanonicalDecimal?.(String(value ?? '0')) || String(value ?? '0'); }
function dateFa(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(`${value}T12:00:00`)); }
  catch { return String(value); }
}
function localIsoDate() {
  const d = new Date();
  return `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function pageIsParties() { return String(document.getElementById('pageTitle')?.textContent || '').trim() === 'طرف‌حساب‌ها'; }
function query(fields, wid, suffix='') { return `select=${fields}&workspace_id=eq.${wid}${suffix ? `&${suffix}` : ''}`; }

async function loadContext() {
  const company = await cloud.companyContext.ensure();
  if (company?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const workspaceId = company?.active_company?.id;
  if (!workspaceId) throw new Error('COMPANY_REQUIRED');
  const asOf = localIsoDate();
  if (context?.workspaceId === workspaceId && context?.asOf === asOf) return context;
  if (contextInflight) return contextInflight;
  contextInflight = (async()=>{
    const fiscalRows = await cloud.select('fiscal_years', query('id,date_from,date_to', workspaceId, 'order=date_from.desc&limit=1'));
    const fiscalFrom = fiscalRows?.[0]?.date_from;
    if (!fiscalFrom) throw new Error('FISCAL_YEAR_REQUIRED');
    const [roleRows, accounts, parties, entries, lines, invoices] = await Promise.all([
      cloud.select('account_roles', query('role_key,account_id', workspaceId)),
      cloud.select('accounts', query('id,code,name,category,is_active,is_postable', workspaceId, 'order=code.asc')),
      cloud.select('parties', query('id,name,kind,entity_type,legal_name,national_id,registration_no,economic_code,tax_id,phone,email,postal_code,province,city,address,contact_name,website,is_active', workspaceId, 'order=name.asc')),
      cloud.select('journal_entries', query('id,journal_no,entry_date,status,source_type,source_id,description', workspaceId, `entry_date=lte.${asOf}&order=entry_date.asc,journal_no.asc.nullslast`)),
      cloud.select('journal_lines', query('id,journal_entry_id,line_no,account_id,party_id,description,debit,credit', workspaceId, 'order=journal_entry_id.asc,line_no.asc')),
      cloud.select('invoices', query('id,invoice_no,invoice_type,invoice_date,due_date,party_id,status,journal_entry_id,reversal_journal_entry_id,total_amount', workspaceId, `invoice_date=lte.${asOf}&order=invoice_date.asc,invoice_no.asc.nullslast`))
    ]);
    const roles = Object.fromEntries((roleRows || []).filter(r=>r?.role_key&&r?.account_id).map(r=>[r.role_key,r.account_id]));
    context = Object.freeze({ workspaceId, asOf, fiscalFrom, roles, accounts:accounts||[], parties:parties||[], entries:entries||[], lines:lines||[], invoices:invoices||[] });
    return context;
  })();
  try { return await contextInflight; } finally { contextInflight = null; }
}

function profile(label, value) { return `<div class="avan-c360-profile-item"><span>${esc(label)}</span><b>${esc(value || '—')}</b></div>`; }
function openItems(title, items) {
  const rows = (items||[]).slice(0,12).map(x=>`<tr><td>${esc(x.journalNo??'—')}</td><td>${esc(dateFa(x.entryDate))}</td><td>${esc(dateFa(x.dueDate))}</td><td>${Number(x.daysPastDue||0).toLocaleString('fa-IR')}</td><td class="num">${esc(money(x.remaining))}</td></tr>`).join('');
  return `<section class="avan-c360-block"><h3>${esc(title)}</h3>${rows?`<div class="avan-c360-table-wrap"><table><thead><tr><th>سند مبنا</th><th>تاریخ</th><th>سررسید</th><th>روز تأخیر</th><th>مانده باز</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">قلم بازی وجود ندارد.</div>'}</section>`;
}
function invoicesHtml(s) {
  const rows=s.invoices.slice(0,10).map(x=>`<tr><td>${esc(x.invoiceNo??'—')}</td><td>${esc(INVOICE_FA[x.invoiceType]||x.invoiceType||'—')}</td><td>${esc(dateFa(x.invoiceDate))}</td><td>${esc(dateFa(x.dueDate))}</td><td>${esc(STATUS_FA[x.status]||x.status||'—')}</td><td class="num">${esc(money(x.totalAmount))}</td></tr>`).join('');
  return `<section class="avan-c360-block"><h3>آخرین فاکتورها</h3>${rows?`<div class="avan-c360-table-wrap"><table><thead><tr><th>شماره</th><th>نوع</th><th>تاریخ</th><th>سررسید</th><th>وضعیت</th><th>مبلغ</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">فاکتوری برای این طرف‌حساب ثبت نشده است.</div>'}</section>`;
}
function ledgerHtml(s) {
  const rows=[...s.ledger.rows].reverse().slice(0,12).map(x=>`<tr><td>${esc(x.journalNo??'—')}</td><td>${esc(dateFa(x.entryDate))}</td><td>${esc(x.accountCode)} — ${esc(x.accountName)}</td><td>${esc(x.description||'—')}</td><td class="num">${esc(money(x.debit))}</td><td class="num">${esc(money(x.credit))}</td><td class="num" data-avan-accounting-negative>${esc(money(x.runningNet))}</td></tr>`).join('');
  return `<section class="avan-c360-block"><h3>آخرین گردش‌های دفتر طرف‌حساب</h3>${rows?`<div class="avan-c360-table-wrap"><table><thead><tr><th>سند</th><th>تاریخ</th><th>حساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده جاری</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">گردشی در این دوره وجود ندارد.</div>'}</section>`;
}
function evidenceHtml(s) {
  const rows=s.evidence.slice(0,15).map(x=>`<tr><td>${esc(x.journalNo??'—')}</td><td>${esc(dateFa(x.entryDate))}</td><td>${esc(x.description||x.sourceType||'—')}</td></tr>`).join('');
  return `<section class="avan-c360-block"><h3>شواهد و اسناد مؤثر</h3>${rows?`<div class="avan-c360-table-wrap"><table><thead><tr><th>شماره سند</th><th>تاریخ</th><th>شرح/منبع</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">سند مؤثری در دوره جاری وجود ندارد.</div>'}</section>`;
}
function risksHtml(s) { return s.risks.length ? s.risks.map(x=>`<span class="badge avan-c360-risk">${esc(x.label)}</span>`).join(' ') : '<span class="badge avan-c360-risk-ok">مورد قابل توجهی شناسایی نشد</span>'; }
function modalHtml(s) {
  const p=s.party,f=s.financial,missing=p.missingFields.length?p.missingFields.join('، '):'—';
  return `<div class="avan-counterparty-360" data-counterparty-360-modal data-party-id="${esc(p.id)}">
    <div class="section-head avan-c360-head"><div><h2>نمای ۳۶۰ — ${esc(p.name)}</h2><div class="avan-c360-badges"><span class="badge">${esc(KIND_FA[p.kind]||'سایر')}</span><span class="badge">${esc(ENTITY_FA[p.entityType]||'تعیین‌نشده')}</span><span class="cloud-badge">دفتر کل + شواهد</span></div></div><button type="button" class="ghost" id="avanCounterparty360Close">بستن</button></div>
    <div class="info-box section">مطالبات و بدهی‌های این طرف‌حساب جدا نمایش داده می‌شوند و به‌صورت خودکار با هم تهاتر نمی‌شوند.</div>
    <section class="avan-c360-kpis section"><div class="card"><div class="kpi-label">مطالبه باز</div><div class="kpi-value">${esc(money(f.receivable))}</div></div><div class="card"><div class="kpi-label">مطالبه سررسیدگذشته</div><div class="kpi-value">${esc(money(f.overdueReceivable))}</div></div><div class="card"><div class="kpi-label">بدهی باز</div><div class="kpi-value">${esc(money(f.payable))}</div></div><div class="card"><div class="kpi-label">بدهی سررسیدگذشته</div><div class="kpi-value">${esc(money(f.overduePayable))}</div></div></section>
    <section class="avan-c360-block"><div class="section-head"><div><h3>پرونده هویتی و مالیاتی</h3><span class="muted">آخرین فعالیت: ${esc(dateFa(s.lastActivityDate))} · قدیمی‌ترین سررسید باز: ${esc(dateFa(f.oldestDueDate))}</span></div></div><div class="avan-c360-profile-grid">${profile('نام رسمی/حقوقی',p.legalName)}${profile('کد ملی/شناسه ملی',p.nationalId)}${profile('شماره ثبت',p.registrationNo)}${profile('کد اقتصادی',p.economicCode)}${profile('شناسه مالیاتی',p.taxId)}${profile('تلفن',p.phone)}${profile('ایمیل',p.email)}${profile('کدپستی',p.postalCode)}${profile('استان / شهر',[p.province,p.city].filter(Boolean).join(' / '))}${profile('مسئول تماس',p.contactName)}${profile('وب‌سایت',p.website)}${profile('فیلدهای نیازمند تکمیل',missing)}</div><div class="avan-c360-address"><span>آدرس</span><b>${esc(p.address||'—')}</b></div></section>
    <section class="avan-c360-block"><h3>کنترل و ریسک قطعی</h3><div class="avan-c360-risk-list">${risksHtml(s)}</div></section>${openItems('اقلام باز مطالبات',f.receivableOpenItems)}${openItems('اقلام باز بدهی‌ها',f.payableOpenItems)}${invoicesHtml(s)}${ledgerHtml(s)}${evidenceHtml(s)}</div>`;
}
function loadingHtml(){return '<div class="avan-counterparty-360" data-counterparty-360-loading><div class="section-head avan-c360-head"><div><h2>نمای ۳۶۰ طرف‌حساب</h2><span class="muted">در حال خواندن دفتر کل، سررسیدها و شواهد…</span></div><button type="button" class="ghost" id="avanCounterparty360Close">بستن</button></div><div class="loading section">در حال بارگذاری اطلاعات طرف‌حساب…</div></div>';}
function errorHtml(){return '<div class="avan-counterparty-360"><h2>نمای ۳۶۰ طرف‌حساب</h2><div class="error-box section">اطلاعات ۳۶۰ این طرف‌حساب در حال حاضر قابل بارگذاری نیست.</div><div class="form-actions"><button type="button" class="ghost" id="avanCounterparty360Close">بستن</button></div></div>';}
function bindClose(seq){document.getElementById('avanCounterparty360Close')?.addEventListener('click',()=>{if(seq===openSequence)openSequence+=1;closeModal();},{once:true});}
async function snapshot(partyId){
  await MoneyRuntime?.ready?.(); const c=await loadContext(); const party=c.parties.find(x=>String(x.id)===String(partyId));
  if(!party)throw new Error('COUNTERPARTY_360_PARTY_NOT_FOUND');
  return buildCounterparty360({party,roles:c.roles,accounts:c.accounts,entries:c.entries,lines:c.lines,invoices:c.invoices,fiscalFrom:c.fiscalFrom,asOf:c.asOf});
}
async function openCounterparty360(partyId){
  const seq=++openSequence; openModal(loadingHtml()); bindClose(seq);
  try{const s=await snapshot(partyId);if(seq!==openSequence)return s;openModal(modalHtml(s));bindClose(seq);window.AvanAccountingNegative?.project?.();return s;}
  catch(error){console.warn('[Counterparty 360]',error);if(seq===openSequence){openModal(errorHtml());bindClose(seq);}throw error;}
}
function actionPartyId(target){
  if(!pageIsParties()||target?.closest?.('[data-party-master-edit]'))return null;
  const cell=target?.closest?.('tr[data-party-master-row] > td:last-child');
  if(!cell)return null; return String(cell.closest('tr[data-party-master-row]')?.dataset?.partyMasterRow||'').trim()||null;
}
function onClick(event){const partyId=actionPartyId(event.target);if(!partyId)return;event.preventDefault();event.stopPropagation();void openCounterparty360(partyId).catch(()=>{});}
function invalidate(){context=null;contextInflight=null;}
export function installCounterparty360(){
  if(!HAS_BROWSER||installed)return false; installed=true;
  document.addEventListener('click',onClick,true);
  window.addEventListener('avan:company-context-changed',invalidate);
  window.addEventListener('avan:company-context-cleared',invalidate);
  window.AvanCounterparty360=Object.freeze({open:openCounterparty360,refresh:invalidate,readOnly:true,oneRialExact:true,mutationFreeAction:true});
  return true;
}
if(HAS_BROWSER){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installCounterparty360,{once:true});else installCounterparty360();}
