'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { openModal, closeModal } from '../components/modal.js';
import { toast, showError } from '../feedback/toast.js';
import { MoneyRuntime } from '../money/money-runtime.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
let reports = [];
let loading = false;

const C = installAvanCloud();

const c = (key, label, group = 'عمومی') => [key, label, group];
const SOURCES = Object.freeze({
  composite_events: {
    label:'گزارش ترکیبی — همه متغیرها', group:'ترکیبی', icon:'◇', dated:true,
    description:'رویدادهای مالی، فاکتور، انبار، تسویه، چک و اسناد هوشمند در یک ماتریس گزارش‌گیری امن',
    defaultColumns:['event_date','event_domain','reference_no','party_name','status','invoice_total','transaction_amount','item_name','quantity','inventory_value'],
    columns:[
      c('event_date','تاریخ رویداد'),c('event_domain','حوزه رویداد'),c('event_type','نوع رویداد'),c('reference_no','شماره/مرجع'),c('status','وضعیت'),c('description','شرح'),
      c('company_name','نام شرکت','شرکت'),c('base_currency','واحد پایه','شرکت'),
      c('party_name','طرف حساب','طرف حساب'),c('party_kind','نوع طرف حساب','طرف حساب'),
      c('invoice_no','شماره فاکتور','فاکتور'),c('invoice_type','نوع فاکتور','فاکتور'),c('invoice_due_date','سررسید فاکتور','فاکتور'),c('invoice_subtotal','جمع قبل از مالیات','فاکتور'),c('invoice_tax','مالیات','فاکتور'),c('invoice_total','جمع نهایی فاکتور','فاکتور'),
      c('journal_no','شماره سند حسابداری','سند حسابداری'),c('journal_source','منبع سند','سند حسابداری'),c('journal_debit','جمع بدهکار','سند حسابداری'),c('journal_credit','جمع بستانکار','سند حسابداری'),
      c('transaction_type','نوع دریافت/پرداخت','خزانه'),c('transaction_amount','مبلغ تراکنش','خزانه'),c('from_account','حساب مبدأ','خزانه'),c('to_account','حساب مقصد','خزانه'),c('counterpart_account','حساب مقابل','خزانه'),
      c('inventory_document_no','شماره سند انبار','انبار'),c('inventory_document_type','نوع سند انبار','انبار'),c('item_sku','کد کالا','انبار'),c('item_name','نام کالا','انبار'),c('warehouse_name','انبار','انبار'),c('quantity','مقدار','انبار'),c('unit_cost','بهای واحد','انبار'),c('inventory_value','ارزش موجودی/حرکت','انبار'),
      c('settlement_due_date','سررسید تسویه','تسویه'),c('settlement_method','روش تسویه','تسویه'),c('settlement_amount','مبلغ برنامه تسویه','تسویه'),c('settled_amount','مبلغ تسویه‌شده','تسویه'),
      c('check_number','شماره چک','چک'),c('check_bank_name','بانک چک','چک'),c('check_direction','نوع چک','چک'),c('check_due_date','سررسید چک','چک'),
      c('smart_document_type','نوع سند هوشمند','اسناد هوشمند'),c('smart_document_status','وضعیت سند هوشمند','اسناد هوشمند'),c('smart_document_file_name','نام فایل','اسناد هوشمند'),c('smart_document_amount','مبلغ سند هوشمند','اسناد هوشمند')
    ]
  },
  invoices: { label:'فاکتورها', group:'مالی', icon:'▤', dated:true, description:'فروش و خرید، طرف حساب و جمع‌های مالی', columns:[c('invoice_no','شماره فاکتور'),c('invoice_date','تاریخ'),c('invoice_type','نوع فاکتور'),c('status','وضعیت'),c('party_name','طرف حساب'),c('subtotal_amount','جمع قبل از مالیات'),c('tax_total','مالیات'),c('total_amount','جمع نهایی')] },
  invoice_lines: { label:'ریز فاکتورها', group:'مالی', icon:'▥', dated:true, description:'ردیف‌های فاکتور با کالا، مقدار، قیمت، تخفیف و مالیات', columns:[c('invoice_no','شماره فاکتور'),c('invoice_date','تاریخ'),c('invoice_type','نوع فاکتور'),c('status','وضعیت'),c('party_name','طرف حساب'),c('line_no','ردیف'),c('item_sku','کد کالا'),c('item_name','نام کالا'),c('warehouse_name','انبار'),c('description','شرح'),c('quantity','تعداد'),c('unit_price','فی'),c('discount','تخفیف'),c('line_total','جمع ردیف'),c('tax_rate','نرخ مالیات'),c('taxable_amount','مبلغ مشمول'),c('tax_amount','مالیات ردیف'),c('tax_profile_name','وضعیت مالیاتی')] },
  journals: { label:'اسناد حسابداری', group:'مالی', icon:'≡', dated:true, description:'سند، شرح، منبع و جمع بدهکار و بستانکار', columns:[c('journal_no','شماره سند'),c('entry_date','تاریخ'),c('description','شرح'),c('status','وضعیت'),c('source_type','منبع'),c('debit_total','جمع بدهکار'),c('credit_total','جمع بستانکار')] },
  journal_lines: { label:'ریز اسناد حسابداری', group:'مالی', icon:'☷', dated:true, description:'ردیف‌های بدهکار/بستانکار با حساب و طرف حساب', columns:[c('journal_no','شماره سند'),c('entry_date','تاریخ'),c('status','وضعیت'),c('source_type','منبع'),c('line_no','ردیف'),c('account_code','کد حساب'),c('account_name','نام حساب'),c('party_name','طرف حساب'),c('description','شرح'),c('debit','بدهکار'),c('credit','بستانکار')] },
  transactions: { label:'دریافت، پرداخت و انتقال', group:'خزانه', icon:'↔', dated:true, description:'عملیات بانکی/صندوق با حساب‌ها و طرف حساب', columns:[c('tx_date','تاریخ'),c('tx_type','نوع عملیات'),c('party_name','طرف حساب'),c('amount','مبلغ'),c('from_account','حساب مبدأ'),c('to_account','حساب مقصد'),c('counterpart_account','حساب مقابل'),c('description','شرح'),c('status','وضعیت')] },
  settlements: { label:'شرایط و برنامه تسویه', group:'خزانه', icon:'⌛', dated:true, description:'اقساط، سررسید، روش تسویه و مبلغ تسویه‌شده', columns:[c('invoice_no','شماره فاکتور'),c('invoice_date','تاریخ فاکتور'),c('party_name','طرف حساب'),c('installment_no','شماره قسط'),c('due_date','سررسید'),c('planned_method','روش'),c('amount','مبلغ'),c('settled_amount','تسویه‌شده'),c('status','وضعیت'),c('financial_account','حساب مالی'),c('check_number','شماره چک')] },
  checks: { label:'چک‌ها', group:'خزانه', icon:'▱', dated:true, description:'چک‌های دریافتنی/پرداختنی و وضعیت آن‌ها', columns:[c('issue_date','تاریخ صدور'),c('due_date','سررسید'),c('direction','نوع چک'),c('check_number','شماره چک'),c('bank_name','بانک'),c('branch','شعبه'),c('account_number','شماره حساب'),c('party_name','طرف حساب'),c('invoice_no','شماره فاکتور'),c('amount','مبلغ'),c('status','وضعیت')] },
  inventory_items: { label:'کالاها', group:'انبار و کالا', icon:'□', dated:false, description:'فهرست کالا، گروه، واحد، بارکد و حداقل موجودی', columns:[c('sku','کد کالا'),c('barcode','بارکد'),c('item_name','نام کالا'),c('item_type','نوع'),c('group_name','گروه کالا'),c('unit_name','واحد'),c('min_stock','حداقل موجودی'),c('is_active','وضعیت')] },
  inventory_stock: { label:'موجودی انبار', group:'انبار و کالا', icon:'▦', dated:false, description:'موجودی هر کالا در هر انبار، ارزش و میانگین بها', columns:[c('sku','کد کالا'),c('item_name','نام کالا'),c('warehouse_name','انبار'),c('unit_name','واحد'),c('quantity_on_hand','موجودی'),c('inventory_value','ارزش موجودی'),c('average_unit_cost','میانگین بهای واحد'),c('min_stock','حداقل موجودی'),c('below_min_stock','کنترل حداقل')] },
  inventory_movements: { label:'گردش کالا', group:'انبار و کالا', icon:'⇄', dated:true, description:'ریز ورود و خروج کالا، مقدار و ارزش', columns:[c('movement_date','تاریخ'),c('posting_seq','ترتیب ثبت'),c('sku','کد کالا'),c('item_name','نام کالا'),c('warehouse_name','انبار'),c('quantity_delta','تغییر مقدار'),c('unit_cost','بهای واحد'),c('value_delta','تغییر ارزش'),c('document_no','شماره سند انبار'),c('document_type','نوع سند'),c('document_status','وضعیت سند')] },
  inventory_documents: { label:'اسناد انبار', group:'انبار و کالا', icon:'▧', dated:true, description:'رسید، حواله، انتقال، برگشت و مرجع آن‌ها', columns:[c('document_no','شماره سند'),c('document_date','تاریخ'),c('document_type','نوع سند'),c('status','وضعیت'),c('source_type','منبع'),c('description','شرح'),c('journal_no','شماره سند حسابداری')] },
  accounts: { label:'حساب‌ها', group:'اطلاعات پایه', icon:'▦', dated:false, description:'کدینگ حساب‌ها، سطح، ماهیت و وضعیت ثبت‌پذیری', columns:[c('code','کد حساب'),c('name','نام حساب'),c('level','سطح'),c('category','گروه حساب'),c('normal_balance','ماهیت'),c('is_postable','ثبت‌پذیر'),c('is_system','سیستمی'),c('is_active','فعال')] },
  financial_accounts: { label:'بانک و صندوق', group:'اطلاعات پایه', icon:'▣', dated:false, description:'حساب‌های بانکی/صندوق و اتصال آن‌ها به حساب معین', columns:[c('kind','نوع'),c('ledger_code','کد حساب'),c('ledger_name','نام حساب'),c('bank_name','بانک'),c('account_number','شماره حساب'),c('card_number','شماره کارت'),c('iban','شبا'),c('branch_name','شعبه'),c('is_active','فعال')] },
  parties: { label:'طرف حساب‌ها', group:'اطلاعات پایه', icon:'◎', dated:false, description:'مشتری، تأمین‌کننده و اطلاعات شناسایی', columns:[c('name','نام'),c('kind','نوع'),c('phone','تلفن'),c('email','ایمیل'),c('national_id','شناسه ملی'),c('economic_code','کد اقتصادی'),c('postal_code','کد پستی'),c('is_active','وضعیت')] },
  smart_documents: { label:'اسناد هوشمند', group:'اسناد هوشمند', icon:'▧', dated:true, description:'فایل‌های بارگذاری‌شده، نوع، وضعیت، مبلغ و لینک سند حسابداری', columns:[c('source_document_date','تاریخ سند'),c('document_type','نوع'),c('status','وضعیت'),c('file_name','نام فایل'),c('mime_type','نوع فایل'),c('size_bytes','حجم'),c('party_name','طرف حساب'),c('total_amount','مبلغ'),c('journal_no','شماره سند حسابداری')] }
});

