'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { toast, showError } from './src/ui/feedback/toast.js';

const C = installAvanCloud();
const baseRpc = C.rpc.bind(C);
const baseInsert = C.insert.bind(C);
const baseUpdate = C.update.bind(C);
const SETTINGS_ROLES = new Set(['owner', 'manager']);
const ITEM_ROLES = new Set(['owner', 'manager', 'accountant']);
const TAXPAYER_FA = { unspecified:'تعیین نشده', individual:'شخص حقیقی', legal_entity:'شخص حقوقی', nonprofit:'غیرانتفاعی', other:'سایر' };
const TREATMENT_FA = { standard:'مشمول نرخ استاندارد', exempt:'معاف', zero:'نرخ صفر', custom:'نرخ سفارشی' };

let cache = null;
let editingInvoiceId = null;
let viewingInvoiceId = null;
let requestedInvoiceType = null;
let scheduleTimer = null;
let reportBusy = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[ch]));
const latin = value => String(value ?? '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const cleanDigits = value => latin(value).replace(/[٬,\s]/g, '');
const toBig = value => {
  try { return BigInt(String(value ?? 0).replace(/\.0+$/, '') || '0'); }
  catch { return 0n; }
};
const money = value => {
  let n = toBig(value);
  const sign = n < 0n ? '−' : '';
  if (n < 0n) n = -n;
  return `${sign}${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} تومان`;
};
const faDate = iso => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year:'numeric', month:'2-digit', day:'2-digit'
    }).format(new Date(`${iso}T12:00:00`));
  } catch { return iso || '—'; }
};
const pageTitle = () => document.getElementById('pageTitle')?.textContent?.trim() || '';

