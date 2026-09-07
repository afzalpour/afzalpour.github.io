'use strict';

import { jalalizeDateInputs } from './src/ui/date/jalali-picker.js';
import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { toast, showError } from './src/ui/feedback/toast.js';

const C = installAvanCloud();
const previousRpc = C.rpc.bind(C);
let scheduled = false;

const faDate = iso => {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso || '—';
  }
};

const groupInt = value => {
  const s = String(value ?? '0').replace(/\D/g, '') || '0';
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
};

const trimDecimal = value => {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const [i = '0', f = ''] = s.split('.');
  const frac = f.replace(/0+$/, '');
  const intPart = (i || '0').replace(/^0+(?=\d)/, '') || '0';
  const grouped = groupInt(intPart);
  return frac ? `${grouped}٫${frac}` : grouped;
};

const roundDecimalStringToInteger = value => {
  const raw = String(value ?? '0').trim();
  const [iRaw = '0', fRaw = ''] = raw.split('.');
  let n = BigInt((iRaw || '0').replace(/^\+/, '') || '0');
  if ((fRaw[0] || '0') >= '5') n += 1n;
  return n.toString();
};

async function activeCompany() {
  const state = await C.companyContext.ensure();
  const company = state?.active_company;
  if (!company?.id) throw new Error('COMPANY_REQUIRED');
  return company;
}

async function receiptLine(lineId) {
  const company = await activeCompany();
  const wid = company.id;
  const lines = await C.select(
    'inventory_document_lines',
    `select=id,inventory_document_id,item_id,quantity,unit_cost&workspace_id=eq.${wid}&id=eq.${lineId}&limit=1`
  );
  const line = lines?.[0];
  if (!line) throw new Error('PURCHASE_RECEIPT_LINE_NOT_FOUND');
  const docs = await C.select(
    'inventory_documents',
    `select=id,document_no,document_date,document_type,status&workspace_id=eq.${wid}&id=eq.${line.inventory_document_id}&limit=1`
  );
  const doc = docs?.[0];
  if (!doc || doc.document_type !== 'receipt' || doc.status !== 'posted') {
    throw new Error('PURCHASE_RECEIPT_NOT_POSTED');
  }
  return { company, line, doc };
}

function setLocked(input, locked, title = '') {
  if (!input) return;
  input.readOnly = locked;
  input.classList.toggle('rc14-purchase-receipt-locked', locked);
  if (locked) {
    input.dataset.rc14ReceiptLocked = '1';
    input.title = title;
  } else {
    delete input.dataset.rc14ReceiptLocked;
    input.removeAttribute('title');
  }
}

function receiptHelp(row) {
  let help = row.querySelector('[data-rc14-receipt-help]');
  if (!help) {
    help = document.createElement('small');
    help.dataset.rc14ReceiptHelp = '1';
    help.className = 'rc14l-field-help';
    row.querySelector('[data-e-recf]')?.append(help);
  }
  return help;
}

async function applyReceiptToRow(row, select) {
  const id = select?.value || '';
  const qty = row.querySelector('[name="quantity"]');
  const price = row.querySelector('[name="unit_price"]');
  const discount = row.querySelector('[name="discount"]');
  const itemSelect = row.querySelector('[data-e-item]');
  const help = receiptHelp(row);

  if (!id) {
    setLocked(qty, false);
    setLocked(price, false);
    setLocked(discount, false);
    if (help) help.textContent = '';
    return;
  }

  try {
    const { line, doc } = await receiptLine(id);
    if (itemSelect && itemSelect.value && itemSelect.value !== line.item_id) {
      throw new Error('PURCHASE_RECEIPT_ITEM_MISMATCH');
    }

    if (itemSelect && itemSelect.value !== line.item_id) {
      itemSelect.value = line.item_id;
      itemSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));
      const refreshed = row.querySelector('[data-e-rec]');
      if (refreshed) refreshed.value = id;
    }

    row.dataset.eItem = line.item_id;
    if (qty) {
      qty.value = trimDecimal(line.quantity);
      qty.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (price) {
      price.value = groupInt(roundDecimalStringToInteger(line.unit_cost));
      price.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (discount) {
      discount.value = '0';
      discount.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const title = `مقدار و بهای این ردیف از رسید قطعی شماره ${doc.document_no ?? '—'} خوانده می‌شود.`;
    setLocked(qty, true, title);
    setLocked(price, true, title);
    setLocked(discount, true, title);
    if (help) help.textContent = `رسید ${doc.document_no ?? '—'} · ${faDate(doc.document_date)} · مقدار ${trimDecimal(line.quantity)}`;
  } catch (err) {
    showError(err, 'purchase receipt sync');
  }
}

function jalaliReceiptOptionLabels(select) {
  if (!select) return;
  [...select.options].forEach(option => {
    if (option.dataset.rc14Jalali === '1') return;
    option.textContent = option.textContent.replace(/\b\d{4}-\d{2}-\d{2}\b/g, iso => faDate(iso));
    option.dataset.rc14Jalali = '1';
  });
}

function bindPurchaseRows() {
  const form = document.getElementById('invoiceForm');
  if (!form || form.dataset.rc14InvoiceType !== 'purchase') return;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    const select = row.querySelector('[data-e-rec]');
    if (!select) return;
    jalaliReceiptOptionLabels(select);
    if (select.dataset.rc14ReceiptSync !== '1') {
      select.dataset.rc14ReceiptSync = '1';
      select.addEventListener('change', () => applyReceiptToRow(row, select));
    }
    if (select.value && row.dataset.rc14ReceiptApplied !== select.value) {
      row.dataset.rc14ReceiptApplied = select.value;
      applyReceiptToRow(row, select);
    }
  });
}

