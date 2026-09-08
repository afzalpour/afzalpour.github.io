'use strict';

import { refreshAllMoneyInputs } from '../../../rc11-money.js';

const UNIT_RIAL = 'rial';
const MONEY_FIELDS = new Set(['unit_price', 'discount']);
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function latin(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

export function integerText(value) {
  const raw = latin(value).replace(/[٬,\s]/g, '');
  return /^\d+$/.test(raw) ? raw : null;
}

export function canonicalTextForDisplay(value, unit = 'toman') {
  const raw = integerText(value);
  if (raw === null) return null;
  if (unit !== UNIT_RIAL) return raw;

  let amount;
  try { amount = BigInt(raw); }
  catch { return null; }

  if (amount % 10n !== 0n) return null;
  return (amount / 10n).toString();
}

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

    // All target-level invoice/tax calculators now see canonical Toman.
    // For a partial Rial value that is not divisible by 10, expose zero to the
    // calculators instead of accidentally treating the partial Rial as Toman.
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
