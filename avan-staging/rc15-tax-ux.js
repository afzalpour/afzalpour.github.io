'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { toast, showError } from './src/ui/feedback/toast.js';

const C = installAvanCloud();
const nativeRpc = C.rpc.bind(C);
const nativeInsert = C.insert.bind(C);
const nativeUpdate = C.update.bind(C);

const MANAGE_TAX_SETTINGS = new Set(['owner', 'manager']);
const MANAGE_ITEM_TAX = new Set(['owner', 'manager', 'accountant']);
const TAXPAYER_TYPE_FA = Object.freeze({
  unspecified: 'تعیین نشده',
  individual: 'شخص حقیقی',
  legal_entity: 'شخص حقوقی',
  nonprofit: 'غیرانتفاعی',
  other: 'سایر'
});
const TREATMENT_FA = Object.freeze({
  standard: 'مشمول نرخ استاندارد',
  exempt: 'معاف',
  zero: 'نرخ صفر',
  custom: 'نرخ سفارشی'
});

let cache = null;
let editingInvoiceId = null;
let viewingInvoiceId = null;
let requestedInvoiceType = null;
let scheduled = null;
let reportBusy = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));
const latin = value => String(value ?? '')
  .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const digits = value => latin(value).replace(/[٬,\s]/g, '');
const money = value => {
  let n;
  try { n = BigInt(String(value ?? '0').replace(/\.0+$/, '') || '0'); } catch { n = 0n; }
  const sign = n < 0n ? '−' : '';
  if (n < 0n) n = -n;
  return `${sign}${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} تومان`;
};
const dateFa = iso => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(`${iso}T12:00:00`));
  } catch { return iso || '—'; }
};

