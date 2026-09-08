'use strict';

import { installUiLifecycle } from './src/ui/runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();
const INVOICE_MONEY_NAMES = new Set(['quantity', 'unit_price', 'discount']);

function queueSettlementSync() {
  queueMicrotask(() => window.AvanTaxSettlementSync?.sync?.());
}

function bindInvoiceMoneyInputs(form) {
  if (!form) return;

  form.querySelectorAll('[data-invoice-line] input').forEach(input => {
    if (!INVOICE_MONEY_NAMES.has(input.name) || input.dataset.c14InputStable === '1') return;
    input.dataset.c14InputStable = '1';

    const stopLegacyBubble = event => {
      // Target/capture handlers still run. Only legacy form-level settlement
      // recalculation is blocked; the single canonical sync runs afterwards.
      event.stopPropagation();
      queueSettlementSync();
    };

    input.addEventListener('input', stopLegacyBubble);
    input.addEventListener('change', stopLegacyBubble);
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

export { bindInvoiceMoneyInputs };