const STATUS_FA = Object.freeze({ draft:'پیش‌نویس', posted:'ثبت قطعی', reversed:'برگشتی', active:'فعال', inactive:'غیرفعال', pending:'در انتظار', settled:'تسویه‌شده', issued:'صادرشده', received:'دریافت‌شده', cleared:'وصول‌شده', bounced:'برگشتی', uploaded:'بارگذاری‌شده', extracted:'استخراج‌شده', reviewed:'بررسی‌شده', linked:'متصل‌شده' });
const TYPE_FA = Object.freeze({ sale:'فروش', purchase:'خرید', receipt:'دریافت', payment:'پرداخت', transfer:'انتقال', customer:'مشتری', vendor:'تأمین‌کننده', both:'مشتری و تأمین‌کننده', inventory:'کالا', service:'خدمت', purchase_receipt:'رسید خرید', sale_issue:'حواله فروش', manual_receipt:'رسید دستی', manual_issue:'حواله دستی', warehouse_transfer:'انتقال بین انبار', issue:'حواله', reversal:'برگشت', cash:'نقدی', bank:'بانکی', check:'چکی', credit:'اعتباری', installment:'اقساطی', mixed:'ترکیبی', incoming:'دریافتنی', outgoing:'پرداختنی' });
const MONEY_KEYS = new Set(['subtotal_amount','tax_total','total_amount','debit_total','credit_total','amount','inventory_value','average_unit_cost','unit_cost','value_delta','unit_price','discount','line_total','taxable_amount','tax_amount','debit','credit','settled_amount','invoice_subtotal','invoice_tax','invoice_total','journal_debit','journal_credit','transaction_amount','settlement_amount','smart_document_amount']);
const DATE_KEYS = new Set(['invoice_date','entry_date','tx_date','movement_date','document_date','issue_date','due_date','source_document_date','event_date','invoice_due_date','settlement_due_date','check_due_date']);
const NUMBER_KEYS = new Set(['quantity_on_hand','quantity_delta','quantity','min_stock','posting_seq','document_no','line_no','installment_no','size_bytes','tax_rate','level']);

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
const faDate = value => { if (!value) return '—'; try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(`${value}T12:00:00`)); } catch { return '—'; } };
const money = value => MoneyRuntime?.isReady() ? MoneyRuntime.formatCanonicalDecimal(String(value ?? 0), { withUnit:false }) : Number(value || 0).toLocaleString('fa-IR',{maximumFractionDigits:1});
const numberFa = value => Number(value || 0).toLocaleString('fa-IR',{maximumFractionDigits:6});

