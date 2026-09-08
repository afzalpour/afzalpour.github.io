'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast, showError } from '../feedback/toast.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
let reports = [];
let loading = false;

const SOURCES = Object.freeze({
  invoices: { label:'فاکتورها', group:'مالی', icon:'▤', dated:true, description:'فروش و خرید، طرف حساب و جمع‌های مالی', columns:[['invoice_no','شماره فاکتور'],['invoice_date','تاریخ'],['invoice_type','نوع فاکتور'],['status','وضعیت'],['party_name','طرف حساب'],['subtotal_amount','جمع قبل از مالیات'],['tax_total','مالیات'],['total_amount','جمع نهایی']] },
  journals: { label:'اسناد حسابداری', group:'مالی', icon:'≡', dated:true, description:'سند، شرح، منبع و جمع بدهکار و بستانکار', columns:[['journal_no','شماره سند'],['entry_date','تاریخ'],['description','شرح'],['status','وضعیت'],['source_type','منبع'],['debit_total','جمع بدهکار'],['credit_total','جمع بستانکار']] },
  transactions: { label:'دریافت و پرداخت', group:'مالی', icon:'↔', dated:true, description:'دریافت، پرداخت و انتقال با طرف حساب و مبلغ', columns:[['tx_date','تاریخ'],['tx_type','نوع عملیات'],['party_name','طرف حساب'],['amount','مبلغ'],['description','شرح'],['status','وضعیت']] },
  inventory_items: { label:'کالاها', group:'انبار و کالا', icon:'□', dated:false, description:'فهرست کالا، گروه، واحد، بارکد و حداقل موجودی', columns:[['sku','کد کالا'],['barcode','بارکد'],['item_name','نام کالا'],['item_type','نوع'],['group_name','گروه کالا'],['unit_name','واحد'],['min_stock','حداقل موجودی'],['is_active','وضعیت']] },
  inventory_stock: { label:'موجودی انبار', group:'انبار و کالا', icon:'▦', dated:false, description:'موجودی هر کالا در هر انبار، ارزش و میانگین بهای تمام‌شده', columns:[['sku','کد کالا'],['item_name','نام کالا'],['warehouse_name','انبار'],['unit_name','واحد'],['quantity_on_hand','موجودی'],['inventory_value','ارزش موجودی'],['average_unit_cost','میانگین بهای واحد'],['min_stock','حداقل موجودی'],['below_min_stock','کنترل حداقل']] },
  inventory_movements: { label:'گردش کالا', group:'انبار و کالا', icon:'⇄', dated:true, description:'ریز ورود و خروج کالا، سند انبار، مقدار و ارزش', columns:[['movement_date','تاریخ'],['posting_seq','ترتیب ثبت'],['sku','کد کالا'],['item_name','نام کالا'],['warehouse_name','انبار'],['quantity_delta','تغییر مقدار'],['unit_cost','بهای واحد'],['value_delta','تغییر ارزش'],['document_no','شماره سند انبار'],['document_type','نوع سند'],['document_status','وضعیت سند']] },
  parties: { label:'طرف حساب‌ها', group:'اطلاعات پایه', icon:'◎', dated:false, description:'مشتری، تأمین‌کننده و اطلاعات شناسایی', columns:[['name','نام'],['kind','نوع'],['phone','تلفن'],['email','ایمیل'],['national_id','شناسه ملی'],['is_active','وضعیت']] }
});

const STATUS_FA = Object.freeze({ draft:'پیش‌نویس', posted:'ثبت قطعی', reversed:'برگشتی', active:'فعال', inactive:'غیرفعال' });
const TYPE_FA = Object.freeze({ sale:'فروش', purchase:'خرید', receipt:'دریافت', payment:'پرداخت', transfer:'انتقال', customer:'مشتری', vendor:'تأمین‌کننده', both:'مشتری و تأمین‌کننده', inventory:'کالا', service:'خدمت', purchase_receipt:'رسید خرید', sale_issue:'حواله فروش', manual_receipt:'رسید دستی', manual_issue:'حواله دستی', warehouse_transfer:'انتقال بین انبار' });
const MONEY_KEYS = new Set(['subtotal_amount','tax_total','total_amount','debit_total','credit_total','amount','inventory_value','average_unit_cost','unit_cost','value_delta']);
const DATE_KEYS = new Set(['invoice_date','entry_date','tx_date','movement_date']);
const NUMBER_KEYS = new Set(['quantity_on_hand','quantity_delta','min_stock','posting_seq','document_no']);

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
const faDate = value => { if (!value) return '—'; try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(`${value}T12:00:00`)); } catch { return '—'; } };
const money = value => { const number = Number(value || 0); return `${number.toLocaleString('fa-IR',{maximumFractionDigits:2})} تومان`; };
const numberFa = value => Number(value || 0).toLocaleString('fa-IR',{maximumFractionDigits:6});

