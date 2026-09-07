'use strict';

import { closeModal } from './src/ui/components/modal.js';
import { toast, showError } from './src/ui/feedback/toast.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();
let invoiceId = null;
let invoiceType = null;
let cache = null;
let schema = 'unknown';

const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[ch]));

function isSchemaError(error) {
  return /inventory_documents|inventory_document_id|receipt_line_id|column .*does not exist|relation .*does not exist|schema cache/i
    .test(String(error?.message || error || ''));
}

async function company() {
  const state = await C.companyContext.ensure();
  if (!state?.active_company?.id) throw new Error('COMPANY_REQUIRED');
  return state.active_company;
}

async function ready() {
  if (schema !== 'unknown') return schema === 'ready';
  try {
    await C.select('invoices', 'select=id,inventory_document_id&limit=1');
    await C.select('inventory_documents', 'select=id&limit=1');
    schema = 'ready';
  } catch (error) {
    if (isSchemaError(error)) schema = 'pending';
    else throw error;
  }
  return schema === 'ready';
}

async function data() {
  const co = await company();
  if (cache?.company.id === co.id) return cache;
  const wid = co.id;
  const [items, units, warehouses, years] = await Promise.all([
    C.select('inventory_items', `select=*&workspace_id=eq.${wid}&order=is_active.desc,name.asc`),
    C.select('inventory_units', `select=*&workspace_id=eq.${wid}`),
    C.select('warehouses', `select=*&workspace_id=eq.${wid}&order=is_default.desc,name.asc`),
    C.select('fiscal_years', `select=id,name,date_from,date_to,status&workspace_id=eq.${wid}`)
  ]);

  let receipts = [];
  if (await ready()) {
    const [docs, lines] = await Promise.all([
      C.select('inventory_documents', `select=id,document_no,document_date&workspace_id=eq.${wid}&document_type=eq.receipt&status=eq.posted`),
      C.select('inventory_document_lines', `select=id,inventory_document_id,item_id,quantity&workspace_id=eq.${wid}`)
    ]);
    const byId = new Map(docs.map(doc => [doc.id, doc]));
    receipts = lines
      .filter(line => byId.has(line.inventory_document_id))
      .map(line => ({ ...line, doc: byId.get(line.inventory_document_id) }));
  }

  return cache = { company: co, items, units, warehouses, years, receipts };
}

function typeOf(form) {
  if (invoiceType) return invoiceType;
  const text = form.closest('.modal')?.textContent || document.querySelector('#modal')?.textContent || '';
  return text.includes('خرید') ? 'purchase' : 'sale';
}

function warehouseOptions(context, selected = '') {
  return '<option value="">انتخاب انبار…</option>' + context.warehouses
    .filter(warehouse => warehouse.is_active)
    .map(warehouse => `<option value="${warehouse.id}" ${warehouse.id === selected ? 'selected' : ''}>${esc(warehouse.code)} — ${esc(warehouse.name)}</option>`)
    .join('');
}

function receiptOptions(context, itemId, selected = '') {
  return '<option value="">انتخاب رسید قطعی…</option>' + context.receipts
    .filter(receipt => !itemId || receipt.item_id === itemId)
    .map(receipt => `<option value="${receipt.id}" ${receipt.id === selected ? 'selected' : ''}>رسید ${receipt.doc.document_no ?? '—'} · ${esc(receipt.doc.document_date)} · ${Number(receipt.quantity).toLocaleString('fa-IR', { maximumFractionDigits: 6 })}</option>`)
    .join('');
}

function rowUI(row, type, context, existing = {}) {
  if (row.querySelector('[data-e-stock]')) return;

  const box = document.createElement('div');
  box.className = 'rc14e-stock-controls';
  box.dataset.eStock = '1';
  box.innerHTML = `
    <div class="field"><label>کالا / خدمت ثبت‌شده</label><select data-e-item><option value="">بدون اتصال به کالا</option>${context.items.filter(item => item.is_active || item.id === existing.item_id).map(item => `<option value="${item.id}" ${item.id === existing.item_id ? 'selected' : ''}>${esc(item.sku)} — ${esc(item.name)}</option>`).join('')}</select></div>
    <div class="field"><label>واحد پایه</label><input data-e-unit disabled value="—"></div>
    ${type === 'sale'
      ? `<div class="field" data-e-whf><label>انبار خروج</label><select data-e-wh>${warehouseOptions(context, existing.warehouse_id || '')}</select></div>`
      : '<div class="field" data-e-recf><label>رسید قطعی مرتبط</label><select data-e-rec></select></div>'}
  `;

  row.insertBefore(box, row.querySelector('[data-line-amount]') || row.lastElementChild);
  const select = box.querySelector('[data-e-item]');

  const refresh = () => {
    const item = context.items.find(record => record.id === select.value);
    const unit = context.units.find(record => record.id === item?.base_unit_id);
    const isStock = item?.item_type === 'inventory';

    row.dataset.eItem = item?.id || '';
    row.dataset.eUnit = item?.base_unit_id || '';
    box.querySelector('[data-e-unit]').value = unit
      ? `${unit.name}${unit.symbol ? ` (${unit.symbol})` : ''}`
      : '—';

    const quantity = row.querySelector('[name=quantity]');
    if (quantity && unit) quantity.dataset.eDecimals = unit.decimal_places ?? 3;

    if (type === 'sale') {
      box.querySelector('[data-e-whf]').hidden = !isStock;
      if (!isStock) box.querySelector('[data-e-wh]').value = '';
    } else {
      box.querySelector('[data-e-recf]').hidden = !isStock;
      box.querySelector('[data-e-rec]').innerHTML = receiptOptions(context, item?.id || '', existing.receipt_line_id || '');
      if (!isStock) box.querySelector('[data-e-rec]').value = '';
    }
  };

  select.addEventListener('change', refresh);
  refresh();
}