function installStyle() {
  if (document.getElementById('avanCustomReportBuilderStyle')) return;
  const style = document.createElement('style');
  style.id = 'avanCustomReportBuilderStyle';
  style.textContent = `
    .avan-custom-reports,.avan-custom-report-modal,.avan-custom-report-result{direction:rtl;font-family:'Vazirmatn',Tahoma,Arial,sans-serif}
    .avan-report-source-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:8px}
    .avan-report-source-card{display:grid;grid-template-columns:auto 1fr;gap:5px 9px;align-items:start;border:1px solid var(--line);border-radius:12px;padding:12px;cursor:pointer}
    .avan-report-source-card input{grid-row:1/4}.avan-report-source-card small{grid-column:2;color:var(--muted)}
    .avan-report-source-card:has(input:checked){border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 12%,transparent)}
    .avan-report-columns-toolbar{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0}.avan-report-columns-toolbar .field{flex:1;min-width:220px}
    .avan-report-variable-group{border:1px solid var(--line);border-radius:10px;padding:10px;margin:8px 0}.avan-report-variable-group>strong{display:block;margin-bottom:8px}
    .avan-report-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:7px}.avan-report-column{display:flex;gap:7px;align-items:center;padding:7px 8px;border-radius:8px;background:var(--surface2)}
    .avan-custom-report-result table thead th{text-align:center!important;vertical-align:middle!important}.avan-custom-report-result table td{text-align:right}.avan-custom-report-result table td.num{direction:ltr;unicode-bidi:isolate;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}
    .avan-custom-report-result [data-report-title]{text-align:center!important}.avan-custom-report-result .table-wrap{max-height:60vh}
    @media(max-width:700px){.avan-report-source-grid{grid-template-columns:1fr}.avan-report-columns{grid-template-columns:1fr}.avan-custom-report-result .table-wrap{max-height:55vh}}
  `;
  document.head.append(style);
}