C.rpc = async (name, args = {}) => {
  const form = document.getElementById('invoiceForm');
  let next = args;
  if (name === 'save_draft_invoice' && form?.dataset.rc14InvoiceType === 'purchase') {
    const savedId = form.dataset.rc14PurchaseDraftId || '';
    if (!args.p_invoice_id && savedId) next = { ...args, p_invoice_id: savedId };
  }
  const result = await previousRpc(name, next);
  if (name === 'save_draft_invoice' && form?.dataset.rc14InvoiceType === 'purchase' && result) {
    form.dataset.rc14PurchaseDraftId = String(result);
  }
  return result;
};

function replaceInventoryCopy(root = document) {
  const scope = root.querySelector?.('.rc14-inventory-page') || document.querySelector('.rc14-inventory-page');
  if (!scope) return;
  const nodes = scope.querySelectorAll('p,small,span,div');
  nodes.forEach(el => {
    if (el.children.length) return;
    const text = String(el.textContent || '').trim();
    if (!text) return;
    if (/^شرکت:.*RC1\.4-A Foundation$/i.test(text)) {
      el.remove();
      return;
    }
    if (text === 'گروه اصلی → مدل / زیرگروه → کالای واقعی (SKU). موجودی فقط روی SKU واقعی ثبت می‌شود.') {
      el.remove();
      return;
    }
    if (text === 'اطلاعات پایه؛ هنوز گردش موجودی و بهای تمام‌شده در این Gate ثبت نمی‌شود.') {
      el.remove();
      return;
    }
    if (text === 'تمام مانده‌ها از Movement Ledger قطعی محاسبه می‌شوند.') {
      el.remove();
      return;
    }
    if (text === 'پایه RC1.4') {
      el.textContent = 'محاسبه خودکار';
      return;
    }
    if (text === 'کنترل سطح Ledger در Gate بعدی') {
      el.textContent = 'بر اساس اسناد ثبت‌شده';
    }
  });
}

function convertInventoryDisplayDates(root = document) {
  const inventory = document.querySelector('.rc14-inventory-page');
  const modal = document.getElementById('modal');
  const scopes = [inventory];
  if (modal && (modal.querySelector('#eDocForm') || modal.querySelector('#eRev') || modal.textContent.includes('سند انبار') || modal.textContent.includes('کارت کالا'))) {
    scopes.push(modal);
  }
  scopes.filter(Boolean).forEach(scope => {
    scope.querySelectorAll('td,small,span,div').forEach(el => {
      if (el.children.length || el.dataset.rc14JalaliDisplay === '1') return;
      const text = String(el.textContent || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return;
      el.dataset.rc14JalaliDisplay = '1';
      el.dataset.rc14IsoDate = text;
      el.textContent = faDate(text);
    });
  });
}

function jalalizeInventoryInputs() {
  const page = document.querySelector('.rc14-inventory-page');
  if (page) jalalizeDateInputs(page);
  const modal = document.getElementById('modal');
  if (modal && (modal.querySelector('#eDocForm') || modal.querySelector('#eRev'))) {
    jalalizeDateInputs(modal);
  }
}

function polish() {
  bindPurchaseRows();
  replaceInventoryCopy();
  convertInventoryDisplayDates();
  jalalizeInventoryInputs();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    polish();
  });
}

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
window.addEventListener('avan:company-context-changed', schedule);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
else schedule();
