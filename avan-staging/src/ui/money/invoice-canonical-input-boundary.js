'use strict';

import { refreshAllMoneyInputs } from '../../../rc11-money.js';
import { canonicalTextForDisplay } from './currency-contract.js';

const UNIT_RIAL = 'rial';
const MONEY_FIELDS = new Set(['unit_price', 'discount']);

export function isInvoiceForm(form) {
  if (!form?.closest) return false;
  if (form.id !== 'invoiceForm') return false;
  const modal = form.closest('.modal');
  const heading = modal?.querySelector?.('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return /(?:فاکتور|ویرایش)\s+(?:فروش|خرید)/.test(heading) || ['sale', 'purchase'].includes(form.dataset?.rc14InvoiceType);
}

function exposeCanonicalDuringEvent(input, globalObject) {
  if (globalObject.AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL) return false;
  if (input.dataset.avanLiveCanonicalBoundary === '1') return false;

  const displayed = input.value;
  const canonical = canonicalTextForDisplay(displayed, UNIT_RIAL);
  input.dataset.avanLiveCanonicalBoundary = '1';
  input.dataset.avanDisplayedRialSnapshot = displayed;
  input.dataset.avanLiveRialValid = canonical === null ? '0' : '1';
  input.dataset.avanCanonicalToman = canonical ?? '';
  input.value = canonical ?? '0';

  globalObject.queueMicrotask(() => {
    if (!input.isConnected || input.dataset.avanLiveCanonicalBoundary !== '1') return;
    input.value = input.dataset.avanDisplayedRialSnapshot ?? displayed;
    input.dataset.currencyPreparedUnit = UNIT_RIAL;
    delete input.dataset.avanLiveCanonicalBoundary;
    delete input.dataset.avanDisplayedRialSnapshot;
    refreshAllMoneyInputs(input);
  });
  return true;
}

export function installInvoiceCanonicalInputBoundary({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanInvoiceCanonicalInputBoundary?.installed) return globalObject.AvanInvoiceCanonicalInputBoundary;

  const handle = event => {
    if (event.isTrusted === false) return;
    const input = event.target;
    if (!input?.closest || !MONEY_FIELDS.has(input.name)) return;
    const form = input.closest('#invoiceForm');
    if (!form || !isInvoiceForm(form)) return;
    exposeCanonicalDuringEvent(input, globalObject);
  };

  documentObject.addEventListener('input', handle, true);
  documentObject.addEventListener('change', handle, true);

  const api = Object.freeze({ installed: true, canonicalTextForDisplay, isInvoiceForm });
  globalObject.AvanInvoiceCanonicalInputBoundary = api;
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installInvoiceCanonicalInputBoundary({ globalObject: window, documentObject: document });
}