async function activeCompany() {
  const state = await C.companyContext.ensure();
  if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function loadData(force = false) {
  const company = await activeCompany();
  if (!force && cache?.company?.id === company.id) return cache;
  const wid = company.id;
  const [settings, profiles, rules, items, years, role] = await Promise.all([
    C.select('workspace_tax_settings', `select=*&workspace_id=eq.${wid}&limit=1`),
    C.select('tax_profiles', `select=id,code,name_fa,treatment,rate,applies_to,rule_version_id,is_active&workspace_id=eq.${wid}&order=code.asc`),
    C.select('tax_rule_versions', 'select=id,name_fa,effective_from,effective_to,standard_vat_rate,status,source_title,source_reference&status=eq.active&order=effective_from.desc'),
    C.select('inventory_items', `select=id,sku,name,item_type,tax_profile_id,is_active&workspace_id=eq.${wid}&order=name.asc`),
    C.select('fiscal_years', `select=id,name,date_from,date_to,status&workspace_id=eq.${wid}&order=date_from.desc`),
    C.rpc('workspace_role', { wid })
  ]);
  cache = {
    company,
    settings: settings?.[0] || { workspace_id: wid, tax_enabled: false, taxpayer_type: 'unspecified' },
    profiles: profiles || [],
    rules: rules || [],
    items: items || [],
    years: years || [],
    role
  };
  return cache;
}

function profileLabel(profile) {
  if (!profile) return '—';
  const rate = Number(profile.rate || 0);
  const suffix = profile.treatment === 'exempt'
    ? 'معاف'
    : profile.treatment === 'zero'
      ? 'نرخ صفر'
      : `${rate.toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪`;
  return `${profile.name_fa} — ${suffix}`;
}

function profileOptions(data, selected = '', invoiceType = null, placeholder = 'انتخاب وضعیت مالیاتی…') {
  const profiles = data.profiles.filter(profile =>
    profile.is_active && (!invoiceType || profile.applies_to === 'both' || profile.applies_to === invoiceType)
  );
  return `<option value="">${esc(placeholder)}</option>` + profiles.map(profile =>
    `<option value="${profile.id}" ${profile.id === selected ? 'selected' : ''}>${esc(profileLabel(profile))}</option>`
  ).join('');
}

function currentRule(data) {
  return data.rules.find(row => row.id === data.settings.default_rule_version_id) || data.rules[0] || null;
}

async function renderTaxSettings(force = false) {
  if (pageTitle() !== 'تنظیمات') return;
  const root = document.getElementById('content');
  if (!root) return;
  const existing = root.querySelector('[data-rc15-tax-settings]');
  if (existing && !force) return;

  try {
    const data = await loadData(force);
    const settings = data.settings;
    const rule = currentRule(data);
    const canEdit = SETTINGS_ROLES.has(data.role);
    const missingProfiles = data.items.filter(item => item.is_active && !item.tax_profile_id).length;
    const ruleText = rule
      ? `${rule.name_fa} — نرخ عمومی ${Number(rule.standard_vat_rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪ — ${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ''}`
      : 'قاعده فعال مالیاتی پیدا نشد.';

    const card = document.createElement('section');
    card.className = 'section card rc15-tax-settings';
    card.dataset.rc15TaxSettings = '1';
    card.innerHTML = `
      <div class="section-head">
        <div><h2>مالیات و ارزش افزوده</h2><span class="muted">نرخ‌ها از قواعد نسخه‌بندی‌شده خوانده می‌شوند و فعال‌سازی خودکار نیست.</span></div>
        <span class="summary-pill ${settings.tax_enabled ? 'pos' : 'warn'}">${settings.tax_enabled ? 'فعال' : 'غیرفعال'}</span>
      </div>
      <div class="rc15-tax-rule"><b>قاعده جاری:</b> ${esc(ruleText)}</div>
      ${missingProfiles ? `<div class="info-box">${missingProfiles.toLocaleString('fa-IR')} کالا/خدمت فعال هنوز پروفایل مالیاتی ندارد.</div>` : ''}
      ${canEdit ? `
        <form id="rc15TaxSettingsForm" class="section">
          <label class="rc15-tax-toggle">
            <input type="checkbox" name="tax_enabled" ${settings.tax_enabled ? 'checked' : ''}>
            <span><b>فعال‌سازی محاسبه مالیات در فاکتورها</b><small>پس از فعال‌سازی، هر ردیف فاکتور باید وضعیت مالیاتی معتبر داشته باشد.</small></span>
          </label>
          <div class="form-grid section">
            <div class="field"><label>نوع مودی</label><select name="taxpayer_type">${Object.entries(TAXPAYER_FA).map(([key, label]) => `<option value="${key}" ${key === (settings.taxpayer_type || 'unspecified') ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
            <div class="field"><label>شناسه مالیاتی</label><input name="tax_identifier" maxlength="96" value="${esc(settings.tax_identifier || '')}"></div>
            <div class="field"><label>کد اقتصادی</label><input name="economic_code" maxlength="64" value="${esc(settings.economic_code || '')}"></div>
            <div class="field"><label>شناسه حافظه مالیاتی</label><input name="taxpayer_memory_id" maxlength="96" value="${esc(settings.taxpayer_memory_id || '')}"></div>
          </div>
          <div class="info-box">ارسال صورتحساب الکترونیکی در این Gate فعال نیست و در RC1.5-D فقط با اقدام صریح کاربر بررسی می‌شود.</div>
          <div class="form-actions"><button type="button" class="ghost" data-rc15-tax-items>تنظیم مالیات کالا/خدمت</button><button class="primary">ذخیره تنظیمات مالیاتی</button></div>
        </form>` : `
        <div class="info-box section">ویرایش تنظیمات مالیاتی فقط در اختیار مالک و مدیر شرکت است. نوع مودی: ${esc(TAXPAYER_FA[settings.taxpayer_type] || 'تعیین نشده')}</div>`}
    `;

    if (existing) existing.replaceWith(card); else root.append(card);
    card.querySelector('[data-rc15-tax-items]')?.addEventListener('click', () =>
      document.querySelector('#nav [data-page="inventory"]')?.click()
    );

    const form = card.querySelector('#rc15TaxSettingsForm');
    if (form) form.onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(form);
      const enabled = fd.get('tax_enabled') === 'on';
      if (enabled && !settings.tax_enabled) {
        const approved = window.confirm('با فعال‌سازی مالیات، مبلغ VAT در فاکتور و سند حسابداری ثبت می‌شود. ادامه می‌دهید؟');
        if (!approved) return;
      }
      try {
        await C.rpc('set_workspace_tax_settings', {
          wid: data.company.id,
          p_tax_enabled: enabled,
          p_taxpayer_type: String(fd.get('taxpayer_type') || 'unspecified'),
          p_tax_identifier: String(fd.get('tax_identifier') || '').trim() || null,
          p_economic_code: String(fd.get('economic_code') || '').trim() || null,
          p_taxpayer_memory_id: String(fd.get('taxpayer_memory_id') || '').trim() || null
        });
        cache = null;
        toast('تنظیمات مالیاتی شرکت ذخیره شد');
        card.remove();
        await renderTaxSettings(true);
      } catch (error) { showError(error, 'RC1.5 tax settings'); }
    };
  } catch (error) { showError(error, 'RC1.5 tax settings load'); }
}

function injectItemTaxField(form, data) {
  if (!form || form.dataset.rc15TaxReady === '1') return;
  const grid = form.querySelector('.form-grid');
  if (!grid) return;
  form.dataset.rc15TaxReady = '1';
  const sku = form.querySelector('[name="sku"]')?.value || '';
  const item = data.items.find(row => row.sku === sku);
  const field = document.createElement('div');
  field.className = 'field rc15-item-tax-field';
  field.innerHTML = `<label>وضعیت مالیاتی پیش‌فرض</label><select data-rc15-item-tax>${profileOptions(data, item?.tax_profile_id || '', null, 'بدون پروفایل پیش‌فرض')}</select><small>در هر ردیف فاکتور می‌توان این انتخاب را تغییر داد.</small>`;
  grid.append(field);
  if (!ITEM_ROLES.has(data.role)) field.querySelector('select').disabled = true;
}

function enrichInventoryItem(table, payload) {
  if (table !== 'inventory_items' || !payload || typeof payload !== 'object') return payload;
  const select = document.querySelector('#rc14ItemForm [data-rc15-item-tax]');
  return select ? { ...payload, tax_profile_id: select.value || null } : payload;
}

C.insert = (table, payload, ...rest) => baseInsert(table, enrichInventoryItem(table, payload), ...rest);
C.update = (table, payload, filter, ...rest) => baseUpdate(table, enrichInventoryItem(table, payload), filter, ...rest);

function invoiceType(form) {
  return form?.dataset?.rc14InvoiceType || requestedInvoiceType ||
    ((form?.closest('.modal')?.textContent || '').includes('خرید') ? 'purchase' : 'sale');
}

function decimalMicros(value) {
  const normalized = latin(value).trim().replace(/٫|,/g, '.').replace(/\s/g, '');
  if (!/^\d+(?:\.\d{0,6})?$/.test(normalized)) return null;
  const [integer, fraction = ''] = normalized.split('.');
  return BigInt(integer || '0') * 1000000n + BigInt((fraction + '000000').slice(0, 6));
}

function integerBig(value) {
  const normalized = cleanDigits(value);
  return /^\d+$/.test(normalized) ? BigInt(normalized) : null;
}

function rateUnits(value) {
  const [integer, fraction = ''] = String(value ?? 0).split('.');
  if (!/^\d+$/.test(integer) || !/^\d*$/.test(fraction)) return 0n;
  return BigInt(integer) * 10000n + BigInt((fraction + '0000').slice(0, 4));
}

function rowUsed(row) {
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function lineBase(row) {
  const quantity = decimalMicros(row.querySelector('[name="quantity"]')?.value || '1');
  const price = integerBig(row.querySelector('[name="unit_price"]')?.value || '0');
  const discount = integerBig(row.querySelector('[name="discount"]')?.value || '0');
  if (quantity === null || price === null || discount === null) return 0n;
  const gross = (quantity * price + 500000n) / 1000000n;
  return gross > discount ? gross - discount : 0n;
}

function syncProfileFromItem(row, data, type) {
  const select = row.querySelector('[data-rc15-tax-profile]');
  if (!select) return;
  const itemId = row.dataset.eItem || row.querySelector('[data-e-item]')?.value || '';
  const item = data.items.find(record => record.id === itemId);
  const profile = data.profiles.find(record =>
    record.id === item?.tax_profile_id && (record.applies_to === 'both' || record.applies_to === type)
  );
  select.value = profile?.id || '';
}

function refreshInvoiceTaxTotals(form, data) {
  const summary = form.querySelector('[data-rc15-invoice-tax-summary]');
  if (!summary) return;
  if (!data.settings.tax_enabled) {
    const next = '<div class="info-box">مالیات برای این شرکت غیرفعال است؛ مبلغ فاکتور بدون VAT محاسبه می‌شود.</div>';
    if (summary.innerHTML !== next) summary.innerHTML = next;
    return;
  }

  let subtotal = 0n;
  let tax = 0n;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    if (!rowUsed(row)) return;
    const base = lineBase(row);
    const select = row.querySelector('[data-rc15-tax-profile]');
    const profile = data.profiles.find(record => record.id === select?.value);
    const rowTax = profile ? (base * rateUnits(profile.rate) + 500000n) / 1000000n : 0n;
    subtotal += base;
    tax += rowTax;
    const note = row.querySelector('[data-rc15-line-tax-note]');
    if (note) {
      const text = profile ? `مالیات این ردیف: ${money(rowTax)}` : 'وضعیت مالیاتی را انتخاب کنید';
      if (note.textContent !== text) note.textContent = text;
    }
  });

  const html = `<div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(subtotal)}</b></span><span><small>مالیات</small><b>${money(tax)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(subtotal + tax)}</b></span></div>`;
  if (summary.innerHTML !== html) summary.innerHTML = html;
}

async function addTaxFieldsToInvoiceRows(form, data) {
  if (!data.settings.tax_enabled) return;
  const type = invoiceType(form);
  let snapshots = [];
  if (editingInvoiceId) {
    try {
      snapshots = await C.select('invoice_lines', `select=line_no,tax_profile_id&invoice_id=eq.${editingInvoiceId}&workspace_id=eq.${data.company.id}&order=line_no.asc`);
    } catch { snapshots = []; }
  }

  form.querySelectorAll('[data-invoice-line]').forEach((row, index) => {
    if (row.querySelector('[data-rc15-tax-profile]')) return;
    const field = document.createElement('div');
    field.className = 'field rc15-invoice-tax-field';
    field.innerHTML = `<label>وضعیت مالیاتی</label><select data-rc15-tax-profile required>${profileOptions(data, snapshots[index]?.tax_profile_id || '', type)}</select><small data-rc15-line-tax-note></small>`;
    const anchor = row.querySelector('[data-line-amount]') || row.lastElementChild;
    if (anchor) anchor.before(field); else row.append(field);

    const select = field.querySelector('select');
    if (!select.value) syncProfileFromItem(row, data, type);
    select.addEventListener('change', () => refreshInvoiceTaxTotals(form, data));

    const itemSelect = row.querySelector('[data-e-item]');
    if (itemSelect) itemSelect.addEventListener('change', () => setTimeout(() => {
      syncProfileFromItem(row, data, type);
      refreshInvoiceTaxTotals(form, data);
    }, 0));

    row.querySelectorAll('[name="quantity"],[name="unit_price"],[name="discount"]').forEach(input => {
      input.addEventListener('input', () => refreshInvoiceTaxTotals(form, data), { passive: true });
    });
  });
}

async function enhanceInvoiceForm(form) {
  if (!form || form.dataset.rc15TaxReady === '1') return;
  form.dataset.rc15TaxReady = '1';
  try {
    const data = await loadData();
    form.dataset.rc15TaxEnabled = data.settings.tax_enabled ? '1' : '0';
    const summary = document.createElement('section');
    summary.className = 'rc15-invoice-tax-summary';
    summary.dataset.rc15InvoiceTaxSummary = '1';
    const actions = form.querySelector('.form-actions');
    if (actions) actions.before(summary); else form.append(summary);
    await addTaxFieldsToInvoiceRows(form, data);
    refreshInvoiceTaxTotals(form, data);
  } catch (error) { showError(error, 'RC1.5 invoice tax UX'); }
}

async function refreshInvoiceRowsAfterAdd() {
  const form = document.getElementById('invoiceForm');
  if (!form) return;
  try {
    const data = await loadData();
    await addTaxFieldsToInvoiceRows(form, data);
    refreshInvoiceTaxTotals(form, data);
  } catch (error) { showError(error, 'RC1.5 invoice new line'); }
}

C.rpc = async (name, args = {}) => {
  if (name === 'save_draft_invoice' && Array.isArray(args.p_lines)) {
    const form = document.getElementById('invoiceForm');
    if (form?.dataset.rc15TaxEnabled === '1') {
      const rows = [...form.querySelectorAll('[data-invoice-line]')].filter(rowUsed);
      args = {
        ...args,
        p_lines: args.p_lines.map((line, index) => ({
          ...line,
          tax_profile_id: rows[index]?.querySelector('[data-rc15-tax-profile]')?.value || line.tax_profile_id || null
        }))
      };
    }
  }
  return baseRpc(name, args);
};

async function renderInvoiceTaxDetail() {
  if (!viewingInvoiceId) return;
  const modal = document.getElementById('modal');
  if (!modal || modal.querySelector('#invoiceForm') || modal.querySelector('[data-rc15-tax-detail]')) return;
  try {
    const data = await loadData();
    const [invoiceRows, lines] = await Promise.all([
      C.select('invoices', `select=id,invoice_no,subtotal_amount,tax_total,total_amount&workspace_id=eq.${data.company.id}&id=eq.${viewingInvoiceId}&limit=1`),
      C.select('invoice_lines', `select=line_no,tax_profile_id,tax_profile_name_fa,tax_treatment,tax_rate,taxable_amount,tax_amount&workspace_id=eq.${data.company.id}&invoice_id=eq.${viewingInvoiceId}&order=line_no.asc`)
    ]);
    const invoice = invoiceRows?.[0];
    if (!invoice || !(lines || []).some(line => line.tax_profile_id)) return;

    const card = document.createElement('section');
    card.className = 'card section rc15-tax-detail';
    card.dataset.rc15TaxDetail = '1';
    card.innerHTML = `
      <h3>مالیات فاکتور</h3>
      <div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(invoice.subtotal_amount)}</b></span><span><small>مالیات</small><b>${money(invoice.tax_total)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(invoice.total_amount)}</b></span></div>
      <div class="table-wrap section"><table><thead><tr><th>ردیف</th><th>وضعیت مالیاتی</th><th>نرخ</th><th>مبلغ مشمول (تومان)</th><th>مالیات (تومان)</th></tr></thead><tbody>${lines.map(line => `<tr><td>${Number(line.line_no).toLocaleString('fa-IR')}</td><td>${esc(line.tax_profile_name_fa || TREATMENT_FA[line.tax_treatment] || '—')}</td><td>${Number(line.tax_rate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪</td><td class="num">${money(line.taxable_amount)}</td><td class="num">${money(line.tax_amount)}</td></tr>`).join('')}</tbody></table></div>`;
    modal.append(card);
  } catch (error) { console.warn('[RC1.5 tax detail]', error); }
}

function reportRange(data) {
  const year = data.years.find(row => row.status === 'open') || data.years[0];
  return {
    from: document.getElementById('reportFrom')?.value || year?.date_from || new Date().toISOString().slice(0, 10),
    to: document.getElementById('reportTo')?.value || new Date().toISOString().slice(0, 10)
  };
}

async function renderVatReport(force = false) {
  if (pageTitle() !== 'گزارش‌ها' || reportBusy) return;
  const root = document.getElementById('content');
  if (!root) return;
  const existing = root.querySelector('[data-rc15-vat-report]');
  if (existing && !force) return;
  reportBusy = true;

  try {
    const data = await loadData(force);
    const range = reportRange(data);
    const rows = await C.rpc('report_vat_transactions', {
      wid: data.company.id,
      dfrom: range.from,
      dto: range.to
    }) || [];

    let output = 0n, input = 0n, saleBase = 0n, purchaseBase = 0n;
    rows.forEach(row => {
      const tax = toBig(row.tax_amount);
      const base = toBig(row.taxable_amount);
      if (row.invoice_type === 'sale') { output += tax; saleBase += base; }
      else { input += tax; purchaseBase += base; }
    });
    const net = output - input;

    const card = document.createElement('section');
    card.className = 'card section rc15-vat-report';
    card.dataset.rc15VatReport = '1';
    card.innerHTML = `
      <div class="section-head"><div><h2>گزارش مالیات بر ارزش افزوده</h2><span class="muted">بر مبنای تاریخ سند؛ برگشت در تاریخ خودش منفی می‌شود. ${faDate(range.from)} تا ${faDate(range.to)}</span></div><button class="ghost" type="button" data-rc15-tax-refresh>تازه‌سازی</button></div>
      <div class="grid4 section">
        <div class="card"><div class="kpi-label">مالیات فروش خروجی</div><div class="kpi-value">${money(output)}</div><small>پایه: ${money(saleBase)}</small></div>
        <div class="card"><div class="kpi-label">اعتبار مالیاتی خرید</div><div class="kpi-value">${money(input)}</div><small>پایه: ${money(purchaseBase)}</small></div>
        <div class="card"><div class="kpi-label">خالص دوره</div><div class="kpi-value ${net >= 0n ? 'warn' : 'pos'}">${money(net)}</div><small>${net >= 0n ? 'پرداختنی پیش از تعدیلات قانونی' : 'اعتبار خالص پیش از تعدیلات قانونی'}</small></div>
        <div class="card"><div class="kpi-label">محاسبه فاکتور</div><div class="kpi-value rc15-small-value">${data.settings.tax_enabled ? 'فعال' : 'غیرفعال'}</div><small>سوابق قبلی همیشه قابل گزارش است.</small></div>
      </div>
      <div class="table-wrap section"><table><thead><tr><th>تاریخ</th><th>رویداد</th><th>نوع</th><th>فاکتور</th><th>طرف‌حساب</th><th>پروفایل</th><th>نرخ</th><th>مبلغ مشمول (تومان)</th><th>مالیات (تومان)</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${faDate(row.event_date)}</td><td>${row.event_kind === 'reversal' ? 'برگشت' : 'ثبت'}</td><td>${row.invoice_type === 'sale' ? 'فروش' : 'خرید'}</td><td>${row.invoice_no ? Number(row.invoice_no).toLocaleString('fa-IR') : '—'}</td><td>${esc(row.party_name || '—')}</td><td>${esc(row.tax_profile_name_fa || TREATMENT_FA[row.tax_treatment] || '—')}</td><td>${Number(row.tax_rate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪</td><td class="num">${money(row.taxable_amount)}</td><td class="num">${money(row.tax_amount)}</td></tr>`).join('') : '<tr><td colspan="9"><div class="empty-state">در این بازه رویداد مالیاتی ثبت‌شده‌ای وجود ندارد.</div></td></tr>'}</tbody></table></div>
    `;
    if (existing) existing.replaceWith(card); else root.append(card);
    card.querySelector('[data-rc15-tax-refresh]')?.addEventListener('click', async () => {
      card.remove();
      await renderVatReport(true);
    });
  } catch (error) { showError(error, 'RC1.5 VAT report'); }
  finally { reportBusy = false; }
}

async function applyEnhancements() {
  try {
    if (pageTitle() === 'تنظیمات') await renderTaxSettings();
    if (pageTitle() === 'گزارش‌ها') await renderVatReport();
    const data = await loadData();
    injectItemTaxField(document.getElementById('rc14ItemForm'), data);
    await enhanceInvoiceForm(document.getElementById('invoiceForm'));
    await renderInvoiceTaxDetail();
  } catch (error) { console.warn('[RC1.5 tax UX]', error); }
}

function scheduleApply() {
  if (scheduleTimer) clearTimeout(scheduleTimer);
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    applyEnhancements();
  }, 60);
}