async function context() {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  const user = await C.user();
  return { company, user };
}

function currentColumns(source, definition = {}) {
  const all = SOURCES[source]?.columns || [];
  const selected = Array.isArray(definition.columns) && definition.columns.length ? definition.columns : (SOURCES[source]?.defaultColumns || all.map(([key]) => key));
  return all.filter(([key]) => selected.includes(key));
}

function formatCell(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY_KEYS.has(key)) return money(value);
  if (DATE_KEYS.has(key)) return faDate(value);
  if (NUMBER_KEYS.has(key)) return numberFa(value);
  if (key === 'status' || key === 'document_status' || key === 'smart_document_status') return STATUS_FA[value] || String(value);
  if (['invoice_type','tx_type','kind','item_type','document_type','event_type','transaction_type','inventory_document_type','settlement_method','planned_method','direction','check_direction','party_kind'].includes(key)) return TYPE_FA[value] || String(value);
  if (['is_active','is_postable','is_system'].includes(key)) return value ? 'بله' : 'خیر';
  if (key === 'below_min_stock') return value ? 'کمتر از حداقل' : 'عادی';
  if (key === 'base_currency') return value === 'IRR' ? 'ریال' : value === 'IRT' ? 'تومان' : String(value);
  return String(value);
}

async function loadReports(force = false) {
  if (loading && !force) return;
  loading = true;
  try {
    const { company } = await context();
    reports = await C.select('custom_reports', `select=id,name,source_key,definition,visibility,created_by,updated_at&workspace_id=eq.${company.id}&is_active=eq.true&order=updated_at.desc`) || [];
  } finally { loading = false; }
}

