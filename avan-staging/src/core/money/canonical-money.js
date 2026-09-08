'use strict';

export const UNIT_TOMAN = 'toman';
export const UNIT_RIAL = 'rial';
export const MONEY_UNITS = Object.freeze([UNIT_TOMAN, UNIT_RIAL]);

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const QUANTITY_SCALE = 1000000n;
const DECIMAL_MONEY_SCALE = 1000000n;
const RIAL_PER_TOMAN = 10n;

const ONES = [
  '', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه',
  'ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده',
  'هفده', 'هجده', 'نوزده'
];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'کوادریلیون', 'کوینتیلیون', 'سکستیلیون'];

export function normalizeUnitOrNull(unit) {
  return MONEY_UNITS.includes(unit) ? unit : null;
}

export function normalizeUnit(unit) {
  return normalizeUnitOrNull(unit) || UNIT_TOMAN;
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
  return BigInt(whole || '0') * QUANTITY_SCALE + BigInt((fraction + '000000').slice(0, 6));
}

export function signedDecimalMoneyMicros(value) {
  const raw = latinDigits(value)
    .trim()
    .replace(/[٬\s]/g, '')
    .replace(/٫|,/g, '.');
  if (!/^-?\d+(?:\.\d{0,6})?$/.test(raw)) return null;
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  let micros = BigInt(whole || '0') * DECIMAL_MONEY_SCALE + BigInt((fraction + '000000').slice(0, 6));
  if (negative) micros = -micros;
  return micros;
}

function decimalMicrosToPlainString(micros, { trim = true } = {}) {
  let amount = typeof micros === 'bigint' ? micros : BigInt(micros || 0);
  const sign = amount < 0n ? '-' : '';
  if (amount < 0n) amount = -amount;
  const whole = amount / DECIMAL_MONEY_SCALE;
  let fraction = (amount % DECIMAL_MONEY_SCALE).toString().padStart(6, '0');
  if (trim) fraction = fraction.replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function displayDecimalToCanonical(value, unit = UNIT_TOMAN) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  if (!normalizedUnit) return { ok: false, value: null, code: 'MONEY_UNIT_NOT_READY' };
  const displayMicros = signedDecimalMoneyMicros(value);
  if (displayMicros === null) return { ok: false, value: null, code: 'INVALID_DECIMAL_AMOUNT' };
  if (normalizedUnit === UNIT_TOMAN) {
    return { ok: true, value: decimalMicrosToPlainString(displayMicros), micros: displayMicros, code: null };
  }
  if (displayMicros % RIAL_PER_TOMAN !== 0n) {
    return {
      ok: false,
      value: null,
      micros: null,
      code: 'RIAL_DECIMAL_PRECISION_EXCEEDED',
      message: 'مبلغ ریالی با دقت فعلی بهای واحد قابل تبدیل دقیق به تومان نیست.'
    };
  }
  const canonicalMicros = displayMicros / RIAL_PER_TOMAN;
  return { ok: true, value: decimalMicrosToPlainString(canonicalMicros), micros: canonicalMicros, code: null };
}

export function canonicalDecimalToDisplay(value, unit = UNIT_TOMAN) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  if (!normalizedUnit) return null;
  const canonicalMicros = signedDecimalMoneyMicros(value);
  if (canonicalMicros === null) return null;
  const displayMicros = normalizedUnit === UNIT_RIAL
    ? canonicalMicros * RIAL_PER_TOMAN
    : canonicalMicros;
  return decimalMicrosToPlainString(displayMicros);
}

function groupedDecimalString(value) {
  const raw = String(value ?? '');
  const sign = raw.startsWith('-') ? '−' : '';
  const unsigned = raw.startsWith('-') ? raw.slice(1) : raw;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return `${sign}${groupedWhole}${fraction ? `٫${fraction}` : ''}`;
}

export function formatCanonicalDecimal(value, unit = UNIT_TOMAN, { withUnit = true } = {}) {
  const display = canonicalDecimalToDisplay(value, unit);
  if (display === null) return '—';
  const formatted = groupedDecimalString(display);
  return withUnit ? `${formatted} ${unitLabel(unit)}` : formatted;
}

