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

export function canonicalTextForDisplay(value, unit = 'toman') {
  const raw = integerText(value);
  if (raw === null) return null;
  if (unit !== 'rial') return raw;

  let amount;
  try { amount = BigInt(raw); }
  catch { return null; }

  if (amount % 10n !== 0n) return null;
  return (amount / 10n).toString();
}

export function displayTextFromCanonical(value, unit = 'toman') {
  const raw = integerText(value);
  if (raw === null) return null;
  let amount;
  try { amount = BigInt(raw); }
  catch { return null; }
  return (unit === 'rial' ? amount * 10n : amount).toString();
}
