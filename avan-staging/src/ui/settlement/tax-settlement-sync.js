'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();
let syncQueued = false;

const latin = value => String(value ?? '')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

function integerFromText(value) {
  const normalized = latin(value).replace(/[٬,\s]/g, '');
  const match = normalized.match(/-?\d+/);
  if (!match) return null;
  try { return BigInt(match[0]); } catch { return null; }
}

function groupInteger(value) {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

function finalInvoiceTotal(form) {
  const taxGrand = integerFromText(
    form.querySelector('[data-rc15-invoice-tax-summary] .rc15-grand b')?.textContent
  );
  if (taxGrand !== null) return taxGrand;

  const contracted = integerFromText(form.dataset.avanInvoiceTotal || '');
  if (contracted !== null) return contracted;

  return integerFromText(
    form.querySelector('.invoice-grand-total')?.textContent || ''
  );
}

function plannedRowsTotal(box) {
  let total = 0n;
  box.querySelectorAll('[name="v60_amount"]').forEach(input => {
    total += integerFromText(input.value) ?? 0n;
  });
  return total;
}

export function syncTaxSettlementTotal(documentObject = document) {
  const form = documentObject.getElementById('invoiceForm');
  const box = form?.querySelector('[data-v60-settlement-box]');
  if (!form || !box) return false;

  const total = finalInvoiceTotal(form);
  if (total === null || total < 0n) return false;

  form.dataset.avanInvoiceTotal = total.toString();
  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    input.value = groupInteger(total);
  });

  const planType = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  const scheduled = ['credit', 'cash', 'check'].includes(planType)
    ? total
    : plannedRowsTotal(box);

  const totalNode = box.querySelector('[data-v60-plan-total]');
  if (totalNode) {
    const matches = scheduled === total;
    totalNode.innerHTML = `جمع برنامه: <b>${groupInteger(scheduled)} تومان</b> از <b>${groupInteger(total)} تومان</b> ${matches ? '<span class="pos">✓ برابر</span>' : '<span class="neg">مغایرت</span>'}`;
  }

  return true;
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncTaxSettlementTotal();
  });
}

Lifecycle.use('settlement:tax-final-total-sync', () => syncTaxSettlementTotal(), { priority: 900 });
document.addEventListener('input', event => {
  if (event.target?.closest?.('#invoiceForm')) queueSync();
}, true);
document.addEventListener('change', event => {
  if (event.target?.closest?.('#invoiceForm')) queueSync();
}, true);
