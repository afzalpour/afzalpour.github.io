'use strict';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const QUANTITY_SCALE = 1000000n;
const RATE_SCALE = 10000n;

export function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

export function parseIntegerMoney(value) {
  const normalized = latinDigits(value).replace(/[٬,\s]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  return BigInt(normalized);
}

export function parseQuantityMicros(value) {
  const normalized = latinDigits(value)
    .trim()
    .replace(/٫|,/g, '.')
    .replace(/\s/g, '');
  if (!/^\d+(?:\.\d{0,6})?$/.test(normalized)) return null;
  const [integer, fraction = ''] = normalized.split('.');
  return BigInt(integer || '0') * QUANTITY_SCALE +
    BigInt((fraction + '000000').slice(0, 6));
}

export function parseRateUnits(value) {
  const normalized = latinDigits(value).trim().replace(/٫|,/g, '.');
  const [integer, fraction = ''] = normalized.split('.');
  if (!/^\d+$/.test(integer) || !/^\d{0,4}$/.test(fraction)) return null;
  return BigInt(integer) * RATE_SCALE + BigInt((fraction + '0000').slice(0, 4));
}

export function calculateTaxableAmount({ quantity, unitPrice, discount = 0 }) {
  const quantityMicros = typeof quantity === 'bigint' ? quantity : parseQuantityMicros(quantity);
  const price = typeof unitPrice === 'bigint' ? unitPrice : parseIntegerMoney(unitPrice);
  const discountAmount = typeof discount === 'bigint' ? discount : parseIntegerMoney(discount);
  if (quantityMicros === null || price === null || discountAmount === null) return null;

  const gross = (quantityMicros * price + QUANTITY_SCALE / 2n) / QUANTITY_SCALE;
  return gross > discountAmount ? gross - discountAmount : 0n;
}

export function calculateVatAmount({ taxableAmount, rate }) {
  const base = typeof taxableAmount === 'bigint'
    ? taxableAmount
    : parseIntegerMoney(taxableAmount);
  const rateUnits = typeof rate === 'bigint' ? rate : parseRateUnits(rate);
  if (base === null || rateUnits === null) return null;
  return (base * rateUnits + RATE_SCALE / 2n) / RATE_SCALE;
}

export function calculateVatLine({ quantity, unitPrice, discount = 0, rate = 0 }) {
  const taxableAmount = calculateTaxableAmount({ quantity, unitPrice, discount });
  if (taxableAmount === null) return null;
  const taxAmount = calculateVatAmount({ taxableAmount, rate });
  if (taxAmount === null) return null;
  return Object.freeze({
    taxableAmount,
    taxAmount,
    totalAmount: taxableAmount + taxAmount
  });
}

export function aggregateVatLines(lines) {
  return Object.freeze((lines || []).reduce((total, line) => {
    total.taxableAmount += BigInt(line?.taxableAmount ?? 0);
    total.taxAmount += BigInt(line?.taxAmount ?? 0);
    total.totalAmount += BigInt(line?.totalAmount ?? 0);
    return total;
  }, { taxableAmount: 0n, taxAmount: 0n, totalAmount: 0n }));
}
