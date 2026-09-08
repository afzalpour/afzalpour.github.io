'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { calculateVatAmount } from '../../domains/tax/vat-calculator.js';
import { MoneyRuntime } from './money-runtime.js';
import { lineCanonicalAmount } from '../../core/money/canonical-money.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
const MONEY_FIELDS = new Set(['unit_price', 'discount']);
let queued = false;

function rowUsed(row) {
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function selectedRate(row) {
  const option = row.querySelector('[data-rc15-tax-profile]')?.selectedOptions?.[0];
  return option?.dataset?.taxRate || '0';
}

function hydrateCanonicalInput(input) {
  if (!input || input.dataset.avanMoneyHydrated === '1') return;
  input.dataset.moneyInput = 'true';
  if (input.value) input.value = MoneyRuntime.inputFromCanonical(input.value);
  input.dataset.avanMoneyHydrated = '1';
}

function prepareInvoiceInputs(form) {
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    for (const name of MONEY_FIELDS) hydrateCanonicalInput(row.querySelector(`[name="${name}"]`));
  });
}

function ensureFieldUnitLabels(form) {
  const label = MoneyRuntime.unitLabel();
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    for (const name of MONEY_FIELDS) {
      const input = row.querySelector(`[name="${name}"]`);
      if (!input) continue;
      input.dataset.moneyInput = 'true';
      const fieldLabel = input.closest('.field')?.querySelector('label');
      if (!fieldLabel) continue;
      const base = name === 'unit_price' ? 'فی' : 'تخفیف';
      const next = `${base} (${label})`;
      if (fieldLabel.textContent !== next) fieldLabel.textContent = next;
    }
  });
}

function ensureStableUnitBadge(form) {
  form.querySelectorAll(':scope > .money-form-unit').forEach(node => node.remove());
  let badge = form.querySelector(':scope > [data-avan-invoice-unit]');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'avan-invoice-unit-badge';
    badge.dataset.avanInvoiceUnit = '1';
    form.prepend(badge);
  }
  const next = `واحد مبالغ: ${MoneyRuntime.unitLabel()}`;
  if (badge.textContent !== next) badge.textContent = next;
}

function setMoneyError(input, code) {
  if (!input) return;
  const field = input.closest('.field') || input.parentElement;
  if (!field) return;
  let note = field.querySelector(':scope > [data-avan-money-error]');
  if (!code) {
    note?.remove();
    input.removeAttribute('aria-invalid');
    return;
  }
  if (!note) {
    note = document.createElement('small');
    note.dataset.avanMoneyError = '1';
    note.className = 'neg';
    field.append(note);
  }
  note.textContent = code === 'RIAL_NOT_DIVISIBLE_BY_10'
    ? 'مبلغ ریالی باید مضرب ۱۰ باشد.'
    : code === 'DISCOUNT_EXCEEDS_GROSS'
      ? 'تخفیف نمی‌تواند از مبلغ ردیف بیشتر باشد.'
      : 'مبلغ معتبر نیست.';
  input.setAttribute('aria-invalid', 'true');
}

function renderLine(row) {
  const unitPrice = row.querySelector('[name="unit_price"]');
  const discount = row.querySelector('[name="discount"]');
  const unit = MoneyRuntime.unit();
  const result = lineCanonicalAmount({
    quantity: row.querySelector('[name="quantity"]')?.value || '1',
    unitPrice: unitPrice?.value || '0',
    discount: discount?.value || '0',
    unit
  });

  const priceResult = MoneyRuntime.parseInput(unitPrice?.value || '0');
  const discountResult = MoneyRuntime.parseInput(discount?.value || '0');
  setMoneyError(unitPrice, unitPrice?.value ? priceResult.code : null);
  setMoneyError(discount, discount?.value ? discountResult.code : null);

  const target = row.querySelector('[data-line-amount]');
  if (target) {
    target.dataset.avanMoneyOwned = 'invoice';
    const next = result.ok ? MoneyRuntime.formatCanonical(result.value) : 'نامعتبر';
    if (target.textContent !== next) target.textContent = next;
    target.classList.toggle('neg', !result.ok);
  }
  return result;
}

function renderTaxSummary(form, subtotal, tax, valid) {
  const summary = form.querySelector('[data-rc15-invoice-tax-summary]');
  if (!summary) return;
  summary.dataset.avanMoneyOwned = 'invoice';
  if (!valid) {
    const next = '<div class="info-box neg">ابتدا مبلغ‌های نامعتبر را اصلاح کنید.</div>';
    if (summary.innerHTML !== next) summary.innerHTML = next;
    return;
  }
  if (form.dataset.rc15TaxEnabled !== '1') {
    const next = '<div class="info-box">مالیات برای این شرکت غیرفعال است؛ جمع فاکتور بدون مالیات محاسبه می‌شود.</div>';
    if (summary.innerHTML !== next) summary.innerHTML = next;
    return;
  }
  const total = subtotal + tax;
  const next = `<div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${MoneyRuntime.formatCanonical(subtotal)}</b></span><span><small>مالیات</small><b>${MoneyRuntime.formatCanonical(tax)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${MoneyRuntime.formatCanonical(total)}</b></span></div>`;
  if (summary.innerHTML !== next) summary.innerHTML = next;
}

