'use strict';

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

function canonicalTenthText(value) {
  const raw = latin(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  if (!/^\d+(?:\.\d)?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const normalizedWhole = BigInt(whole || '0').toString();
  return fraction ? `${normalizedWhole}.${fraction}` : normalizedWhole;
}

export function canonicalTextForDisplay(value, unit = 'toman') {
  const raw = integerText(value);
  if (raw === null) return null;
  if (unit !== 'rial') return raw;

  let amount;
  try { amount = BigInt(raw); }
  catch { return null; }

  const whole = amount / 10n;
  const rialRemainder = amount % 10n;
  return rialRemainder === 0n ? whole.toString() : `${whole}.${rialRemainder}`;
}

export function displayTextFromCanonical(value, unit = 'toman') {
  const raw = canonicalTenthText(value);
  if (raw === null) return null;
  if (unit !== 'rial') return raw;
  const [whole, fraction = ''] = raw.split('.');
  const tenths = BigInt(whole) * 10n + BigInt(fraction || '0');
  return tenths.toString();
}
