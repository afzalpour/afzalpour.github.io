'use strict';

import { installUiLifecycle } from '../runtime/lifecycle.js';

const UNIT_TOMAN = 'toman';
const UNIT_RIAL = 'rial';
const UNIT_LABEL = Object.freeze({ toman: 'تومان', rial: 'ریال' });

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
  let amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  const sign = amount < 0n ? '−' : '';
  if (amount < 0n) amount = -amount;
  return sign + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

export function normalizeUnit(unit) {
  return unit === UNIT_RIAL ? UNIT_RIAL : UNIT_TOMAN;
}

export function displayFromCanonical(value, unit = UNIT_TOMAN) {
  const canonical = typeof value === 'bigint' ? value : BigInt(value || 0);
  return normalizeUnit(unit) === UNIT_RIAL ? canonical * 10n : canonical;
}

export function canonicalFromDisplay(value, unit = UNIT_TOMAN) {
  const displayed = typeof value === 'bigint' ? value : integerFromText(value);
  if (displayed === null) return null;
  if (normalizeUnit(unit) === UNIT_TOMAN) return displayed;
  return displayed % 10n === 0n ? displayed / 10n : null;
}

export function canonicalFromMoneyText(value, fallbackUnit = UNIT_TOMAN) {
  const text = String(value ?? '');
  const amount = integerFromText(text);
  if (amount === null) return null;
  if (text.includes(UNIT_LABEL[UNIT_RIAL])) return canonicalFromDisplay(amount, UNIT_RIAL);
  if (text.includes(UNIT_LABEL[UNIT_TOMAN])) return amount;
  return canonicalFromDisplay(amount, fallbackUnit);
}

export function formatCanonicalMoney(value, unit = UNIT_TOMAN) {
  const normalized = normalizeUnit(unit);
  return `${groupInteger(displayFromCanonical(value, normalized))} ${UNIT_LABEL[normalized]}`;
}

function currentUnit(globalObject = globalThis) {
  return normalizeUnit(globalObject?.AVAN_MONEY_DISPLAY_UNIT);
}

export function finalInvoiceTotal(form, unit = UNIT_TOMAN) {
  // The tax summary is the freshest pre-save total. It is presentation text,
  // so convert it back to canonical Toman exactly once before using it.
  const taxGrand = canonicalFromMoneyText(
    form?.querySelector?.('[data-rc15-invoice-tax-summary] .rc15-grand b')?.textContent,
    unit
  );
  if (taxGrand !== null) return taxGrand;

  // Persisted/contracted totals are always canonical Toman.
  const contractedCanonical = integerFromText(
    form?.dataset?.avanCanonicalInvoiceTotalToman || form?.dataset?.avanInvoiceTotal || ''
  );
  if (contractedCanonical !== null) return contractedCanonical;

  return canonicalFromMoneyText(
    form?.querySelector?.('.invoice-grand-total')?.textContent || '',
    unit
  );
}

function plannedRowsTotal(box, unit) {
  let total = 0n;
  box.querySelectorAll('[name="v60_amount"]').forEach(input => {
    const inputUnit = normalizeUnit(input.dataset?.currencyPreparedUnit || unit);
    total += canonicalFromDisplay(input.value, inputUnit) ?? 0n;
  });
  return total;
}

function setFixedAmount(input, canonical, unit) {
  const displayed = groupInteger(displayFromCanonical(canonical, unit));
  if (input.value !== displayed) input.value = displayed;
  input.dataset.currencyPreparedUnit = unit;
  input.dataset.moneyCanonicalToman = canonical.toString();
}

export function syncTaxSettlementTotal(documentObject, globalObject = globalThis) {
  const form = documentObject?.getElementById?.('invoiceForm');
  const box = form?.querySelector('[data-v60-settlement-box]');
  if (!form || !box) return false;

  const unit = currentUnit(globalObject);
  const total = finalInvoiceTotal(form, unit);
  if (total === null || total < 0n) return false;

  // Both contracts are canonical Toman. Never store rendered Rial here.
  form.dataset.avanInvoiceTotal = total.toString();
  form.dataset.avanCanonicalInvoiceTotalToman = total.toString();

  box.querySelectorAll('[data-v60-fixed-amount]').forEach(input => {
    setFixedAmount(input, total, unit);
  });

  const planType = box.querySelector('[name="v60_plan_type"]')?.value || 'credit';
  const scheduled = ['credit', 'cash', 'check'].includes(planType)
    ? total
    : plannedRowsTotal(box, unit);

  const totalNode = box.querySelector('[data-v60-plan-total]');
  if (totalNode) {
    const matches = scheduled === total;
    const desired = `جمع برنامه: <b>${formatCanonicalMoney(scheduled, unit)}</b> از <b>${formatCanonicalMoney(total, unit)}</b> ${matches ? '<span class="pos">✓ برابر</span>' : '<span class="neg">مغایرت</span>'}`;
    if (totalNode.innerHTML !== desired) totalNode.innerHTML = desired;
    totalNode.dataset.moneyUnit = unit;
    totalNode.dataset.scheduledCanonicalToman = scheduled.toString();
    totalNode.dataset.totalCanonicalToman = total.toString();
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
      syncTaxSettlementTotal(documentObject, globalObject);
    });
  };

  Lifecycle.use('settlement:tax-final-total-sync', () => syncTaxSettlementTotal(documentObject, globalObject), { priority: 900 });
  documentObject.addEventListener('input', event => {
    if (event.target?.closest?.('#invoiceForm')) queueSync();
  }, true);
  documentObject.addEventListener('change', event => {
    if (event.target?.closest?.('#invoiceForm')) queueSync();
  }, true);
  documentObject.addEventListener('avan:money-unit-changed', queueSync);

  const api = Object.freeze({
    installed: true,
    sync: () => syncTaxSettlementTotal(documentObject, globalObject)
  });
  globalObject.AvanTaxSettlementSync = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installTaxSettlementSync({ globalObject: window, documentObject: document });
}
