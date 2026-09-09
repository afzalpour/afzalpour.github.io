'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../../core/money/canonical-money.js';

export function canonicalSettlementAmount(value) {
  const tenths = canonicalDecimalToTenths(value);
  if (tenths === null) return null;
  const canonical = canonicalTenthsToDecimal(tenths);
  if (canonical === null) return null;
  return Object.freeze({ tenths, value: canonical });
}

export function settlementScheduleTotalTenths(rows = []) {
  let totalTenths = 0n;
  for (const row of rows) {
    const parsed = canonicalSettlementAmount(row?.amount ?? row);
    if (!parsed || parsed.tenths <= 0n) return null;
    totalTenths += parsed.tenths;
  }
  return totalTenths;
}

export function validateSettlementPlanTotal(invoiceTotal, rows = []) {
  const invoice = canonicalSettlementAmount(invoiceTotal);
  if (!invoice || invoice.tenths <= 0n) {
    return Object.freeze({
      ok: false,
      code: 'INVALID_INVOICE_TOTAL',
      invoiceTenths: invoice?.tenths ?? null,
      scheduledTenths: null,
      deltaTenths: null
    });
  }

  const scheduledTenths = settlementScheduleTotalTenths(rows);
  if (scheduledTenths === null) {
    return Object.freeze({
      ok: false,
      code: 'INVALID_SETTLEMENT_AMOUNT',
      invoiceTenths: invoice.tenths,
      scheduledTenths: null,
      deltaTenths: null
    });
  }

  const deltaTenths = scheduledTenths - invoice.tenths;
  if (deltaTenths !== 0n) {
    return Object.freeze({
      ok: false,
      code: 'SETTLEMENT_TOTAL_MISMATCH',
      invoiceTenths: invoice.tenths,
      scheduledTenths,
      deltaTenths
    });
  }

  return Object.freeze({
    ok: true,
    code: null,
    invoiceTenths: invoice.tenths,
    scheduledTenths,
    deltaTenths: 0n
  });
}