async function existingLineMetadata(context) {
  if (!invoiceId || !(await ready())) return [];
  try {
    return await C.select(
      'invoice_lines',
      `select=line_no,item_id,unit_id,warehouse_id,receipt_line_id&invoice_id=eq.${invoiceId}&workspace_id=eq.${context.company.id}&order=line_no.asc`
    );
  } catch (error) {
    if (!isSchemaError(error)) throw error;
    return [];
  }
}

async function augment(form) {
  if (!form || form.dataset.eInv) return;
  form.dataset.eInv = '1';
  try {
    const context = await data();
    const type = typeOf(form);
    const old = await existingLineMetadata(context);

    const note = document.createElement('div');
    note.className = 'info-box rc14e-invoice-note';
    note.textContent = await ready()
      ? (type === 'sale'
        ? 'برای کالای انباری، انبار خروج را انتخاب کنید؛ بهای تمام‌شده با میانگین موزون ثبت می‌شود.'
        : 'برای کالای انباری، رسید قطعی متناظر را انتخاب کنید؛ فاکتور GRNI را به پرداختنی تسویه می‌کند.')
      : 'اتصال فاکتور به موجودی پس از Gate مهاجرت Backend فعال می‌شود؛ فاکتور خدماتی بدون تغییر کار می‌کند.';
    form.prepend(note);

    form.querySelectorAll('[data-invoice-line]').forEach((row, index) =>
      rowUI(row, type, context, old[index] || {})
    );
  } catch (error) {
    if (!isSchemaError(error)) showError(error, 'invoice inventory UI');
  }
}

async function augmentNewRows() {
  const form = document.getElementById('invoiceForm');
  if (!form) return;
  try {
    const context = await data();
    const type = typeOf(form);
    form.querySelectorAll('[data-invoice-line]').forEach(row => rowUI(row, type, context, {}));
  } catch (error) {
    if (!isSchemaError(error)) showError(error, 'invoice inventory new line');
  }
}

function metadata() {
  const form = document.getElementById('invoiceForm');
  if (!form) return [];
  return [...form.querySelectorAll('[data-invoice-line]')]
    .filter(row => (
      row.querySelector('[name=account]')?.value ||
      row.querySelector('[name=description]')?.value.trim() ||
      row.querySelector('[name=unit_price]')?.value.trim()
    ))
    .map(row => ({
      item_id: row.dataset.eItem || null,
      unit_id: row.dataset.eUnit || null,
      warehouse_id: row.querySelector('[data-e-wh]')?.value || null,
      receipt_line_id: row.querySelector('[data-e-rec]')?.value || null
    }));
}

if (!C.operations.has('rpc', 'rc14.invoice-inventory-bridge')) {
  C.operations.use('rpc', 'rc14.invoice-inventory-bridge', async ({ args, next }) => {
    let [name, payload = {}] = args;

    if (
      name === 'save_draft_invoice' &&
      Array.isArray(payload.p_lines) &&
      document.getElementById('invoiceForm') &&
      await ready()
    ) {
      const lineMetadata = metadata();
      payload = {
        ...payload,
        p_lines: payload.p_lines.map((line, index) => ({
          ...line,
          ...(lineMetadata[index] || {})
        }))
      };
    }

    if (name === 'reverse_journal_entry' && payload.jid && await ready()) {
      try {
        const invoices = await C.select(
          'invoices',
          `select=id&journal_entry_id=eq.${payload.jid}&status=eq.posted&limit=1`
        );
        if (invoices?.[0]) {
          return next('reverse_invoice', {
            p_invoice_id: invoices[0].id,
            p_reverse_date: payload.reverse_date,
            p_reason: payload.reason || null
          });
        }
      } catch (error) {
        if (!isSchemaError(error)) throw error;
      }
    }

    return next(name, payload);
  }, { priority: 100 });
}
C.__rc14eInvoiceBridge = true;

