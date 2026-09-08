'use strict';

import { installUiLifecycle } from './src/ui/runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const INVOICE_MONEY_NAMES = new Set(['quantity', 'unit_price', 'discount']);

function latin(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

function integerBig(value) {
  const raw = latin(value).replace(/[٬,\s]/g, '');
  return /^\d+$/.test(raw) ? BigInt(raw) : null;
}

function decimalMicros(value) {
  const raw = latin(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');

  if (!/^\d+(?:\.\d{0,6})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole || '0') * 1000000n +
    BigInt((fraction + '000000').slice(0, 6));
}

function grouped(value) {
  let amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  const sign = amount < 0n ? '−' : '';
  if (amount < 0n) amount = -amount;
  return sign + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

function money(value) {
  return `${grouped(value)} تومان`;
}

function invoiceTotal(form) {
  let total = 0n;
  for (const row of form.querySelectorAll('[data-invoice-line]')) {
    const quantity = decimalMicros(row.querySelector('[name="quantity"]')?.value || '1');
    const unitPrice = integerBig(row.querySelector('[name="unit_price"]')?.value || '0');
    const discount = integerBig(row.querySelector('[name="discount"]')?.value || '0');
    if (quantity === null || unitPrice === null || discount === null) continue;

    const gross = (quantity * unitPrice + 500000n) / 1000000n;
    if (gross > discount) total += gross - discount;
  }
  return total;
}

function settlementScheduled(box, total) {
  const type = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  if (['credit', 'cash', 'check'].includes(type)) return total;

  let scheduled = 0n;
  box.querySelectorAll('[name="v60_amount"]').forEach(input => {
    scheduled += integerBig(input.value) || 0n;
  });
  return scheduled;
}

function setText(element, value) {
  if (!element) return;
  const next = String(value);
  if (element.textContent !== next) element.textContent = next;
}

function refreshSettlementTotals(form) {
  const box = form.querySelector('[data-v60-settlement-box]');
  if (!box) return;

  const total = invoiceTotal(form);
  const scheduled = settlementScheduled(box, total);

  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    const next = grouped(total);
    if (input.value !== next) input.value = next;
  });

  const host = box.querySelector('[data-v60-plan-total]');
  if (!host) return;

  const values = host.querySelectorAll('b');
  setText(values[0], money(scheduled));
  setText(values[1], money(total));

  const status = host.querySelector('span');
  if (!status) return;
  const balanced = scheduled === total;
  const nextClass = balanced ? 'pos' : 'neg';
  if (status.className !== nextClass) status.className = nextClass;
  setText(status, balanced ? '✓ برابر' : 'مغایرت');
}

function bindInvoiceMoneyInputs(form) {
  if (!form) return;

  form.querySelectorAll('[data-invoice-line] input').forEach(input => {
    if (!INVOICE_MONEY_NAMES.has(input.name) || input.dataset.c14InputStable === '1') return;
    input.dataset.c14InputStable = '1';

    input.addEventListener('input', event => {
      // Keep target/capture handlers (money formatting, base invoice totals and tax)
      // but do not bubble into the legacy V60 form-level scan on every keystroke.
      event.stopPropagation();
      queueMicrotask(() => refreshSettlementTotals(form));
    });
  });
}

Lifecycle.use('c1.4:invoice-input-stability', () => {
  bindInvoiceMoneyInputs(document.getElementById('invoiceForm'));
}, { priority: 20 });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('c1.4-ready'), { once: true });
} else {
  Lifecycle.schedule('c1.4-ready');
}

export {
  decimalMicros,
  integerBig,
  invoiceTotal,
  refreshSettlementTotals,
  bindInvoiceMoneyInputs
};
