'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const latin = value => String(value ?? '')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

export function integerFromText(value) {
  const normalized = latin(value).replace(/[٬,\s]/g, '');
  const match = normalized.match(/-?\d+/);
  if (!match) return null;
  try { return BigInt(match[0]); } catch { return null; }
}

export function groupInteger(value) {
  const amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

export function finalInvoiceTotal(form) {
  const taxGrand = integerFromText(
    form?.querySelector?.('[data-rc15-invoice-tax-summary] .rc15-grand b')?.textContent
  );
  if (taxGrand !== null) return taxGrand;

  const contracted = integerFromText(form?.dataset?.avanInvoiceTotal || '');
  if (contracted !== null) return contracted;

  return integerFromText(
    form?.querySelector?.('.invoice-grand-total')?.textContent || ''
  );
}

function plannedRowsTotal(box) {
  let total = 0n;
  box.querySelectorAll('[name="v60_amount"]').forEach(input => {
    total += integerFromText(input.value) ?? 0n;
  });
  return total;
}

function setValue(input, value) {
  if (input && input.value !== value) input.value = value;
}

function setHtml(node, html) {
  if (node && node.innerHTML !== html) node.innerHTML = html;
}

export function syncTaxSettlementTotal(documentObject) {
  const form = documentObject?.getElementById?.('invoiceForm');
  const box = form?.querySelector('[data-v60-settlement-box]');
  if (!form || !box) return false;

  const total = finalInvoiceTotal(form);
  if (total === null || total < 0n) return false;

  const totalText = total.toString();
  if (form.dataset.avanInvoiceTotal !== totalText) {
    form.dataset.avanInvoiceTotal = totalText;
  }

  const formattedTotal = groupInteger(total);
  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    setValue(input, formattedTotal);
  });

  const planType = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  const scheduled = ['credit', 'cash', 'check'].includes(planType)
    ? total
    : plannedRowsTotal(box);

  const totalNode = box.querySelector('[data-v60-plan-total]');
  if (totalNode) {
    const matches = scheduled === total;
    const html = `جمع برنامه: <b>${groupInteger(scheduled)} تومان</b> از <b>${formattedTotal} تومان</b> ${matches ? '<span class="pos">✓ برابر</span>' : '<span class="neg">مغایرت</span>'}`;
    setHtml(totalNode, html);
  }

  return true;
}

export function installTaxSettlementSync({ globalObject = globalThis, documentObject = globalObject.document } = {}) {
  if (!documentObject?.addEventListener) return null;
  if (globalObject.AvanTaxSettlementSync?.installed) return globalObject.AvanTaxSettlementSync;

  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  let syncQueued = false;

  const queueSync = () => {
    if (syncQueued) return;
    syncQueued = true;
    globalObject.queueMicrotask(() => {
      syncQueued = false;
      syncTaxSettlementTotal(documentObject);
    });
  };

  Lifecycle.use('settlement:tax-final-total-sync', () => syncTaxSettlementTotal(documentObject), { priority: 900 });
  documentObject.addEventListener('input', event => {
    if (event.target?.closest?.('#invoiceForm')) queueSync();
  }, true);
  documentObject.addEventListener('change', event => {
    if (event.target?.closest?.('#invoiceForm')) queueSync();
  }, true);

  const api = Object.freeze({ installed: true, sync: () => syncTaxSettlementTotal(documentObject) });
  globalObject.AvanTaxSettlementSync = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installTaxSettlementSync({ globalObject: window, documentObject: document });
}