function reportCard(report) {
  const source = SOURCES[report.source_key];
  const columnCount = currentColumns(report.source_key, report.definition || {}).length;
  return `<article class="avan-custom-report-row"><div class="avan-report-card-main"><span class="avan-report-icon">${esc(source?.icon || '▥')}</span><div><strong>${esc(report.name)}</strong><span>${esc(source?.label || 'گزارش')} · ${columnCount.toLocaleString('fa-IR')} ستون · ${report.visibility === 'company' ? 'مشترک با شرکت' : 'خصوصی'}</span></div></div><div class="row-actions"><button class="ghost small" data-run-custom-report="${report.id}">اجرای گزارش</button><button class="danger small" data-delete-custom-report="${report.id}">حذف</button></div></article>`;
}

function sourceCatalog() {
  const groups = [...new Set(Object.values(SOURCES).map(source => source.group))];
  return groups.map(group => `<div class="avan-report-source-group"><strong>${group}</strong><div class="avan-report-source-grid">${Object.entries(SOURCES).filter(([,source]) => source.group === group).map(([key,source]) => `<label class="avan-report-source-card"><input type="radio" name="source" value="${key}" ${key === 'composite_events' ? 'checked' : ''}><span class="avan-report-source-icon">${source.icon}</span><b>${source.label}</b><small>${source.description}</small></label>`).join('')}</div></div>`).join('');
}

async function render(force = false) {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'گزارش‌ها') return;
  installStyle();
  const content = document.getElementById('content');
  if (!content) return;
  let card = content.querySelector('[data-custom-report-builder]');
  if (!card) {
    card = document.createElement('section');
    card.className = 'section card avan-custom-reports';
    card.dataset.customReportBuilder = '1';
    content.append(card);
  }
  try {
    await loadReports(force);
    card.innerHTML = `<div class="section-head"><div><h2>گزارش‌های من</h2><span class="muted">گزارش دلخواه و ترکیبی را از متغیرهای مالی، حسابداری، خزانه، انبار، طرف حساب و اسناد هوشمند بسازید.</span></div><button class="primary" id="createCustomReport">＋ ساخت گزارش جدید</button></div><div class="avan-custom-report-list">${reports.length ? reports.map(reportCard).join('') : '<div class="empty">هنوز گزارش دلخواهی ساخته نشده است.</div>'}</div>`;
    card.querySelector('#createCustomReport')?.addEventListener('click', openBuilder);
    card.querySelectorAll('[data-run-custom-report]').forEach(button => button.addEventListener('click', () => runReport(button.dataset.runCustomReport)));
    card.querySelectorAll('[data-delete-custom-report]').forEach(button => button.addEventListener('click', () => removeReport(button.dataset.deleteCustomReport)));
  } catch (error) { showError(error, 'custom report builder'); }
}

