'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createTaxService } from '../../application/tax/tax-service.js';
import {
  calculateTaxableAmount,
  calculateVatAmount
} from '../../domains/tax/vat-calculator.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { toast, showError } from '../feedback/toast.js';

const SETTINGS_ROLES = new Set(['owner', 'manager']);
const ITEM_ROLES = new Set(['owner', 'manager', 'accountant']);
const TAXPAYER_FA = Object.freeze({
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

export function installTaxWorkspace({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanTax?.architecture === 'tax-workspace-v1') return globalObject.AvanTax;

  const C = installAvanCloud({ globalObject });
  const Tax = createTaxService(C);
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });

  let editingInvoiceId = null;
  let viewingInvoiceId = null;
  let requestedInvoiceType = null;
  let scheduleTimer = null;
  let reportBusy = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const toBig = value => {
    try { return BigInt(String(value ?? 0).replace(/\.0+$/, '') || '0'); }
    catch { return 0n; }
  };

  const money = value => {
    let amount = toBig(value);
    const sign = amount < 0n ? '−' : '';
    if (amount < 0n) amount = -amount;
    return `${sign}${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')} تومان`;
  };

  const faDate = iso => {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(`${iso}T12:00:00`));
    } catch { return iso || '—'; }
  };

  const pageTitle = () => documentObject.getElementById('pageTitle')?.textContent?.trim() || '';

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
    const root = documentObject.getElementById('content');
    if (!root) return;
    const existing = root.querySelector('[data-rc15-tax-settings]');
    if (existing && !force) return;

    try {
      const data = await Tax.load(force);
      const settings = data.settings;
      const rule = currentRule(data);
      const canEdit = SETTINGS_ROLES.has(data.role);
      const missingProfiles = data.items.filter(item => item.is_active && !item.tax_profile_id).length;
      const ruleText = rule
        ? `${rule.name_fa} — نرخ عمومی ${Number(rule.standard_vat_rate).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪ — ${faDate(rule.effective_from)}${rule.effective_to ? ` تا ${faDate(rule.effective_to)}` : ''}`
        : 'قاعده فعال مالیاتی پیدا نشد.';

      const card = documentObject.createElement('section');
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
        documentObject.querySelector('#nav [data-page="inventory"]')?.click()
      );

      const form = card.querySelector('#rc15TaxSettingsForm');
      if (form) form.addEventListener('submit', async event => {
        event.preventDefault();
        const fd = new FormData(form);
        const enabled = fd.get('tax_enabled') === 'on';
        if (enabled && !settings.tax_enabled) {
          const approved = globalObject.confirm('با فعال‌سازی مالیات، مبلغ VAT در فاکتور و سند حسابداری ثبت می‌شود. ادامه می‌دهید؟');
          if (!approved) return;
        }
        try {
          await Tax.saveWorkspaceSettings({
            workspaceId: data.company.id,
            taxEnabled: enabled,
            taxpayerType: String(fd.get('taxpayer_type') || 'unspecified'),
            taxIdentifier: String(fd.get('tax_identifier') || '').trim() || null,
            economicCode: String(fd.get('economic_code') || '').trim() || null,
            taxpayerMemoryId: String(fd.get('taxpayer_memory_id') || '').trim() || null
          });
          toast('تنظیمات مالیاتی شرکت ذخیره شد');
          card.remove();
          await renderTaxSettings(true);
        } catch (error) { showError(error, 'RC1.5 tax settings'); }
      });
    } catch (error) { showError(error, 'RC1.5 tax settings load'); }
  }

  function injectItemTaxField(form, data) {
    if (!form || form.dataset.rc15TaxReady === '1') return;
    const grid = form.querySelector('.form-grid');
    if (!grid) return;
    form.dataset.rc15TaxReady = '1';
    const sku = form.querySelector('[name="sku"]')?.value || '';
    const item = data.items.find(row => row.sku === sku);
    const field = documentObject.createElement('div');
    field.className = 'field rc15-item-tax-field';
    field.innerHTML = `<label>وضعیت مالیاتی پیش‌فرض</label><select data-rc15-item-tax>${profileOptions(data, item?.tax_profile_id || '', null, 'بدون پروفایل پیش‌فرض')}</select><small>در هر ردیف فاکتور می‌توان این انتخاب را تغییر داد.</small>`;
    grid.append(field);
    if (!ITEM_ROLES.has(data.role)) field.querySelector('select').disabled = true;
  }

  function enrichInventoryItem(table, payload) {
    if (table !== 'inventory_items' || !payload || typeof payload !== 'object') return payload;
    const select = documentObject.querySelector('#rc14ItemForm [data-rc15-item-tax]');
    return select ? { ...payload, tax_profile_id: select.value || null } : payload;
  }

  if (!C.operations.has('insert', 'tax.inventory-profile')) {
    C.operations.use('insert', 'tax.inventory-profile', ({ args, next }) => {
      const [table, payload, ...rest] = args;
      return next(table, enrichInventoryItem(table, payload), ...rest);
    }, { priority: 200 });
  }

  if (!C.operations.has('update', 'tax.inventory-profile')) {
    C.operations.use('update', 'tax.inventory-profile', ({ args, next }) => {
      const [table, payload, filter, ...rest] = args;
      return next(table, enrichInventoryItem(table, payload), filter, ...rest);
    }, { priority: 200 });
  }

  function invoiceType(form) {
    return form?.dataset?.rc14InvoiceType || requestedInvoiceType ||
      ((form?.closest('.modal')?.textContent || '').includes('خرید') ? 'purchase' : 'sale');
  }

  function rowUsed(row) {
    return Boolean(
      row.querySelector('[name="account"]')?.value ||
      row.querySelector('[name="description"]')?.value?.trim() ||
      row.querySelector('[name="unit_price"]')?.value?.trim()
    );
  }

  function lineBase(row) {
    return calculateTaxableAmount({
      quantity: row.querySelector('[name="quantity"]')?.value || '1',
      unitPrice: row.querySelector('[name="unit_price"]')?.value || '0',
      discount: row.querySelector('[name="discount"]')?.value || '0'
    }) ?? 0n;
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
      const nextHtml = '<div class="info-box">مالیات برای این شرکت غیرفعال است؛ مبلغ فاکتور بدون VAT محاسبه می‌شود.</div>';
      if (summary.innerHTML !== nextHtml) summary.innerHTML = nextHtml;
      return;
    }

    let subtotal = 0n;
    let tax = 0n;
    form.querySelectorAll('[data-invoice-line]').forEach(row => {
      if (!rowUsed(row)) return;
      const base = lineBase(row);
      const select = row.querySelector('[data-rc15-tax-profile]');
      const profile = data.profiles.find(record => record.id === select?.value);
      const rowTax = profile
        ? (calculateVatAmount({ taxableAmount: base, rate: profile.rate }) ?? 0n)
        : 0n;
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
        snapshots = await Tax.invoiceLineTaxProfiles(editingInvoiceId, data.company.id);
      } catch { snapshots = []; }
    }

    form.querySelectorAll('[data-invoice-line]').forEach((row, index) => {
      if (row.querySelector('[data-rc15-tax-profile]')) return;
      const field = documentObject.createElement('div');
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
      const data = await Tax.load();
      form.dataset.rc15TaxEnabled = data.settings.tax_enabled ? '1' : '0';
      const summary = documentObject.createElement('section');
      summary.className = 'rc15-invoice-tax-summary';
      summary.dataset.rc15InvoiceTaxSummary = '1';
      const actions = form.querySelector('.form-actions');
      if (actions) actions.before(summary); else form.append(summary);
      await addTaxFieldsToInvoiceRows(form, data);
      refreshInvoiceTaxTotals(form, data);
    } catch (error) { showError(error, 'RC1.5 invoice tax UX'); }
  }

  async function refreshInvoiceRowsAfterAdd() {
    const form = documentObject.getElementById('invoiceForm');
    if (!form) return;
    try {
      const data = await Tax.load();
      await addTaxFieldsToInvoiceRows(form, data);
      refreshInvoiceTaxTotals(form, data);
    } catch (error) { showError(error, 'RC1.5 invoice new line'); }
  }

  if (!C.operations.has('rpc', 'tax.invoice-line-profile')) {
    C.operations.use('rpc', 'tax.invoice-line-profile', ({ args, next }) => {
      let [name, payload = {}] = args;
      if (name === 'save_draft_invoice' && Array.isArray(payload.p_lines)) {
        const form = documentObject.getElementById('invoiceForm');
        if (form?.dataset.rc15TaxEnabled === '1') {
          const rows = [...form.querySelectorAll('[data-invoice-line]')].filter(rowUsed);
          payload = {
            ...payload,
            p_lines: payload.p_lines.map((line, index) => ({
              ...line,
              tax_profile_id: rows[index]?.querySelector('[data-rc15-tax-profile]')?.value || line.tax_profile_id || null
            }))
          };
        }
      }
      return next(name, payload);
    }, { priority: 200 });
  }

  async function renderInvoiceTaxDetail() {
    if (!viewingInvoiceId) return;
    const modal = documentObject.getElementById('modal');
    if (!modal || modal.querySelector('#invoiceForm') || modal.querySelector('[data-rc15-tax-detail]')) return;
    try {
      const data = await Tax.load();
      const detail = await Tax.invoiceTaxDetail(viewingInvoiceId, data.company.id);
      if (!detail.invoice || !detail.lines.some(line => line.tax_profile_id)) return;

      const card = documentObject.createElement('section');
      card.className = 'card section rc15-tax-detail';
      card.dataset.rc15TaxDetail = '1';
      card.innerHTML = `
        <h3>مالیات فاکتور</h3>
        <div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${money(detail.invoice.subtotal_amount)}</b></span><span><small>مالیات</small><b>${money(detail.invoice.tax_total)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${money(detail.invoice.total_amount)}</b></span></div>
        <div class="table-wrap section"><table><thead><tr><th>ردیف</th><th>وضعیت مالیاتی</th><th>نرخ</th><th>مبلغ مشمول (تومان)</th><th>مالیات (تومان)</th></tr></thead><tbody>${detail.lines.map(line => `<tr><td>${Number(line.line_no).toLocaleString('fa-IR')}</td><td>${esc(line.tax_profile_name_fa || TREATMENT_FA[line.tax_treatment] || '—')}</td><td>${Number(line.tax_rate || 0).toLocaleString('fa-IR', { maximumFractionDigits: 4 })}٪</td><td class="num">${money(line.taxable_amount)}</td><td class="num">${money(line.tax_amount)}</td></tr>`).join('')}</tbody></table></div>`;
      modal.append(card);
    } catch (error) { console.warn('[Tax detail]', error); }
  }

  function reportRange(data) {
    const year = data.years.find(row => row.status === 'open') || data.years[0];
    return {
      from: documentObject.getElementById('reportFrom')?.value || year?.date_from || new Date().toISOString().slice(0, 10),
      to: documentObject.getElementById('reportTo')?.value || new Date().toISOString().slice(0, 10)
    };
  }

  async function renderVatReport(force = false) {
    if (pageTitle() !== 'گزارش‌ها' || reportBusy) return;
    const root = documentObject.getElementById('content');
    if (!root) return;
    const existing = root.querySelector('[data-rc15-vat-report]');
    if (existing && !force) return;
    reportBusy = true;

    try {
      const data = await Tax.load(force);
      const range = reportRange(data);
      const rows = await Tax.vatTransactions(data.company.id, range.from, range.to);

      let output = 0n;
      let input = 0n;
      let saleBase = 0n;
      let purchaseBase = 0n;
      rows.forEach(row => {
        const rowTax = toBig(row.tax_amount);
        const base = toBig(row.taxable_amount);
        if (row.invoice_type === 'sale') {
          output += rowTax;
          saleBase += base;
        } else {
          input += rowTax;
          purchaseBase += base;
        }
      });
      const net = output - input;

      const card = documentObject.createElement('section');
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
      const data = await Tax.load();
      injectItemTaxField(documentObject.getElementById('rc14ItemForm'), data);
      await enhanceInvoiceForm(documentObject.getElementById('invoiceForm'));
      await renderInvoiceTaxDetail();
    } catch (error) { console.warn('[Tax workspace]', error); }
  }

  function scheduleApply() {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      applyEnhancements();
    }, 60);
  }

  documentObject.addEventListener('avan:ui-changed', scheduleApply);

  documentObject.addEventListener('click', event => {
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
    if (event.target.closest?.('#addInvoiceLine')) {
      setTimeout(refreshInvoiceRowsAfterAdd, 0);
    }
    if (event.target.closest?.('#applyReportRange')) {
      setTimeout(() => {
        documentObject.querySelector('[data-rc15-vat-report]')?.remove();
        renderVatReport(true);
      }, 120);
    }
  }, true);

  documentObject.addEventListener('submit', event => {
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

  globalObject.addEventListener('avan:company-context-changed', () => {
    Tax.invalidate();
    editingInvoiceId = null;
    viewingInvoiceId = null;
    requestedInvoiceType = null;
    Lifecycle.schedule('company-context');
  });

  if (documentObject.readyState === 'loading') {
    documentObject.addEventListener('DOMContentLoaded', scheduleApply, { once: true });
  } else {
    scheduleApply();
  }

  const api = Object.freeze({
    architecture: 'tax-workspace-v1',
    refresh: async () => {
      Tax.invalidate();
      documentObject.querySelector('[data-rc15-tax-settings]')?.remove();
      documentObject.querySelector('[data-rc15-vat-report]')?.remove();
      await applyEnhancements();
    },
    snapshot: async () => {
      const data = await Tax.load();
      return Object.freeze({
        workspace_id: data.company.id,
        tax_enabled: Boolean(data.settings.tax_enabled),
        default_rule_version_id: data.settings.default_rule_version_id || null,
        active_profiles: data.profiles.filter(profile => profile.is_active).length,
        operations: C.operations.snapshot()
      });
    }
  });

  globalObject.AvanTax = api;
  return api;
}
