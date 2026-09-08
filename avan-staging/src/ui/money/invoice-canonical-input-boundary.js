'use strict';

import { refreshAllMoneyInputs } from '../../../rc11-money.js';
import { canonicalTextForDisplay } from './currency-contract.js';

const UNIT_RIAL = 'rial';
const MONEY_FIELDS = new Set(['unit_price', 'discount']);

export function isSalesInvoiceForm(form) {
  if (!form?.closest) return false;
  const modal = form.closest('.modal');
  const heading = modal?.querySelector?.('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return /(?:فاکتور|ویرایش)\s+فروش/.test(heading);
}

export function installInvoiceCanonicalInputBoundary({
  globalObject = window,
  documentObject = document
} = {}) {
  if (globalObject.AvanInvoiceCanonicalInputBoundary?.installed) {
    return globalObject.AvanInvoiceCanonicalInputBoundary;
  }

  documentObject.addEventListener('input', event => {
    // Ignore synthetic input events emitted by unit-switching/formatting code.
    // This boundary exists only for a user's live keystroke in a sales invoice.
    if (event.isTrusted === false) return;

    const input = event.target;
    if (!input?.closest || !MONEY_FIELDS.has(input.name)) return;
    const form = input.closest('#invoiceForm');
    if (!form || !isSalesInvoiceForm(form)) return;
    if (globalObject.AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL) return;
    if (input.dataset.avanLiveCanonicalBoundary === '1') return;

    const displayed = input.value;
    const canonical = canonicalTextForDisplay(displayed, UNIT_RIAL);

    input.dataset.avanLiveCanonicalBoundary = '1';
    input.dataset.avanDisplayedRialSnapshot = displayed;
    input.dataset.avanLiveRialValid = canonical === null ? '0' : '1';

    // Target-level invoice and tax calculators must see canonical Toman.
    // A partial Rial value that is not divisible by 10 is exposed as zero so
    // it can never be interpreted accidentally as Toman while the user types.
    input.value = canonical ?? '0';

    globalObject.queueMicrotask(() => {
      if (!input.isConnected || input.dataset.avanLiveCanonicalBoundary !== '1') return;
      const snapshot = input.dataset.avanDisplayedRialSnapshot ?? displayed;
      input.value = snapshot;
      delete input.dataset.avanLiveCanonicalBoundary;
      delete input.dataset.avanDisplayedRialSnapshot;
      refreshAllMoneyInputs(input);
    });
  }, true);

  const api = Object.freeze({
    installed: true,
    canonicalTextForDisplay,
    isSalesInvoiceForm
  });
  globalObject.AvanInvoiceCanonicalInputBoundary = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installInvoiceCanonicalInputBoundary({ globalObject: window, documentObject: document });
}
