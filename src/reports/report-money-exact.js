'use strict';

import {
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal
} from '../core/money/canonical-money.js';

export function reportMoneyTenths(value, field = 'amount') {
  const tenths = canonicalDecimalToTenths(String(value ?? '0'));
  if (tenths === null) {
    throw new Error(`REPORT_INVALID_CANONICAL_MONEY:${field}`);
  }
  return tenths;
}

export function reportMoneyDecimal(tenths, field = 'amount') {
  const value = canonicalTenthsToDecimal(tenths);
  if (value === null) {
    throw new Error(`REPORT_INVALID_CANONICAL_TENTHS:${field}`);
  }
  return value;
}

export function sumReportMoneyTenths(values = [], field = 'amount') {
  return values.reduce(
    (sum, value, index) => sum + reportMoneyTenths(value, `${field}:${index}`),
    0n
  );
}

export function reportMoneyCategoryTenths(rows = [], field = 'amount') {
  return Object.fromEntries(
    rows.map(row => [
      row.category,
      reportMoneyTenths(row?.[field], `${field}:${row.category || 'unknown'}`)
    ])
  );
}

export const EXACT_REPORT_MONEY_CONTRACT = Object.freeze({
  canonicalUnit: 'toman',
  scale: 'one-rial',
  oneRialExact: true,
  rounding: 'none'
});