async function context() {
  const state = await C.companyContext.ensure(); const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED'); const user = await C.user(); return { company, user };
}
function currentColumns(source, definition={}) {
  const all = SOURCES[source]?.columns || []; const selected = Array.isArray(definition.columns) && definition.columns.length ? definition.columns : all.map(([key]) => key);
  return all.filter(([key]) => selected.includes(key));
}
function formatCell(key,value) {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY_KEYS.has(key)) return money(value); if (DATE_KEYS.has(key)) return faDate(value); if (NUMBER_KEYS.has(key)) return numberFa(value);
  if (key === 'status' || key === 'document_status') return STATUS_FA[value] || 'نامشخص';
  if (['invoice_type','tx_type','kind','item_type','document_type'].includes(key)) return TYPE_FA[value] || String(value);
  if (key === 'is_active') return value ? 'فعال' : 'غیرفعال';
  if (key === 'below_min_stock') return value ? 'کمتر از حداقل' : 'عادی';
  return String(value);
}
async function loadReports(force=false) {
  if (loading && !force) return; loading = true;
  try { const { company } = await context(); reports = await C.select('custom_reports',`select=id,name,source_key,definition,visibility,created_by,updated_at&workspace_id=eq.${company.id}&is_active=eq.true&order=updated_at.desc`) || []; }
  finally { loading = false; }
}
function reportCard(report) {
  const source = SOURCES[report.source_key]; const columnCount = currentColumns(report.source_key, report.definition || {}).length;
  return `<article class="avan-custom-report-row"><div class="avan-report-card-main"><span class="avan-report-icon">${esc(source?.icon || '▥')}</span><div><strong>${esc(report.name)}</strong><span>${esc(source?.label || 'گزارش')} · ${columnCount.toLocaleString('fa-IR')} ستون · ${report.visibility === 'company' ? 'مشترک با شرکت' : 'خصوصی'}</span></div></div><div class="row-actions"><button class="ghost small" data-run-custom-report="${report.id}">اجرای گزارش</button><button class="danger small" data-delete-custom-report="${report.id}">حذف</button></div></article>`;
}
function sourceCatalog() {
  const groups = [...new Set(Object.values(SOURCES).map(source => source.group))];
  return groups.map(group => `<div class="avan-report-source-group"><strong>${group}</strong><div class="avan-report-source-grid">${Object.entries(SOURCES).filter(([,source]) => source.group === group).map(([key,source], index) => `<label class="avan-report-source-card"><input type="radio" name="source" value="${key}" ${group === groups[0] && index === 0 ? 'checked' : ''}><span class="avan-report-source-icon">${source.icon}</span><b>${source.label}</b><small>${source.description}</small></label>`).join('')}</div></div>`).join('');
}
async function render(force=false) {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'گزارش‌ها') return;
  const content = document.getElementById('content'); if (!content) return;
  let card = content.querySelector('[data-custom-report-builder]');
  if (!card) { card = document.createElement('section'); card.className = 'section card avan-custom-reports'; card.dataset.customReportBuilder = '1'; content.append(card); }
  try {
    await loadReports(force);
    card.innerHTML = `<div class="section-head"><div><h2>گزارش‌های من</h2><span class="muted">گزارش دلخواه مالی، انبار و اطلاعات پایه را بدون نیاز به برنامه‌نویسی بسازید.</span></div><button class="primary" id="createCustomReport">＋ ساخت گزارش جدید</button></div><div class="avan-custom-report-list">${reports.length ? reports.map(reportCard).join('') : '<div class="empty">هنوز گزارش دلخواهی ساخته نشده است.</div>'}</div>`;
    card.querySelector('#createCustomReport')?.addEventListener('click',openBuilder);
    card.querySelectorAll('[data-run-custom-report]').forEach(button => button.addEventListener('click',() => runReport(button.dataset.runCustomReport)));
    card.querySelectorAll('[data-delete-custom-report]').forEach(button => button.addEventListener('click',() => removeReport(button.dataset.deleteCustomReport)));
  } catch (error) { showError(error,'custom report builder'); }
}
function columnOptions(source,selected=null) {
  const columns = SOURCES[source]?.columns || []; const chosen = selected || columns.map(([key]) => key);
  return columns.map(([key,label]) => `<label class="avan-report-column"><input type="checkbox" name="columns" value="${key}" ${chosen.includes(key) ? 'checked' : ''}><span>${label}</span></label>`).join('');
}
function openBuilder() {
  openModal(`<div class="section-head"><div><h2>ساخت گزارش دلخواه</h2><span class="muted">ابتدا حوزه گزارش را انتخاب کنید، سپس ستون‌های مورد نیاز را تعیین کنید.</span></div></div><form id="customReportForm"><div class="form-grid"><div class="field"><label>نام گزارش</label><input name="name" maxlength="120" required placeholder="مثلاً موجودی کالا به تفکیک انبار"></div><div class="field"><label>دسترسی</label><select name="visibility"><option value="private">فقط من</option><option value="company">کاربران مجاز شرکت</option></select></div></div><div class="section avan-report-source-section"><h3>منبع گزارش</h3>${sourceCatalog()}</div><div class="section"><h3>ستون‌های گزارش</h3><div id="customReportColumns" class="avan-report-columns">${columnOptions('invoices')}</div></div><div class="info-box">گزارش‌ساز فقط از منابع امن و ازپیش‌تعریف‌شده آوان استفاده می‌کند و هیچ دستور مستقیم پایگاه داده از کاربر دریافت نمی‌کند.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ذخیره گزارش</button></div></form>`);
  document.getElementById('cancelModal').onclick = closeModal; const form = document.getElementById('customReportForm');
  form.querySelectorAll('[name="source"]').forEach(input => input.addEventListener('change',() => { document.getElementById('customReportColumns').innerHTML = columnOptions(input.value); }));
  form.addEventListener('submit',async event => {
    event.preventDefault(); const data = new FormData(form); const columns = data.getAll('columns').map(String); if (!columns.length) return toast('حداقل یک ستون را انتخاب کنید');
    try {
      const { company,user } = await context();
      await C.insert('custom_reports',{workspace_id:company.id,created_by:user.id,name:String(data.get('name')||'').trim(),source_key:String(data.get('source')||''),visibility:String(data.get('visibility')||'private'),definition:{columns,version:2}});
      closeModal(); await render(true); toast('گزارش دلخواه ذخیره شد');
    } catch (error) { showError(error,'custom report save'); }
  });
}
async function executeReport(report, from=null, to=null) {
  const { company } = await context();
  return C.rpc('run_custom_report',{wid:company.id,p_source_key:report.source_key,p_from:from||null,p_to:to||null,p_limit:500});
}
function resultHtml(report, result) {
  const columns = currentColumns(report.source_key,report.definition||{}); const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows.length ? `<div class="table-wrap"><table><thead><tr>${columns.map(([,label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(([key]) => `<td>${esc(formatCell(key,row[key]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="muted">${rows.length.toLocaleString('fa-IR')} ردیف</div>` : '<div class="empty">داده‌ای برای این گزارش پیدا نشد.</div>';
}
async function runReport(id) {
  const report = reports.find(item => item.id === id); if (!report) return; const source = SOURCES[report.source_key];
  const range = source?.dated ? `<form id="runCustomReportRange" class="form-grid"><div class="field"><label>از تاریخ</label><input type="date" name="from"></div><div class="field"><label>تا تاریخ</label><input type="date" name="to"></div><div class="field"><label>&nbsp;</label><button class="primary">اجرای گزارش</button></div></form>` : `<div class="form-actions"><button class="primary" id="runCustomReportNow">اجرای گزارش</button></div>`;
  openModal(`<div class="section-head"><div><h2>${esc(report.name)}</h2><span class="muted">${esc(source?.description || '')}</span></div></div>${range}<div id="customReportResult" class="section"><div class="muted">برای نمایش نتیجه، گزارش را اجرا کنید.</div></div><div class="form-actions"><button class="ghost" id="cancelModal">بستن</button></div>`);
  document.getElementById('cancelModal').onclick = closeModal; const host = document.getElementById('customReportResult');
  const execute = async (from=null,to=null) => { host.innerHTML = '<div class="loading">در حال تهیه گزارش…</div>'; try { host.innerHTML = resultHtml(report,await executeReport(report,from,to)); } catch (error) { host.innerHTML = '<div class="error-box">تهیه گزارش انجام نشد.</div>'; console.error(error); } };
  if (source?.dated) document.getElementById('runCustomReportRange').addEventListener('submit',event => { event.preventDefault(); const fd = new FormData(event.target); void execute(fd.get('from')||null,fd.get('to')||null); });
  else document.getElementById('runCustomReportNow').onclick = () => void execute();
}
async function removeReport(id) {
  if (!confirm('این گزارش دلخواه حذف شود؟')) return;
  try { await C.remove('custom_reports',`id=eq.${encodeURIComponent(id)}`); await render(true); toast('گزارش حذف شد'); }
  catch (error) { showError(error,'custom report delete'); }
}

Lifecycle.use('reports:custom-builder',() => render(false),{priority:320});
window.addEventListener('avan:company-context-changed',() => { reports=[]; Lifecycle.schedule('custom-reports-company'); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',() => Lifecycle.schedule('custom-reports-ready'),{once:true}); else Lifecycle.schedule('custom-reports-ready');
