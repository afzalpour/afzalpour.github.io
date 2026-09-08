'use strict';

import { refreshAllMoneyInputs } from '../../../rc11-money.js';
import { canonicalTextForDisplay } from './currency-contract.js';

const UNIT_RIAL = 'rial';
const MONEY_FIELDS = new Set(['unit_price', 'discount']);

export function isInvoiceForm(form) {
  if (!form?.closest || form.id !== 'invoiceForm') return false;
  const modal = form.closest('.modal');
  const heading = modal?.querySelector?.('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return /(?:فاکتور|ویرایش)\s+(?:فروش|خرید)/.test(heading) || ['sale', 'purchase'].includes(form.dataset?.rc14InvoiceType);
}

function exposeOne(input, globalObject) {
  if (!input || input.dataset.avanLiveCanonicalBoundary === '1') return null;
  const displayed = input.value;
  const canonical = canonicalTextForDisplay(displayed, UNIT_RIAL);
  input.dataset.avanLiveCanonicalBoundary = '1';
  input.dataset.avanDisplayedRialSnapshot = displayed;
  input.dataset.avanLiveRialValid = canonical === null ? '0' : '1';
  input.dataset.avanCanonicalToman = canonical ?? '';
  input.value = canonical ?? '0';
  return { input, displayed };
}

function restoreSnapshots(snapshots) {
  snapshots.forEach(({ input, displayed }) => {
    if (!input.isConnected || input.dataset.avanLiveCanonicalBoundary !== '1') return;
    input.value = input.dataset.avanDisplayedRialSnapshot ?? displayed;
    input.dataset.currencyPreparedUnit = UNIT_RIAL;
    delete input.dataset.avanLiveCanonicalBoundary;
    delete input.dataset.avanDisplayedRialSnapshot;
    refreshAllMoneyInputs(input);
  });
}

function exposeRowMoney(row, globalObject) {
  if (globalObject.AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL || !row) return [];
  return [...row.querySelectorAll('[name="unit_price"],[name="discount"]')]
    .map(input => exposeOne(input, globalObject))
    .filter(Boolean);
}

export function installInvoiceCanonicalInputBoundary({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanInvoiceCanonicalInputBoundary?.installed) return globalObject.AvanInvoiceCanonicalInputBoundary;

  const handleMoney = event => {
    const input = event.target;
    if (!input?.closest || !MONEY_FIELDS.has(input.name)) return;
    const form = input.closest('#invoiceForm');
    if (!form || !isInvoiceForm(form) || globalObject.AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL) return;
    const snapshot = exposeOne(input, globalObject);
    if (snapshot) globalObject.queueMicrotask(() => restoreSnapshots([snapshot]));
  };

  const handleStructuralChange = event => {
    const control = event.target;
    const form = control?.closest?.('#invoiceForm');
    if (!form || !isInvoiceForm(form) || globalObject.AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL) return;
    const row = control.closest?.('[data-invoice-line]');
    if (!row) return;

    // Tax-profile listeners run synchronously on the same change event. Expose
    // canonical values for the whole row so VAT never reinterprets Rial as Toman.
    if (control.matches?.('[data-rc15-tax-profile]')) {
      const snapshots = exposeRowMoney(row, globalObject);
      if (snapshots.length) globalObject.queueMicrotask(() => restoreSnapshots(snapshots));
      return;
    }

    // Item selection refreshes its tax profile in a setTimeout(0). Re-run the
    // existing tax input listener once, while the row is explicitly canonical.
    if (control.matches?.('[data-e-item]')) {
      globalObject.setTimeout(() => {
        if (!row.isConnected) return;
        const snapshots = exposeRowMoney(row, globalObject);
        const price = row.querySelector('[name="unit_price"]');
        if (price) price.dispatchEvent(new Event('input', { bubbles: true }));
        if (snapshots.length) globalObject.queueMicrotask(() => restoreSnapshots(snapshots));
      }, 0);
    }
  };

  documentObject.addEventListener('input', handleMoney, true);
  documentObject.addEventListener('change', handleMoney, true);
  documentObject.addEventListener('change', handleStructuralChange, true);

  const api = Object.freeze({ installed: true, canonicalTextForDisplay, isInvoiceForm });
  globalObject.AvanInvoiceCanonicalInputBoundary = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installInvoiceCanonicalInputBoundary({ globalObject: window, documentObject: document });