function columnOptions(source, selected = null, query = '') {
  const columns = SOURCES[source]?.columns || [];
  const chosen = selected || SOURCES[source]?.defaultColumns || columns.map(([key]) => key);
  const q = String(query || '').trim().toLocaleLowerCase('fa-IR');
  const visible = columns.filter(([, label, group]) => !q || `${label} ${group}`.toLocaleLowerCase('fa-IR').includes(q));
  const groups = [...new Set(visible.map(([, , group]) => group || 'عمومی'))];
  return groups.map(group => `<div class="avan-report-variable-group"><strong>${esc(group)}</strong><div class="avan-report-columns">${visible.filter(([, , g]) => (g || 'عمومی') === group).map(([key,label]) => `<label class="avan-report-column"><input type="checkbox" name="columns" value="${key}" ${chosen.includes(key) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div></div>`).join('') || '<div class="empty">متغیری با این جستجو پیدا نشد.</div>';
}

function openBuilder() {
  installStyle();
  const initialSource = 'composite_events';
  openModal(`<div class="avan-custom-report-modal"><div class="section-head"><div><h2>ساخت گزارش دلخواه</h2><span class="muted">«گزارش ترکیبی — همه متغیرها» امکان انتخاب هم‌زمان متغیرهای چند حوزه را می‌دهد.</span></div></div><form id="customReportForm"><div class="form-grid"><div class="field"><label>نام گزارش</label><input name="name" maxlength="120" required placeholder="مثلاً فروش، وصول و گردش کالا به تفکیک طرف حساب"></div><div class="field"><label>دسترسی</label><select name="visibility"><option value="private">فقط من</option><option value="company">کاربران مجاز شرکت</option></select></div></div><div class="section avan-report-source-section"><h3>نوع گزارش / منبع داده</h3>${sourceCatalog()}</div><div class="section"><div class="section-head"><div><h3>متغیرهای گزارش</h3><span class="muted">تمام متغیرهای امن و قابل گزارش این منبع در این بخش نمایش داده می‌شوند.</span></div></div><div class="avan-report-columns-toolbar"><div class="field"><label>جستجوی متغیر</label><input id="customReportVariableSearch" placeholder="مثلاً طرف حساب، مالیات، انبار، چک…"></div><button type="button" class="ghost" id="selectAllReportVariables">انتخاب همه</button><button type="button" class="ghost" id="clearReportVariables">پاک کردن انتخاب‌ها</button></div><div id="customReportColumns">${columnOptions(initialSource)}</div></div><div class="info-box">گزارش‌ساز فقط از منابع و Joinهای امن ازپیش‌تعریف‌شده آوان استفاده می‌کند؛ هیچ SQL یا دستور مستقیم پایگاه داده از کاربر دریافت نمی‌شود.</div><div class="form-actions"><button type="button" class="ghost" id="cancelModal">انصراف</button><button class="primary">ذخیره گزارش</button></div></form></div>`);
  document.getElementById('cancelModal').onclick = closeModal;
  const form = document.getElementById('customReportForm');
  const host = document.getElementById('customReportColumns');
  const search = document.getElementById('customReportVariableSearch');
  let selected = new Map();

  const snapshotChecks = source => new Set([...host.querySelectorAll('[name="columns"]:checked')].map(node => node.value));
  const draw = source => {
    const chosen = selected.get(source) || SOURCES[source]?.defaultColumns || [];
    host.innerHTML = columnOptions(source, [...chosen], search.value);
  };
  const currentSource = () => form.querySelector('[name="source"]:checked')?.value || initialSource;

  form.querySelectorAll('[name="source"]').forEach(input => input.addEventListener('change', () => {
    const previous = [...form.querySelectorAll('[name="source"]')].find(node => node !== input && selected.has(node.value));
    if (previous) selected.set(previous.value, selected.get(previous.value));
    search.value = '';
    draw(input.value);
  }));
  search.addEventListener('input', () => {
    const source = currentSource();
    selected.set(source, snapshotChecks(source));
    draw(source);
  });
  document.getElementById('selectAllReportVariables').onclick = () => {
    const source = currentSource();
    selected.set(source, new Set((SOURCES[source]?.columns || []).map(([key]) => key)));
    draw(source);
  };
  document.getElementById('clearReportVariables').onclick = () => {
    const source = currentSource(); selected.set(source, new Set()); draw(source);
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(form);
    const source = String(data.get('source') || initialSource);
    const columns = [...host.querySelectorAll('[name="columns"]:checked')].map(node => node.value);
    if (!columns.length) return toast('حداقل یک متغیر را انتخاب کنید');
    try {
      const { company, user } = await context();
      await C.insert('custom_reports', { workspace_id:company.id, created_by:user.id, name:String(data.get('name') || '').trim(), source_key:source, visibility:String(data.get('visibility') || 'private'), definition:{ columns, version:3 } });
      closeModal();
      await render(true);
      toast('گزارش دلخواه ذخیره شد');
    } catch (error) { showError(error, 'custom report save'); }
  });
}

async function executeReport(report, from = null, to = null) {
  const { company } = await context();
  return C.rpc('run_custom_report', { wid:company.id, p_source_key:report.source_key, p_from:from || null, p_to:to || null, p_limit:1000 });
}

function resultHtml(report, result) {
  const columns = currentColumns(report.source_key, report.definition || {});
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const unit = MoneyRuntime?.unitLabel?.() || '';
  const header = ([key,label]) => MONEY_KEYS.has(key)
    ? `<th data-avan-money-column="1" data-avan-money-header-base="${esc(label)}" data-avan-money-unit="${esc(unit)}">${esc(label)}${unit ? ` (${esc(unit)})` : ''}</th>`
    : `<th>${esc(label)}</th>`;
  const cell = ([key], row) => `<td class="${MONEY_KEYS.has(key) || NUMBER_KEYS.has(key) ? 'num' : ''}">${esc(formatCell(key, row[key]))}</td>`;
  return rows.length
    ? `<div class="avan-custom-report-result"><h2 data-report-title>${esc(report.name)}</h2><div class="table-wrap"><table><thead><tr>${columns.map(header).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(column => cell(column,row)).join('')}</tr>`).join('')}</tbody></table></div><div class="muted">${rows.length.toLocaleString('fa-IR')} ردیف</div></div>`
    : '<div class="empty">داده‌ای برای این گزارش پیدا نشد.</div>';
}

async function runReport(id) {
  const report = reports.find(item => item.id === id);
  if (!report) return;
  const source = SOURCES[report.source_key];
  const range = source?.dated
    ? `<form id="runCustomReportRange" class="form-grid"><div class="field"><label>از تاریخ</label><input type="date" name="from"></div><div class="field"><label>تا تاریخ</label><input type="date" name="to"></div><div class="field"><label>&nbsp;</label><button class="primary">اجرای گزارش</button></div></form>`
    : `<div class="form-actions"><button class="primary" id="runCustomReportNow">اجرای گزارش</button></div>`;
  openModal(`<div class="section-head"><div><h2>گزارش: ${esc(report.name)}</h2><span class="muted">${esc(source?.description || '')}</span></div></div>${range}<div id="customReportResult" class="section"><div class="muted">برای نمایش نتیجه، گزارش را اجرا کنید.</div></div><div class="form-actions"><button class="ghost" id="cancelModal">بستن</button><button type="button" class="ghost" id="printCustomReport" disabled>چاپ / ذخیره PDF</button></div>`);
  document.getElementById('cancelModal').onclick = closeModal;
  const host = document.getElementById('customReportResult');
  const print = document.getElementById('printCustomReport');
  print.onclick = () => window.AvanPrintExport?.printElement?.(host, `گزارش ${report.name}`);
  const execute = async (from = null, to = null) => {
    host.innerHTML = '<div class="loading">در حال تهیه گزارش…</div>';
    print.disabled = true;
    try {
      host.innerHTML = resultHtml(report, await executeReport(report, from, to));
      print.disabled = !host.querySelector('table');
      window.AvanMoneyOutput?.project?.();
    } catch (error) {
      host.innerHTML = '<div class="error-box">تهیه گزارش انجام نشد.</div>';
      console.error(error);
    }
  };
  if (source?.dated) document.getElementById('runCustomReportRange').addEventListener('submit', event => {
    event.preventDefault(); const fd = new FormData(event.target); void execute(fd.get('from') || null, fd.get('to') || null);
  });
  else document.getElementById('runCustomReportNow').onclick = () => void execute();
}

async function removeReport(id) {
  if (!confirm('این گزارش دلخواه حذف شود؟')) return;
  try {
    await C.remove('custom_reports', `id=eq.${encodeURIComponent(id)}`);
    await render(true);
    toast('گزارش حذف شد');
  } catch (error) { showError(error, 'custom report delete'); }
}

Lifecycle.use('reports:custom-builder', () => render(false), { priority:320 });
window.addEventListener('avan:page-rendered', () => Lifecycle.schedule('custom-reports-page'));
window.addEventListener('avan:company-context-changed', () => { reports = []; Lifecycle.schedule('custom-reports-company'); });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('custom-reports-ready'), { once:true });
else Lifecycle.schedule('custom-reports-ready');
