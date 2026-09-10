'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();

export function invoiceRowIsUsed(row) {
  if (!row?.querySelector) return false;
  return Boolean(
    row.querySelector('[name="account"]')?.value ||
    row.querySelector('[name="description"]')?.value?.trim() ||
    row.querySelector('[name="unit_price"]')?.value?.trim()
  );
}

function displayMoney(row, name, fallback = '0') {
  const raw = String(row?.querySelector?.(`[name="${name}"]`)?.value ?? '').trim();
  return raw || fallback;
}

export function restoreInvoiceDisplayMoney(payload, documentObject = document) {
  if (!payload || !Array.isArray(payload.p_lines)) return payload;
  const form = documentObject?.getElementById?.('invoiceForm');
  if (!form) return payload;

  const rows = [...form.querySelectorAll('[data-invoice-line]')].filter(invoiceRowIsUsed);
  return {
    ...payload,
    p_lines: payload.p_lines.map((line, index) => {
      const row = rows[index];
      if (!row) return line;
      return {
        ...line,
        unit_price: displayMoney(row, 'unit_price', String(line.unit_price ?? '0')),
        discount: displayMoney(row, 'discount', '0')
      };
    })
  };
}

if (!C.operations.has('rpc', 'invoice.base-save-display-money')) {
  C.operations.use('rpc', 'invoice.base-save-display-money', ({ args, next }) => {
    const [name, payload = {}] = args;
    if (name !== 'save_draft_invoice') return next(name, payload);
    return next(name, restoreInvoiceDisplayMoney(payload));
  }, { priority: 125 });
}
