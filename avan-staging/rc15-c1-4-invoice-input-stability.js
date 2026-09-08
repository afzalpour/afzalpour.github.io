'use strict';

import { installUiLifecycle } from './src/ui/runtime/lifecycle.js';

const Lifecycle = installUiLifecycle();
const INVOICE_MONEY_NAMES = new Set(['quantity', 'unit_price', 'discount']);

function isTotalAffectingControl(control) {
  return INVOICE_MONEY_NAMES.has(control?.name) ||
    control?.matches?.('[data-rc15-tax-profile],[data-e-item]');
}

function queueSettlementSync() {
  window.AvanTaxSettlementSync?.queue?.();
}

function bindInvoiceControls(form) {
  if (!form) return;
  form.querySelectorAll('[data-invoice-line] input,[data-invoice-line] select').forEach(control => {
    if (!isTotalAffectingControl(control) || control.dataset.c14InputStable === '1') return;
    control.dataset.c14InputStable = '1';

    const stopLegacyBubble = event => {
      // Direct target listeners (base invoice + VAT) already ran; prevent the
      // legacy form-level Settlement recalculator from becoming a second owner.
      event.stopPropagation();
      queueSettlementSync();
    };
    control.addEventListener('input', stopLegacyBubble);
    control.addEventListener('change', stopLegacyBubble);
  });
}

Lifecycle.use('c1.4:invoice-input-stability', () => {
  bindInvoiceControls(document.getElementById('invoiceForm'));
}, { priority: 20 });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Lifecycle.schedule('c1.4-ready'), { once: true });
} else {
  Lifecycle.schedule('c1.4-ready');
}

export { bindInvoiceControls, isTotalAffectingControl };