document.addEventListener('click', event => {
  const edit = event.target.closest?.('[data-edit-invoice]');
  const view = event.target.closest?.('[data-view-invoice]');
  if (edit) {
    editingInvoiceId = edit.dataset.editInvoice || null;
    viewingInvoiceId = null;
    requestedInvoiceType = null;
  }
  if (view) {
    viewingInvoiceId = view.dataset.viewInvoice || null;
    editingInvoiceId = null;
    requestedInvoiceType = null;
  }
  if (event.target.closest?.('#newSaleInvoice')) {
    editingInvoiceId = null; viewingInvoiceId = null; requestedInvoiceType = 'sale';
  }
  if (event.target.closest?.('#newPurchaseInvoice')) {
    editingInvoiceId = null; viewingInvoiceId = null; requestedInvoiceType = 'purchase';
  }
  if (event.target.closest?.('#addInvoiceLine')) {
    setTimeout(refreshInvoiceRowsAfterAdd, 0);
  }
  if (event.target.closest?.('#applyReportRange')) {
    setTimeout(() => {
      document.querySelector('[data-rc15-vat-report]')?.remove();
      renderVatReport(true);
    }, 120);
  }
}, true);

document.addEventListener('submit', event => {
  const form = event.target;
  if (form?.id !== 'invoiceForm' || form.dataset.rc15TaxEnabled !== '1') return;
  const missing = [...form.querySelectorAll('[data-invoice-line]')]
    .filter(rowUsed)
    .some(row => !row.querySelector('[data-rc15-tax-profile]')?.value);
  if (!missing) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toast('برای هر ردیف فاکتور، وضعیت مالیاتی را انتخاب کنید');
}, true);

new MutationObserver(mutations => {
  const hasElementChange = mutations.some(mutation =>
    [...mutation.addedNodes, ...mutation.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE)
  );
  if (hasElementChange) scheduleApply();
}).observe(document.body, { childList: true, subtree: true });

window.addEventListener('avan:company-context-changed', () => {
  cache = null;
  editingInvoiceId = null;
  viewingInvoiceId = null;
  requestedInvoiceType = null;
  scheduleApply();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
else scheduleApply();

window.AvanTax = Object.freeze({
  refresh: async () => {
    cache = null;
    document.querySelector('[data-rc15-tax-settings]')?.remove();
    document.querySelector('[data-rc15-vat-report]')?.remove();
    await applyEnhancements();
  },
  snapshot: async () => {
    const data = await loadData();
    return Object.freeze({
      workspace_id: data.company.id,
      tax_enabled: Boolean(data.settings.tax_enabled),
      default_rule_version_id: data.settings.default_rule_version_id || null,
      active_profiles: data.profiles.filter(profile => profile.is_active).length
    });
  }
});
