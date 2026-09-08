'use strict';

export const UNIT_TOMAN = 'toman';
export const UNIT_RIAL = 'rial';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeUnit(unit) {
  return unit === UNIT_RIAL ? UNIT_RIAL : UNIT_TOMAN;
}

export function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, digit => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)));
}

export function integerFromText(value) {
  const raw = latinDigits(value).replace(/[٬,\s]/g, '').replace(/[^0-9-]/g, '');
  if (!raw || raw === '-') return null;
  try { return BigInt(raw); } catch { return null; }
}

export function decimalMicros(value) {
  const raw = latinDigits(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  if (!/^\d+(?:\.\d{0,6})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole || '0') * 1000000n + BigInt((fraction + '000000').slice(0, 6));
}

export function displayToCanonical(value, unit = UNIT_TOMAN) {
  const amount = typeof value === 'bigint' ? value : integerFromText(value);
  if (amount === null) return { ok: false, value: null, code: 'INVALID_AMOUNT' };
  if (normalizeUnit(unit) === UNIT_TOMAN) return { ok: true, value: amount, code: null };
  if (amount % 10n !== 0n) {
    return {
      ok: false,
      value: null,
      code: 'RIAL_NOT_DIVISIBLE_BY_10',
      message: 'مبلغ ریالی باید مضرب ۱۰ باشد.'
    };
  }
  return { ok: true, value: amount / 10n, code: null };
}

export function canonicalToDisplay(value, unit = UNIT_TOMAN) {
  const canonical = typeof value === 'bigint' ? value : integerFromText(value);
  if (canonical === null) return null;
  return normalizeUnit(unit) === UNIT_RIAL ? canonical * 10n : canonical;
}

export function groupInteger(value) {
  let amount = typeof value === 'bigint' ? value : BigInt(value || 0);
  const sign = amount < 0n ? '−' : '';
  if (amount < 0n) amount = -amount;
  return sign + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

export function unitLabel(unit = UNIT_TOMAN) {
  return normalizeUnit(unit) === UNIT_RIAL ? 'ریال' : 'تومان';
}

export function formatCanonical(value, unit = UNIT_TOMAN) {
  const displayed = canonicalToDisplay(value, unit);
  if (displayed === null) return '—';
  return `${groupInteger(displayed)} ${unitLabel(unit)}`;
}

export function lineCanonicalAmount({ quantity, unitPrice, discount = '0', unit = UNIT_TOMAN }) {
  const q = decimalMicros(quantity);
  const p = displayToCanonical(unitPrice, unit);
  const d = displayToCanonical(discount || '0', unit);
  if (q === null || !p.ok || !d.ok) {
    return {
      ok: false,
      value: null,
      code: !p.ok ? p.code : !d.ok ? d.code : 'INVALID_QUANTITY'
    };
  }
  const gross = (q * p.value + 500000n) / 1000000n;
  const value = gross > d.value ? gross - d.value : 0n;
  return { ok: true, value, code: null };
}
