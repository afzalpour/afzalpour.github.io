'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { calculateVatAmount } from '../../domains/tax/vat-calculator.js';
import { amountInWords } from '../../../rc11-money.js';
import {
  UNIT_RIAL,
  normalizeUnit,
  displayToCanonical,
  canonicalToDisplay,
  lineCanonicalAmount,
  formatCanonical,
  groupInteger,
  latinDigits
} from '../../core/money/canonical-money.js';

const C = installAvanCloud();
const Lifecycle = installUiLifecycle();
const MONEY_FIELDS = new Set(['unit_price', 'discount']);
let queued = false;

function currentUnit() {
  return normalizeUnit(window.AVAN_MONEY_DISPLAY_UNIT);
}

function rowUsed(row) {
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function selectedRate(row) {
  const select = row.querySelector('[data-rc15-tax-profile]');
  if (!select?.value) return '0';
  const label = String(select.selectedOptions?.[0]?.textContent || '');
  if (/معاف|نرخ صفر/.test(label)) return '0';
  const normalized = latinDigits(label).replace(/٫/g, '.');
  const match = normalized.match(/(\d+(?:\.\d{1,4})?)\s*٪/);
  return match?.[1] || '0';
}

function wordsElement(input) {
  const field = input?.closest?.('.field') || input?.parentElement;
  return field?.querySelector?.('.money-in-words') || null;
}

function refreshInputWords(input, unit) {
  const words = wordsElement(input);
  if (!words) return;
  const next = input.value ? amountInWords(input.value, unit) : '';
  if (words.textContent !== next) words.textContent = next;
  words.hidden = !next;
}

function prepareInvoiceInputs(form) {
  if (form.dataset.avanMoneyInputsPrepared === '1') return;
  // Existing invoice rows arrive from the backend in canonical Toman. Let the
  // currency boundary perform that one initial projection before this workspace
  // takes ownership and freezes inputs in display-unit semantics.
  window.AvanCurrency?.prepare?.(form);
  form.dataset.avanMoneyInputsPrepared = '1';
}

function ensureFieldUnitLabels(form, unit) {
  const label = unit === UNIT_RIAL ? 'ریال' : 'تومان';
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    for (const name of MONEY_FIELDS) {
      const input = row.querySelector(`[name="${name}"]`);
      if (!input) continue;
      // The generic currency submit-boundary must never mutate invoice values.
      // Invoice values stay display-unit values until the RPC middleware.
      input.dataset.money = 'false';
      input.dataset.avanInvoiceMoneyInput = '1';
      const fieldLabel = input.closest('.field')?.querySelector('label');
      if (!fieldLabel) continue;
      const base = name === 'unit_price' ? 'فی' : 'تخفیف';
      const next = `${base} (${label})`;
      if (fieldLabel.textContent !== next) fieldLabel.textContent = next;
    }
  });
}

function ensureStableUnitBadge(form, unit) {
  form.querySelectorAll(':scope > .money-form-unit').forEach(node => node.remove());
  let badge = form.querySelector(':scope > [data-avan-invoice-unit]');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'avan-invoice-unit-badge';
    badge.dataset.avanInvoiceUnit = '1';
    form.prepend(badge);
  }
  const next = `واحد مبالغ: ${unit === UNIT_RIAL ? 'ریال' : 'تومان'}`;
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
    : 'مبلغ معتبر نیست.';
  input.setAttribute('aria-invalid', 'true');
}

function disableLegacyInvoiceCalculator(form) {
  form.querySelectorAll('[data-invoice-line] input,[data-invoice-line] select').forEach(control => {
    if (typeof control.oninput === 'function') control.oninput = null;
  });
}

function renderLine(row, unit) {
  const unitPrice = row.querySelector('[name="unit_price"]');
  const discount = row.querySelector('[name="discount"]');
  const result = lineCanonicalAmount({
    quantity: row.querySelector('[name="quantity"]')?.value || '1',
    unitPrice: unitPrice?.value || '0',
    discount: discount?.value || '0',
    unit
  });

  const priceResult = displayToCanonical(unitPrice?.value || '0', unit);
  const discountResult = displayToCanonical(discount?.value || '0', unit);
  setMoneyError(unitPrice, unitPrice?.value ? priceResult.code : null);
  setMoneyError(discount, discount?.value ? discountResult.code : null);
  refreshInputWords(unitPrice, unit);
  refreshInputWords(discount, unit);

  const target = row.querySelector('[data-line-amount]');
  if (target) {
    target.dataset.avanMoneyOwned = '1';
    const next = result.ok ? formatCanonical(result.value, unit) : 'نامعتبر';
    if (target.textContent !== next) target.textContent = next;
    target.classList.toggle('neg', !result.ok);
  }
  return result;
}