export function projectInvoiceMoney(form = document.getElementById('invoiceForm')) {
  if (!form || !MoneyRuntime?.isReady()) return null;
  prepareInvoiceInputs(form);
  ensureStableUnitBadge(form);
  ensureFieldUnitLabels(form);

  let subtotal = 0n;
  let tax = 0n;
  let valid = true;
  const taxEnabled = form.dataset.rc15TaxEnabled === '1';

  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    if (!rowUsed(row)) return;
    const line = renderLine(row);
    if (!line.ok) {
      valid = false;
      return;
    }
    subtotal += line.value;
    if (taxEnabled) {
      const rowTax = calculateVatAmount({ taxableAmount: line.value, rate: selectedRate(row) }) ?? 0n;
      tax += rowTax;
      const note = row.querySelector('[data-rc15-line-tax-note]');
      if (note) {
        const next = `مالیات این ردیف: ${MoneyRuntime.formatCanonical(rowTax)}`;
        if (note.textContent !== next) note.textContent = next;
      }
    }
  });

  const total = subtotal + tax;
  const invoiceTotal = form.querySelector('#invoiceTotal');
  if (invoiceTotal) {
    invoiceTotal.dataset.avanMoneyOwned = 'invoice';
    const next = valid ? MoneyRuntime.formatCanonical(total) : 'نامعتبر';
    if (invoiceTotal.textContent !== next) invoiceTotal.textContent = next;
  }
  const grand = form.querySelector('.invoice-grand-total');
  if (grand) grand.dataset.avanMoneyOwned = 'invoice';

  renderTaxSummary(form, subtotal, tax, valid);

  if (valid) {
    form.dataset.avanCanonicalInvoiceSubtotalToman = subtotal.toString();
    form.dataset.avanCanonicalInvoiceTaxToman = tax.toString();
    form.dataset.avanCanonicalInvoiceTotalToman = total.toString();
  } else {
    delete form.dataset.avanCanonicalInvoiceSubtotalToman;
    delete form.dataset.avanCanonicalInvoiceTaxToman;
    delete form.dataset.avanCanonicalInvoiceTotalToman;
  }

  const signature = `${MoneyRuntime.unit()}|${valid ? 1 : 0}|${subtotal}|${tax}|${total}`;
  if (form.dataset.avanMoneySignature !== signature) {
    form.dataset.avanMoneySignature = signature;
    document.dispatchEvent(new CustomEvent('avan:invoice-money-changed', {
      detail: { unit: MoneyRuntime.unit(), valid, subtotal, tax, total }
    }));
  }
  return { unit: MoneyRuntime.unit(), valid, subtotal, tax, total };
}

function queueProject() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    projectInvoiceMoney();
  });
}

export function canonicalizeInvoicePayload(payload) {
  if (!payload || !Array.isArray(payload.p_lines)) return payload;
  return {
    ...payload,
    p_lines: payload.p_lines.map(line => {
      const price = MoneyRuntime.parseInput(line.unit_price);
      const discount = MoneyRuntime.parseInput(line.discount || '0');
      if (!price.ok || !discount.ok) {
        const error = new Error(price.code || discount.code || 'INVALID_AMOUNT');
        error.userMessage = price.code === 'RIAL_NOT_DIVISIBLE_BY_10' || discount.code === 'RIAL_NOT_DIVISIBLE_BY_10'
          ? 'مبلغ ریالی باید مضرب ۱۰ باشد.'
          : 'مبلغ یکی از ردیف‌های فاکتور معتبر نیست.';
        throw error;
      }
      return {
        ...line,
        unit_price: price.value.toString(),
        discount: discount.value.toString()
      };
    })
  };
}

if (!C.operations.has('rpc', 'money.invoice-canonical-payload')) {
  C.operations.use('rpc', 'money.invoice-canonical-payload', ({ args, next }) => {
    const [name, payload = {}] = args;
    if (name !== 'save_draft_invoice') return next(name, payload);
    return next(name, canonicalizeInvoicePayload(payload));
  }, { priority: 150 });
}

Lifecycle.use('money:invoice-single-owner', () => projectInvoiceMoney(), { priority: 35 });

document.addEventListener('input', event => {
  if (event.target?.closest?.('#invoiceForm')) queueProject();
});
document.addEventListener('change', event => {
  if (!event.target?.closest?.('#invoiceForm')) return;
  queueProject();
  if (event.target.matches?.('[data-e-item]')) setTimeout(queueProject, 0);
});
document.addEventListener('avan:invoice-tax-metadata-changed', queueProject);
document.addEventListener('avan:ui-changed', queueProject);
window.addEventListener('avan:page-rendered', () => Lifecycle.schedule('invoice-money-page-rendered'));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('invoice-money-ready'), { once: true });
} else {
  Lifecycle.schedule('invoice-money-ready');
}

window.AvanInvoiceMoney = Object.freeze({
  architecture: 'invoice-money-single-writer-v2',
  project: projectInvoiceMoney,
  canonicalizeInvoicePayload
});
