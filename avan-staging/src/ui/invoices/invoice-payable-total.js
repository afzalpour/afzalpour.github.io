'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createTaxService } from '../../application/tax/tax-service.js';
import { calculateTaxableAmount, calculateVatAmount } from '../../domains/tax/vat-calculator.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';

export function calculateInvoicePayableTotals(lines = [], profiles = [], taxEnabled = false) {
  const byId = new Map((profiles || []).map(profile => [profile.id, profile]));
  let subtotal = 0n;
  let tax = 0n;

  for (const line of lines || []) {
    if (!line?.used) continue;
    const base = calculateTaxableAmount({
      quantity: line.quantity ?? '1',
      unitPrice: line.unitPrice ?? '0',
      discount: line.discount ?? '0'
    });
    if (base === null) continue;
    subtotal += base;

    if (!taxEnabled) continue;
    const profile = byId.get(line.taxProfileId || '');
    if (!profile) continue;
    tax += calculateVatAmount({ taxableAmount: base, rate: profile.rate }) ?? 0n;
  }

  return Object.freeze({ subtotal, tax, total: subtotal + tax });
}

function formLines(form) {
  return [...form.querySelectorAll('[data-invoice-line]')].map(row => ({
    used: Boolean(
      row.querySelector('[name="account"]')?.value ||
      row.querySelector('[name="description"]')?.value?.trim() ||
      row.querySelector('[name="unit_price"]')?.value?.trim()
    ),
    quantity: row.querySelector('[name="quantity"]')?.value || '1',
    unitPrice: row.querySelector('[name="unit_price"]')?.value || '0',
    discount: row.querySelector('[name="discount"]')?.value || '0',
    taxProfileId: row.querySelector('[data-rc15-tax-profile]')?.value || null
  }));
}

export function publishInvoicePayableTotal(form, totals, { globalObject = window } = {}) {
  if (!form || !totals) return;
  form.dataset.avanInvoiceSubtotal = totals.subtotal.toString();
  form.dataset.avanInvoiceTaxTotal = totals.tax.toString();
  form.dataset.avanInvoiceTotal = totals.total.toString();

  const EventCtor = globalObject.CustomEvent;
  if (EventCtor) {
    form.dispatchEvent(new EventCtor('avan:invoice-total-changed', {
      detail: Object.freeze({
        subtotal: totals.subtotal.toString(),
        tax: totals.tax.toString(),
        total: totals.total.toString()
      })
    }));
  }
}

export function installInvoicePayableTotalContract({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanInvoicePayableTotal?.architecture === 'invoice-payable-total-v1') {
    return globalObject.AvanInvoicePayableTotal;
  }

  const C = installAvanCloud({ globalObject });
  const Tax = createTaxService(C);
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  let timer = null;

  async function refresh(form = documentObject.getElementById('invoiceForm')) {
    if (!form) return null;
    const data = await Tax.load();
    const totals = calculateInvoicePayableTotals(
      formLines(form),
      data.profiles,
      Boolean(data.settings.tax_enabled)
    );
    publishInvoicePayableTotal(form, totals, { globalObject });
    return totals;
  }

  function schedule(form) {
    if (timer) globalObject.clearTimeout(timer);
    timer = globalObject.setTimeout(() => {
      timer = null;
      refresh(form).catch(error => console.warn('[Invoice payable total]', error));
    }, 0);
  }

  async function enhance() {
    const form = documentObject.getElementById('invoiceForm');
    if (!form) return;
    if (form.dataset.avanInvoiceTotalBound !== '1') {
      form.dataset.avanInvoiceTotalBound = '1';
      form.addEventListener('input', () => schedule(form), { passive: true });
      form.addEventListener('change', () => schedule(form), { passive: true });
    }
    await refresh(form);
  }

  Lifecycle.use('invoice:payable-total-contract', enhance, { priority: 240 });
  globalObject.addEventListener('avan:company-context-changed', () => {
    Tax.invalidate();
    Lifecycle.schedule('invoice-payable-total-company');
  });

  const api = Object.freeze({
    architecture: 'invoice-payable-total-v1',
    refresh,
    calculate: calculateInvoicePayableTotals
  });
  globalObject.AvanInvoicePayableTotal = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installInvoicePayableTotalContract();
}