function renderTaxSummary(form, subtotal, tax, unit, valid) {
  const summary = form.querySelector('[data-rc15-invoice-tax-summary]');
  if (!summary) return;
  summary.dataset.avanMoneyOwned = '1';
  if (!valid) {
    const next = '<div class="info-box neg">ابتدا مبلغ‌های نامعتبر را اصلاح کنید.</div>';
    if (summary.innerHTML !== next) summary.innerHTML = next;
    return;
  }
  const enabled = form.dataset.rc15TaxEnabled === '1';
  if (!enabled) {
    const next = '<div class="info-box">مالیات برای این شرکت غیرفعال است؛ جمع فاکتور بدون مالیات محاسبه می‌شود.</div>';
    if (summary.innerHTML !== next) summary.innerHTML = next;
    return;
  }
  const total = subtotal + tax;
  const next = `<div class="rc15-invoice-totals"><span><small>جمع قبل از مالیات</small><b>${formatCanonical(subtotal, unit)}</b></span><span><small>مالیات</small><b>${formatCanonical(tax, unit)}</b></span><span class="rc15-grand"><small>جمع نهایی</small><b>${formatCanonical(total, unit)}</b></span></div>`;
  if (summary.innerHTML !== next) summary.innerHTML = next;
}

export function projectInvoiceMoney(form = document.getElementById('invoiceForm')) {
  if (!form) return null;
  const unit = currentUnit();
  prepareInvoiceInputs(form);
  disableLegacyInvoiceCalculator(form);
  ensureStableUnitBadge(form, unit);
  ensureFieldUnitLabels(form, unit);

  let subtotal = 0n;
  let tax = 0n;
  let valid = true;
  const taxEnabled = form.dataset.rc15TaxEnabled === '1';

  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    if (!rowUsed(row)) return;
    const line = renderLine(row, unit);
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
        const next = `مالیات این ردیف: ${formatCanonical(rowTax, unit)}`;
        if (note.textContent !== next) note.textContent = next;
      }
    }
  });

  const total = subtotal + tax;
  const invoiceTotal = form.querySelector('#invoiceTotal');
  if (invoiceTotal) {
    invoiceTotal.dataset.avanMoneyOwned = '1';
    const next = valid ? formatCanonical(total, unit) : 'نامعتبر';
    if (invoiceTotal.textContent !== next) invoiceTotal.textContent = next;
  }
  const grand = form.querySelector('.invoice-grand-total');
  if (grand) grand.dataset.avanMoneyOwned = '1';

  renderTaxSummary(form, subtotal, tax, unit, valid);

  if (valid) {
    form.dataset.avanCanonicalInvoiceSubtotalToman = subtotal.toString();
    form.dataset.avanCanonicalInvoiceTaxToman = tax.toString();
    form.dataset.avanCanonicalInvoiceTotalToman = total.toString();
    form.dataset.avanInvoiceTotal = total.toString();
  } else {
    delete form.dataset.avanCanonicalInvoiceSubtotalToman;
    delete form.dataset.avanCanonicalInvoiceTaxToman;
    delete form.dataset.avanCanonicalInvoiceTotalToman;
    delete form.dataset.avanInvoiceTotal;
  }

  const signature = `${unit}|${valid ? 1 : 0}|${subtotal}|${tax}|${total}`;
  if (form.dataset.avanMoneySignature !== signature) {
    form.dataset.avanMoneySignature = signature;
    document.dispatchEvent(new CustomEvent('avan:invoice-money-changed', {
      detail: { unit, valid, subtotal, tax, total }
    }));
  }
  return { unit, valid, subtotal, tax, total };
}

function queueProject() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    projectInvoiceMoney();
  });
}

function canonicalizeInvoicePayload(payload) {
  if (!payload || !Array.isArray(payload.p_lines)) return payload;
  const unit = currentUnit();
  if (unit !== UNIT_RIAL) return payload;
  return {
    ...payload,
    p_lines: payload.p_lines.map(line => {
      const price = displayToCanonical(line.unit_price, unit);
      const discount = displayToCanonical(line.discount || '0', unit);
      if (!price.ok || !discount.ok) {
        const error = new Error('RIAL_NOT_DIVISIBLE_BY_10');
        error.userMessage = 'مبلغ ریالی باید مضرب ۱۰ باشد.';
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

function convertOpenInvoiceInputs(previous, next) {
  const form = document.getElementById('invoiceForm');
  if (!form || previous === next) return;
  form.querySelectorAll('[data-invoice-line]').forEach(row => {
    for (const name of MONEY_FIELDS) {
      const input = row.querySelector(`[name="${name}"]`);
      if (!input?.value) continue;
      const canonical = displayToCanonical(input.value, previous);
      if (!canonical.ok) continue;
      const displayed = canonicalToDisplay(canonical.value, next);
      if (displayed === null) continue;
      input.value = groupInteger(displayed);
      input.dataset.currencyPreparedUnit = next;
      refreshInputWords(input, next);
    }
  });
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
  if (event.target.matches?.('[data-e-item]')) {
    // Tax profile follows the selected item in a zero-delay callback. Run once
    // after that callback so the canonical projection remains the final writer.
    setTimeout(projectInvoiceMoney, 0);
  }
});
document.addEventListener('avan:money-unit-changed', event => {
  const previous = normalizeUnit(event.detail?.previous);
  const next = normalizeUnit(event.detail?.unit);
  convertOpenInvoiceInputs(previous, next);
  projectInvoiceMoney();
});
document.addEventListener('avan:ui-changed', queueProject);
window.addEventListener('avan:page-rendered', () => Lifecycle.schedule('invoice-money-page-rendered'));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('invoice-money-ready'), { once: true });
} else {
  Lifecycle.schedule('invoice-money-ready');
}

window.AvanInvoiceMoney = Object.freeze({
  project: projectInvoiceMoney,
  currentUnit,
  canonicalizeInvoicePayload
});