function cleanInt(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٬,\s]/g, '');
  return /^\d+$/.test(normalized) ? normalized : null;
}

function decimal(value, decimals = 6) {
  const normalized = String(value || '')
    .trim()
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/٫|,/g, '.');
  return new RegExp(`^\\d+(?:\\.\\d{1,${decimals}})?$`).test(normalized) ? normalized : null;
}

function highPrecision(form) {
  return schema === 'ready' && [...form.querySelectorAll('[data-invoice-line]')].some(row => {
    if (!row.dataset.eItem) return false;
    const quantity = String(row.querySelector('[name=quantity]')?.value || '').replace(/٫|,/g, '.');
    return (quantity.split('.')[1] || '').length > 3;
  });
}

async function saveHigh(form, submitter) {
  try {
    const context = await data();
    const type = typeOf(form);
    const fd = new FormData(form);
    const date = String(fd.get('date') || '');
    const rows = [];

    for (const row of form.querySelectorAll('[data-invoice-line]')) {
      const account = row.querySelector('[name=account]')?.value || '';
      const description = row.querySelector('[name=description]')?.value.trim() || '';
      const rawPrice = row.querySelector('[name=unit_price]')?.value || '';
      if (!account && !description && !String(rawPrice).trim()) continue;

      const item = context.items.find(record => record.id === row.dataset.eItem);
      const unit = context.units.find(record => record.id === item?.base_unit_id);
      const quantity = decimal(row.querySelector('[name=quantity]')?.value || '1', unit?.decimal_places ?? 6);
      const price = cleanInt(rawPrice);
      const discount = cleanInt(row.querySelector('[name=discount]')?.value || '0');
      if (!account || !quantity || Number(quantity) <= 0 || !price || BigInt(price) <= 0n || discount === null) {
        return toast('اطلاعات ردیف معتبر نیست');
      }

      rows.push({
        account_id: account,
        description,
        quantity,
        unit_price: price,
        discount,
        item_id: row.dataset.eItem || null,
        unit_id: row.dataset.eUnit || null,
        warehouse_id: row.querySelector('[data-e-wh]')?.value || null,
        receipt_line_id: row.querySelector('[data-e-rec]')?.value || null
      });
    }

    let fiscalYearId = null;
    if (invoiceId) {
      const invoiceRows = await C.select(
        'invoices',
        `select=fiscal_year_id&id=eq.${invoiceId}&workspace_id=eq.${context.company.id}&limit=1`
      );
      fiscalYearId = invoiceRows?.[0]?.fiscal_year_id;
    }
    fiscalYearId ||= context.years.find(year => date >= year.date_from && date <= year.date_to)?.id ||
      context.years.find(year => year.status === 'open')?.id;
    if (!fiscalYearId) return toast('سال مالی معتبر پیدا نشد');

    const id = await C.rpc('save_draft_invoice', {
      p_workspace_id: context.company.id,
      p_fiscal_year_id: fiscalYearId,
      p_invoice_id: invoiceId || null,
      p_invoice_type: type,
      p_invoice_date: date,
      p_due_date: fd.get('due') || null,
      p_party_id: fd.get('party'),
      p_description: fd.get('description'),
      p_lines: rows
    });

    const mode = submitter?.dataset?.invoiceSave || 'draft';
    if (mode === 'post') await C.rpc('post_invoice', { iid: id });
    closeModal();
    sessionStorage.setItem(
      'avan.rc14e.invoice.notice',
      mode === 'post' ? 'فاکتور کالایی ثبت قطعی شد' : 'فاکتور کالایی ذخیره شد'
    );
    location.reload();
  } catch (error) {
    showError(error, 'invoice high precision');
  }
}

function scheduleInvoiceAugment() {
  setTimeout(() => augment(document.getElementById('invoiceForm')), 0);
}

function install() {
  document.addEventListener('click', event => {
    const edit = event.target.closest?.('[data-edit-invoice]');
    if (edit) {
      invoiceId = edit.dataset.editInvoice;
      invoiceType = null;
      scheduleInvoiceAugment();
    }
    if (event.target.closest?.('#newSaleInvoice')) {
      invoiceId = null;
      invoiceType = 'sale';
      scheduleInvoiceAugment();
    }
    if (event.target.closest?.('#newPurchaseInvoice')) {
      invoiceId = null;
      invoiceType = 'purchase';
      scheduleInvoiceAugment();
    }
    if (event.target.closest?.('#addInvoiceLine')) {
      setTimeout(augmentNewRows, 0);
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'invoiceForm' || !highPrecision(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveHigh(event.target, event.submitter);
  }, true);

  window.addEventListener('avan:company-context-changed', () => {
    cache = null;
    schema = 'unknown';
  });

  const notice = sessionStorage.getItem('avan.rc14e.invoice.notice');
  if (notice) {
    sessionStorage.removeItem('avan.rc14e.invoice.notice');
    setTimeout(() => toast(notice), 700);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