export function displayToCanonical(value, unit = UNIT_TOMAN) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  if (!normalizedUnit) return { ok: false, value: null, code: 'MONEY_UNIT_NOT_READY' };
  const amount = typeof value === 'bigint' ? value : integerFromText(value);
  if (amount === null) return { ok: false, value: null, code: 'INVALID_AMOUNT' };
  if (normalizedUnit === UNIT_TOMAN) return { ok: true, value: amount, code: null };
  if (amount % RIAL_PER_TOMAN !== 0n) {
    return {
      ok: false,
      value: null,
      code: 'RIAL_NOT_DIVISIBLE_BY_10',
      message: 'مبلغ ریالی باید مضرب ۱۰ باشد.'
    };
  }
  return { ok: true, value: amount / RIAL_PER_TOMAN, code: null };
}

export function canonicalToDisplay(value, unit = UNIT_TOMAN) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  if (!normalizedUnit) return null;
  const canonical = typeof value === 'bigint' ? value : integerFromText(value);
  if (canonical === null) return null;
  return normalizedUnit === UNIT_RIAL ? canonical * RIAL_PER_TOMAN : canonical;
}

export function groupInteger(value) {
  let amount;
  try { amount = typeof value === 'bigint' ? value : BigInt(value ?? 0); }
  catch { return ''; }
  const sign = amount < 0n ? '−' : '';
  if (amount < 0n) amount = -amount;
  return sign + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
}

export function unitLabel(unit = UNIT_TOMAN) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  if (!normalizedUnit) return '';
  return normalizedUnit === UNIT_RIAL ? 'ریال' : 'تومان';
}

export function formatCanonical(value, unit = UNIT_TOMAN, { withUnit = true } = {}) {
  const displayed = canonicalToDisplay(value, unit);
  if (displayed === null) return '—';
  const grouped = groupInteger(displayed);
  return withUnit ? `${grouped} ${unitLabel(unit)}` : grouped;
}

export function formatDisplay(value, unit = UNIT_TOMAN, { withUnit = false } = {}) {
  const amount = typeof value === 'bigint' ? value : integerFromText(value);
  if (amount === null) return '';
  const grouped = groupInteger(amount);
  return withUnit ? `${grouped} ${unitLabel(unit)}` : grouped;
}

function tripletToWords(number) {
  const n = Number(number);
  if (!n) return '';
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (remainder) {
    if (remainder < 20) parts.push(ONES[remainder]);
    else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(TENS[tens]);
      if (ones) parts.push(ONES[ones]);
    }
  }
  return parts.join(' و ');
}

export function integerToPersianWords(value) {
  let amount = typeof value === 'bigint' ? value : integerFromText(value);
  if (amount === null) return '';
  if (amount === 0n) return 'صفر';
  const negative = amount < 0n;
  if (negative) amount = -amount;
  const chunks = [];
  let scaleIndex = 0;
  while (amount > 0n) {
    const chunk = Number(amount % 1000n);
    if (chunk) {
      if (scaleIndex >= SCALES.length) return '';
      const words = tripletToWords(chunk);
      const scale = SCALES[scaleIndex];
      chunks.unshift(scale ? `${words} ${scale}` : words);
    }
    amount /= 1000n;
    scaleIndex += 1;
  }
  const phrase = chunks.join(' و ');
  return negative ? `منفی ${phrase}` : phrase;
}

export function displayAmountInWords(value, unit) {
  const normalizedUnit = normalizeUnitOrNull(unit);
  const amount = typeof value === 'bigint' ? value : integerFromText(value);
  if (!normalizedUnit || amount === null) return '';
  const words = integerToPersianWords(amount);
  return words ? `${words} ${unitLabel(normalizedUnit)}` : '';
}

export function canonicalAmountInWords(value, unit) {
  const displayed = canonicalToDisplay(value, unit);
  return displayed === null ? '' : displayAmountInWords(displayed, unit);
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
  const gross = (q * p.value + QUANTITY_SCALE / 2n) / QUANTITY_SCALE;
  if (d.value > gross) return { ok: false, value: null, code: 'DISCOUNT_EXCEEDS_GROSS' };
  return { ok: true, value: gross - d.value, code: null };
}