async function activeCompany() {
  const state = await C.companyContext.ensure();
  if (state?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function taxData(force = false) {
  const company = await activeCompany();
  if (!force && cache?.company?.id === company.id) return cache;
  const wid = company.id;
  const [settingsRows, profiles, rules, items, years, role] = await Promise.all([
    C.select('workspace_tax_settings', `select=*&workspace_id=eq.${wid}&limit=1`),
    C.select('tax_profiles', `select=id,workspace_id,code,name_fa,treatment,rate,applies_to,rule_version_id,is_active&workspace_id=eq.${wid}&order=code.asc`),
    C.select('tax_rule_versions', 'select=id,rule_code,version_no,name_fa,effective_from,effective_to,standard_vat_rate,status,source_title,source_reference&status=eq.active&order=effective_from.desc'),
    C.select('inventory_items', `select=id,sku,name,item_type,tax_profile_id,is_active&workspace_id=eq.${wid}&order=name.asc`),
    C.select('fiscal_years', `select=id,name,date_from,date_to,status&workspace_id=eq.${wid}&order=date_from.desc`),
    C.rpc('workspace_role', { wid })
  ]);
  cache = {
    company,
    settings: settingsRows?.[0] || { workspace_id: wid, tax_enabled: false, taxpayer_type: 'unspecified' },
    profiles: Array.isArray(profiles) ? profiles : [],
    rules: Array.isArray(rules) ? rules : [],
    items: Array.isArray(items) ? items : [],
    years: Array.isArray(years) ? years : [],
    role
  };
  return cache;
}

function profileLabel(profile) {
  if (!profile) return '—';
  const rate = Number(profile.rate || 0);
  const rateText = profile.treatment === 'exempt'
    ? 'معاف'
    : profile.treatment === 'zero'
      ? 'نرخ صفر'
      : `${rate.toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪`;
  return `${profile.name_fa} — ${rateText}`;
}

function applicableProfiles(data, invoiceType = null) {
  return data.profiles.filter(p => p.is_active && (!invoiceType || p.applies_to === 'both' || p.applies_to === invoiceType));
}

function profileOptions(data, selected = '', invoiceType = null, placeholder = 'انتخاب وضعیت مالیاتی…') {
  return `<option value="">${esc(placeholder)}</option>` + applicableProfiles(data, invoiceType).map(p =>
    `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(profileLabel(p))}</option>`
  ).join('');
}

function activeRule(data) {
  return data.rules.find(r => r.id === data.settings.default_rule_version_id) || data.rules[0] || null;
}

function currentPage() {
  return document.getElementById('pageTitle')?.textContent?.trim() || '';
}

function taxSettingsCardHtml(data) {
  const s = data.settings || {};
  const rule = activeRule(data);
  const canEdit = MANAGE_TAX_SETTINGS.has(data.role);
  const missing = data.items.filter(i => i.is_active && !i.tax_profile_id).length;
  const statusClass = s.tax_enabled ? 'pos' : 'warn';
  const status = s.tax_enabled ? 'فعال' : 'غیرفعال';
  const ruleText = rule
    ? `${rule.name_fa} — نرخ عمومی ${Number(rule.standard_vat_rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪ — از ${dateFa(rule.effective_from)}${rule.effective_to ? ` تا ${dateFa(rule.effective_to)}` : ''}`
    : 'قاعده فعال مالیاتی پیدا نشد.';

  if (!canEdit) {
    return `<section class="section card rc15-tax-settings" data-rc15-tax-settings>
      <div class="section-head"><div><h2>مالیات و ارزش افزوده</h2><span class="muted">ویرایش تنظیمات مالیاتی فقط در اختیار مالک و مدیر شرکت است.</span></div><span class="summary-pill ${statusClass}">${status}</span></div>
      <div class="rc15-tax-rule"><b>قاعده جاری:</b> ${esc(ruleText)}</div>
      <div class="grid2 section">
        <div class="card"><div class="kpi-label">نوع مودی</div><div class="kpi-value rc15-small-value">${esc(TAXPAYER_TYPE_FA[s.taxpayer_type] || 'تعیین نشده')}</div></div>
        <div class="card"><div class="kpi-label">اقلام بدون پروفایل مالیاتی</div><div class="kpi-value">${missing.toLocaleString('fa-IR')}</div></div>
      </div>
    </section>`;
  }

  return `<section class="section card rc15-tax-settings" data-rc15-tax-settings>
    <div class="section-head">
      <div><h2>مالیات و ارزش افزوده</h2><span class="muted">فعال‌سازی فقط با تصمیم صریح شرکت انجام می‌شود؛ نرخ از قاعده نسخه‌بندی‌شده خوانده می‌شود.</span></div>
      <span class="summary-pill ${statusClass}">${status}</span>
    </div>
    <div class="rc15-tax-rule"><b>قاعده جاری:</b> ${esc(ruleText)}</div>
    ${missing ? `<div class="info-box">${missing.toLocaleString('fa-IR')} کالا/خدمت فعال هنوز پروفایل مالیاتی ندارد. قبل از ثبت فاکتور مالیاتی، وضعیت مالیاتی اقلام را در «کالا و انبار» تعیین کنید.</div>` : ''}
    <form id="rc15TaxSettingsForm" class="section">
      <label class="rc15-tax-toggle"><input type="checkbox" name="tax_enabled" ${s.tax_enabled ? 'checked' : ''}><span><b>فعال‌سازی محاسبه مالیات در فاکتورها</b><small>پس از فعال‌سازی، هر ردیف فاکتور باید پروفایل مالیاتی معتبر داشته باشد.</small></span></label>
      <div class="form-grid section">
        <div class="field"><label>نوع مودی</label><select name="taxpayer_type">${Object.entries(TAXPAYER_TYPE_FA).map(([key, label]) => `<option value="${key}" ${key === (s.taxpayer_type || 'unspecified') ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label>شناسه مالیاتی</label><input name="tax_identifier" maxlength="96" value="${esc(s.tax_identifier || '')}" placeholder="اختیاری در این Gate"></div>
        <div class="field"><label>کد اقتصادی</label><input name="economic_code" maxlength="64" value="${esc(s.economic_code || '')}"></div>
        <div class="field"><label>شناسه حافظه مالیاتی</label><input name="taxpayer_memory_id" maxlength="96" value="${esc(s.taxpayer_memory_id || '')}" placeholder="برای چرخه صورتحساب الکترونیکی"></div>
      </div>
      <div class="info-box">ارسال صورتحساب الکترونیکی در RC1.5-C فعال نمی‌شود. اتصال بیرونی و پیش‌اعتبارسنجی در Gate بعدی و فقط با اقدام صریح کاربر انجام خواهد شد.</div>
      <div class="form-actions"><button type="button" class="ghost" data-rc15-open-items>تنظیم مالیات کالا/خدمت</button><button class="primary" type="submit">ذخیره تنظیمات مالیاتی</button></div>
    </form>
  </section>`;
}

async function renderTaxSettings(force = false) {
  if (currentPage() !== 'تنظیمات') return;
  const content = document.getElementById('content');
  if (!content) return;
  try {
    const data = await taxData(force);
    const old = content.querySelector('[data-rc15-tax-settings]');
    const holder = document.createElement('div');
    holder.innerHTML = taxSettingsCardHtml(data).trim();
    const card = holder.firstElementChild;
    if (old) old.replaceWith(card); else content.append(card);
    const form = card.querySelector('#rc15TaxSettingsForm');
    card.querySelector('[data-rc15-open-items]')?.addEventListener('click', () => {
      document.querySelector('#nav [data-page="inventory"]')?.click();
    });
    if (form) form.onsubmit = async event => {
      event.preventDefault();
      const fd = new FormData(form);
      const enabling = fd.get('tax_enabled') === 'on';
      if (enabling && !data.settings.tax_enabled) {
        const ok = window.confirm('با فعال‌سازی مالیات، از این پس ردیف‌های فاکتور باید وضعیت مالیاتی داشته باشند و مبلغ مالیات در سند حسابداری ثبت می‌شود. ادامه می‌دهید؟');
        if (!ok) return;
      }
      try {
        await C.rpc('set_workspace_tax_settings', {
          wid: data.company.id,
          p_tax_enabled: enabling,
          p_taxpayer_type: String(fd.get('taxpayer_type') || 'unspecified'),
          p_tax_identifier: String(fd.get('tax_identifier') || '').trim() || null,
          p_economic_code: String(fd.get('economic_code') || '').trim() || null,
          p_taxpayer_memory_id: String(fd.get('taxpayer_memory_id') || '').trim() || null
        });
        cache = null;
        toast('تنظیمات مالیاتی شرکت ذخیره شد');
        await renderTaxSettings(true);
      } catch (error) { showError(error, 'RC1.5 tax settings'); }
    };
  } catch (error) { showError(error, 'RC1.5 tax settings load'); }
}

function injectItemTaxField(form, data) {
  if (!form || form.dataset.rc15TaxItem === '1') return;
  const grid = form.querySelector('.form-grid');
  if (!grid) return;
  form.dataset.rc15TaxItem = '1';
  const sku = form.querySelector('[name="sku"]')?.value || '';
  const item = data.items.find(i => i.sku === sku);
  const field = document.createElement('div');
  field.className = 'field rc15-item-tax-field';
  field.innerHTML = `<label>وضعیت مالیاتی پیش‌فرض</label><select data-rc15-item-tax>${profileOptions(data, item?.tax_profile_id || '', null, 'بدون پروفایل پیش‌فرض')}</select><small>در فاکتور می‌توانید این انتخاب را برای همان ردیف تغییر دهید.</small>`;
  grid.append(field);
  if (!MANAGE_ITEM_TAX.has(data.role)) field.querySelector('select').disabled = true;
}

function enrichInventoryPayload(table, payload) {
  if (table !== 'inventory_items' || !payload || typeof payload !== 'object') return payload;
  const form = document.getElementById('rc14ItemForm');
  const select = form?.querySelector('[data-rc15-item-tax]');
  if (!select) return payload;
  return { ...payload, tax_profile_id: select.value || null };
}

C.insert = async (table, payload, ...rest) => nativeInsert(table, enrichInventoryPayload(table, payload), ...rest);
C.update = async (table, payload, filter, ...rest) => nativeUpdate(table, enrichInventoryPayload(table, payload), filter, ...rest);

function invoiceType(form) {
  if (form?.dataset?.rc14InvoiceType) return form.dataset.rc14InvoiceType;
  if (requestedInvoiceType) return requestedInvoiceType;
  const txt = form?.closest('.modal')?.textContent || '';
  return txt.includes('خرید') ? 'purchase' : 'sale';
}

function decimalMicros(value) {
  const s = latin(value).trim().replace(/٫|,/g, '.').replace(/\s/g, '');
  if (!/^\d+(?:\.\d{0,6})?$/.test(s)) return null;
  const [i, f = ''] = s.split('.');
  return BigInt(i || '0') * 1000000n + BigInt((f + '000000').slice(0, 6));
}

function integerBig(value) {
  const s = digits(value);
  return /^\d+$/.test(s) ? BigInt(s) : null;
}

function rateUnits(value) {
  const s = String(value ?? '0');
  const [i, f = ''] = s.split('.');
  if (!/^\d+$/.test(i || '') || !/^\d*$/.test(f)) return 0n;
  return BigInt(i) * 10000n + BigInt((f + '0000').slice(0, 4));
}

function rowSubtotal(row) {
  const q = decimalMicros(row.querySelector('[name="quantity"]')?.value || '1');
  const p = integerBig(row.querySelector('[name="unit_price"]')?.value || '0');
  const d = integerBig(row.querySelector('[name="discount"]')?.value || '0');
  if (q === null || p === null || d === null) return 0n;
  const gross = (q * p + 500000n) / 1000000n;
  return gross > d ? gross - d : 0n;
}

function rowHasData(row) {
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function rowTax(row, data) {
  const select = row.querySelector('[data-rc15-tax-profile]');
  const profile = data.profiles.find(p => p.id === select?.value);
  const base = rowSubtotal(row);
  if (!profile || base <= 0n) return { base, tax: 0n, profile: null };
  const units = rateUnits(profile.rate);
  const tax = (base * units + 500000n) / 1000000n;
  return { base, tax, profile };
}

function refreshInvoiceTaxTotals(form, data) {
  const summary = form.querySelector('[data-rc15-invoice-tax-summary]');
  if (!summary) return;
  if (!data.settings.tax_enabled) {
    summary.innerHTML = '<div class="info-box">مالیات برای این شرکت غیرفعال است؛ مبلغ فاکتور بدون VAT محاسبه می‌شود.</div>';
    return;
  }
  let subtotal = 0n, tax = 0n;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    if (!rowHasData(row)) return;
    const calc = rowTax(row, data);
    subtotal += calc.base;
    tax += calc.tax;
    const note = row.querySelector('[data-rc15-line-tax-note]');
    if (note) note.textContent = calc.profile ? `مالیات این ردیف: ${money(calc.tax)}` : 'وضعیت مالیاتی را انتخاب کنید';
  });
  summary.innerHTML = `<div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(subtotal)}</b></span><span><small>مالیات</small><b>${money(tax)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(subtotal + tax)}</b></span></div>`;
}

function syncRowTaxFromItem(row, data, type, preserve = false) {
  const select = row.querySelector('[data-rc15-tax-profile]');
  if (!select) return;
  const itemId = row.dataset.eItem || row.querySelector('[data-e-item]')?.value || '';
  const item = data.items.find(i => i.id === itemId);
  const itemProfile = data.profiles.find(p => p.id === item?.tax_profile_id && (p.applies_to === 'both' || p.applies_to === type));
  if (!preserve || !select.value) select.value = itemProfile?.id || '';
}

async function injectInvoiceTaxFields(form, data) {
  if (!data.settings.tax_enabled) return;
  const type = invoiceType(form);
  let oldLines = [];
  if (editingInvoiceId) {
    try {
      oldLines = await C.select('invoice_lines', `select=line_no,tax_profile_id&invoice_id=eq.${editingInvoiceId}&workspace_id=eq.${data.company.id}&order=line_no.asc`);
    } catch { oldLines = []; }
  }
  form.querySelectorAll('[data-invoice-line]').forEach((row, index) => {
    let select = row.querySelector('[data-rc15-tax-profile]');
    if (!select) {
      const field = document.createElement('div');
      field.className = 'field rc15-invoice-tax-field';
      field.innerHTML = `<label>وضعیت مالیاتی</label><select data-rc15-tax-profile required></select><small data-rc15-line-tax-note></small>`;
      const amount = row.querySelector('[data-line-amount]');
      if (amount) amount.before(field); else row.append(field);
      select = field.querySelector('select');
      select.addEventListener('change', () => refreshInvoiceTaxTotals(form, data));
    }
    const previous = select.value;
    const snapshot = oldLines[index]?.tax_profile_id || '';
    select.innerHTML = profileOptions(data, previous || snapshot, type);
    if (previous && [...select.options].some(o => o.value === previous)) select.value = previous;
    else if (snapshot && [...select.options].some(o => o.value === snapshot)) select.value = snapshot;
    else syncRowTaxFromItem(row, data, type, false);

    const itemSelect = row.querySelector('[data-e-item]');
    if (itemSelect && itemSelect.dataset.rc15TaxBound !== '1') {
      itemSelect.dataset.rc15TaxBound = '1';
      itemSelect.addEventListener('change', () => {
        setTimeout(() => {
          syncRowTaxFromItem(row, data, type, false);
          refreshInvoiceTaxTotals(form, data);
        }, 0);
      });
    }
    row.querySelectorAll('[name="quantity"],[name="unit_price"],[name="discount"]').forEach(input => {
      if (input.dataset.rc15TaxBound === '1') return;
      input.dataset.rc15TaxBound = '1';
      input.addEventListener('input', () => refreshInvoiceTaxTotals(form, data));
      input.addEventListener('change', () => refreshInvoiceTaxTotals(form, data));
    });
  });
}

async function enhanceInvoiceForm(form) {
  if (!form || form.dataset.rc15Enhancing === '1') return;
  form.dataset.rc15Enhancing = '1';
  try {
    const data = await taxData();
    form.dataset.rc15TaxEnabled = data.settings.tax_enabled ? '1' : '0';
    let summary = form.querySelector('[data-rc15-invoice-tax-summary]');
    if (!summary) {
      summary = document.createElement('section');
      summary.className = 'rc15-invoice-tax-summary';
      summary.dataset.rc15InvoiceTaxSummary = '1';
      const actions = form.querySelector('.form-actions');
      if (actions) actions.before(summary); else form.append(summary);
    }
    await injectInvoiceTaxFields(form, data);
    refreshInvoiceTaxTotals(form, data);
    const lines = form.querySelector('#invoiceLines') || form;
    if (lines.dataset.rc15TaxObserver !== '1') {
      lines.dataset.rc15TaxObserver = '1';
      new MutationObserver(mutations => {
        if (!mutations.some(m => m.addedNodes.length)) return;
        injectInvoiceTaxFields(form, data).then(() => refreshInvoiceTaxTotals(form, data));
      }).observe(lines, { childList: true, subtree: true });
    }
  } catch (error) { showError(error, 'RC1.5 invoice tax UX'); }
  finally { delete form.dataset.rc15Enhancing; }
}

function activeInvoiceRows(form) {
  return [...form.querySelectorAll('[data-invoice-line]')].filter(rowHasData);
}

C.rpc = async (name, args = {}) => {
  if (name === 'save_draft_invoice' && Array.isArray(args.p_lines)) {
    const form = document.getElementById('invoiceForm');
    if (form?.dataset.rc15TaxEnabled === '1') {
      const rows = activeInvoiceRows(form);
      args = {
        ...args,
        p_lines: args.p_lines.map((line, index) => ({
          ...line,
          tax_profile_id: rows[index]?.querySelector('[data-rc15-tax-profile]')?.value || line.tax_profile_id || null
        }))
      };
    }
  }
  return nativeRpc(name, args);
};

async function renderInvoiceTaxDetail() {
  if (!viewingInvoiceId) return;
  const modal = document.getElementById('modal');
  if (!modal || modal.querySelector('#invoiceForm') || modal.querySelector('[data-rc15-tax-detail]')) return;
  try {
    const data = await taxData();
    const [invoices, lines] = await Promise.all([
      C.select('invoices', `select=id,invoice_no,subtotal_amount,tax_total,total_amount,status&workspace_id=eq.${data.company.id}&id=eq.${viewingInvoiceId}&limit=1`),
      C.select('invoice_lines', `select=line_no,tax_profile_id,tax_profile_name_fa,tax_treatment,tax_rate,taxable_amount,tax_amount&workspace_id=eq.${data.company.id}&invoice_id=eq.${viewingInvoiceId}&order=line_no.asc`)
    ]);
    const inv = invoices?.[0];
    if (!inv || !(lines || []).some(line => line.tax_profile_id)) return;
    const card = document.createElement('section');
    card.className = 'card section rc15-tax-detail';
    card.dataset.rc15TaxDetail = '1';
    card.innerHTML = `<h3>مالیات فاکتور</h3>
      <div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(inv.subtotal_amount || 0)}</b></span><span><small>مالیات</small><b>${money(inv.tax_total || 0)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(inv.total_amount || 0)}</b></span></div>
      <div class="table-wrap section"><table><thead><tr><th>ردیف</th><th>وضعیت مالیاتی</th><th>نرخ</th><th>مبلغ مشمول (تومان)</th><th>مالیات (تومان)</th></tr></thead><tbody>${(lines || []).map(line => `<tr><td>${Number(line.line_no).toLocaleString('fa-IR')}</td><td>${esc(line.tax_profile_name_fa || TREATMENT_FA[line.tax_treatment] || '—')}</td><td>${Number(line.tax_rate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪</td><td class="num">${money(line.taxable_amount || 0)}</td><td class="num">${money(line.tax_amount || 0)}</td></tr>`).join('')}</tbody></table></div>`;
    modal.append(card);
  } catch (error) { console.warn('[RC1.5 tax detail]', error); }
}

function reportRange(data) {
  const fromControl = document.getElementById('reportFrom');
  const toControl = document.getElementById('reportTo');
  const year = data.years.find(y => y.status === 'open') || data.years[0];
  return {
    from: fromControl?.value || year?.date_from || new Date().toISOString().slice(0, 10),
    to: toControl?.value || new Date().toISOString().slice(0, 10)
  };
}

async function renderVatReport(force = false) {
  if (currentPage() !== 'گزارش‌ها' || reportBusy) return;
  const content = document.getElementById('content');
  if (!content) return;
  reportBusy = true;
  try {
    const data = await taxData(force);
    const { from, to } = reportRange(data);
    const rows = await C.rpc('report_vat_transactions', { wid: data.company.id, dfrom: from, dto: to }) || [];
    let output = 0n, input = 0n, saleBase = 0n, purchaseBase = 0n;
    rows.forEach(row => {
      const t = BigInt(String(row.tax_amount || '0').replace(/\.0+$/, '') || '0');
      const b = BigInt(String(row.taxable_amount || '0').replace(/\.0+$/, '') || '0');
      if (row.invoice_type === 'sale') { output += t; saleBase += b; }
      else if (row.invoice_type === 'purchase') { input += t; purchaseBase += b; }
    });
    const net = output - input;
    const old = content.querySelector('[data-rc15-vat-report]');
    const card = document.createElement('section');
    card.className = 'card section rc15-vat-report';
    card.dataset.rc15VatReport = '1';
    card.innerHTML = `<div class="section-head"><div><h2>گزارش مالیات بر ارزش افزوده</h2><span class="muted">بر مبنای تاریخ ثبت سند؛ برگشت در تاریخ خودش با علامت منفی منعکس می‌شود. بازه: ${dateFa(from)} تا ${dateFa(to)}</span></div><button type="button" class="ghost" data-rc15-refresh-vat>تازه‌سازی</button></div>
      <div class="grid4 section">
        <div class="card"><div class="kpi-label">مالیات فروش خروجی</div><div class="kpi-value">${money(output)}</div><small>پایه مشمول: ${money(saleBase)}</small></div>
        <div class="card"><div class="kpi-label">اعتبار مالیاتی خرید</div><div class="kpi-value">${money(input)}</div><small>پایه مشمول: ${money(purchaseBase)}</small></div>
        <div class="card"><div class="kpi-label">خالص دوره</div><div class="kpi-value ${net >= 0n ? 'warn' : 'pos'}">${money(net)}</div><small>${net >= 0n ? 'پرداختنی پیش از تعدیلات قانونی' : 'اعتبار خالص پیش از تعدیلات قانونی'}</small></div>
        <div class="card"><div class="kpi-label">وضعیت محاسبه شرکت</div><div class="kpi-value rc15-small-value">${data.settings.tax_enabled ? 'فعال' : 'غیرفعال'}</div><small>گزارش سوابق ثبت‌شده مستقل از وضعیت فعلی قابل مشاهده است.</small></div>
      </div>
      <div class="table-wrap section"><table><thead><tr><th>تاریخ</th><th>رویداد</th><th>نوع</th><th>فاکتور</th><th>طرف‌حساب</th><th>پروفایل</th><th>نرخ</th><th>مبلغ مشمول (تومان)</th><th>مالیات (تومان)</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${dateFa(row.event_date)}</td><td>${row.event_kind === 'reversal' ? '<span class="status reversed">برگشت</span>' : '<span class="status posted">ثبت</span>'}</td><td>${row.invoice_type === 'sale' ? 'فروش' : 'خرید'}</td><td>${row.invoice_no ? Number(row.invoice_no).toLocaleString('fa-IR') : '—'}</td><td>${esc(row.party_name || '—')}</td><td>${esc(row.tax_profile_name_fa || TREATMENT_FA[row.tax_treatment] || '—')}</td><td>${Number(row.tax_rate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪</td><td class="num">${money(row.taxable_amount || 0)}</td><td class="num">${money(row.tax_amount || 0)}</td></tr>`).join('') : '<tr><td colspan="9"><div class="empty-state">در این بازه رویداد مالیاتی ثبت‌شده‌ای وجود ندارد.</div></td></tr>'}</tbody></table></div>`;
    if (old) old.replaceWith(card); else content.append(card);
    card.querySelector('[data-rc15-refresh-vat]')?.addEventListener('click', () => renderVatReport(true));
  } catch (error) { showError(error, 'RC1.5 VAT report'); }
  finally { reportBusy = false; }
}

async function applyEnhancements() {
  try {
    if (currentPage() === 'تنظیمات') await renderTaxSettings();
    if (currentPage() === 'گزارش‌ها') await renderVatReport();
    const data = await taxData();
    injectItemTaxField(document.getElementById('rc14ItemForm'), data);
    await enhanceInvoiceForm(document.getElementById('invoiceForm'));
    await renderInvoiceTaxDetail();
  } catch (error) {
    console.warn('[RC1.5 tax UX] enhancement skipped', error);
  }
}

function scheduleApply() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    applyEnhancements();
  }, 40);
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
    editingInvoiceId = null;
    viewingInvoiceId = null;
    requestedInvoiceType = 'sale';
  }
  if (event.target.closest?.('#newPurchaseInvoice')) {
    editingInvoiceId = null;
    viewingInvoiceId = null;
    requestedInvoiceType = 'purchase';
  }
  if (event.target.closest?.('#applyReportRange')) setTimeout(() => renderVatReport(true), 80);
}, true);

document.addEventListener('submit', event => {
  const form = event.target;
  if (form?.id !== 'invoiceForm' || form.dataset.rc15TaxEnabled !== '1') return;
  const missing = activeInvoiceRows(form).some(row => !row.querySelector('[data-rc15-tax-profile]')?.value);
  if (!missing) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  toast('برای هر ردیف فاکتور، وضعیت مالیاتی را انتخاب کنید');
}, true);

new MutationObserver(scheduleApply).observe(document.body, { childList: true, subtree: true });
window.addEventListener('avan:company-context-changed', () => {
  cache = null;
  editingInvoiceId = null;
  viewingInvoiceId = null;
  requestedInvoiceType = null;
  scheduleApply();
});
window.addEventListener('avan:company-profile-updated', scheduleApply);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
else scheduleApply();

window.AvanTax = Object.freeze({
  refresh: async () => {
    cache = null;
    await applyEnhancements();
  },
  snapshot: async () => {
    const data = await taxData();
    return Object.freeze({
      workspace_id: data.company.id,
      tax_enabled: Boolean(data.settings.tax_enabled),
      default_rule_version_id: data.settings.default_rule_version_id || null,
      active_profiles: data.profiles.filter(p => p.is_active).length
    });
  }
});
