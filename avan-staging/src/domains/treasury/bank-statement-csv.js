'use strict';

import { jalaliToIso } from '../../core/date/jalali.js';

const DIGITS_FA = '۰۱۲۳۴۵۶۷۸۹';
const DIGITS_AR = '٠١٢٣٤٥٦٧٨٩';
const MAX_ROWS = 5000;

const HEADER_ALIASES = Object.freeze({
  date: ['تاریخ','تاریخ تراکنش','تاریخ ثبت','date','booking_date','booking date'],
  valueDate: ['تاریخ موثر','تاریخ مؤثر','value_date','value date'],
  description: ['شرح','توضیحات','description','details','memo'],
  reference: ['شماره پیگیری','شماره مرجع','مرجع','پیگیری','reference','reference_no','reference no','tracking'],
  counterparty: ['طرف حساب','طرف‌حساب','نام طرف','counterparty','party'],
  debit: ['بدهکار','برداشت','مبلغ برداشت','debit','withdrawal'],
  credit: ['بستانکار','واریز','مبلغ واریز','credit','deposit'],
  amount: ['مبلغ','amount'],
  direction: ['نوع','جهت','نوع تراکنش','direction','type'],
  balance: ['مانده','مانده حساب','balance','balance_after','balance after']
});

function latinDigits(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String(DIGITS_FA.indexOf(d)))
    .replace(/[٠-٩]/g, d => String(DIGITS_AR.indexOf(d)));
}

function normalizeHeader(value) {
  return latinDigits(value)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase('fa')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\s_\-]+/g, ' ');
}

function normalizeNumericText(value) {
  let out = latinDigits(value)
    .trim()
    .replace(/[٬,\s]/g, '')
    .replace(/٫/g, '.');
  if (out.startsWith('(') && out.endsWith(')')) out = `-${out.slice(1, -1)}`;
  return out;
}

function decimalParts(value) {
  const raw = normalizeNumericText(value);
  if (!raw) return null;
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  return { sign: match[1] === '-' ? -1 : 1, integer: match[2], fraction: match[3] || '' };
}

function canonicalFromTenths(tenths) {
  const negative = tenths < 0n;
  const abs = negative ? -tenths : tenths;
  const whole = abs / 10n;
  const tenth = abs % 10n;
  return `${negative ? '-' : ''}${whole.toString()}${tenth ? `.${tenth}` : '.0'}`;
}

export function parseBankMoney(value, { sourceUnit = 'toman', allowNegative = false, allowZero = true } = {}) {
  const parts = decimalParts(value);
  if (!parts) return { ok: false, code: 'INVALID_MONEY', canonical: null, tenths: null };
  if (!allowNegative && parts.sign < 0) return { ok: false, code: 'NEGATIVE_MONEY_NOT_ALLOWED', canonical: null, tenths: null };

  let tenths;
  if (sourceUnit === 'rial') {
    if (parts.fraction && !/^0+$/.test(parts.fraction)) return { ok: false, code: 'SUB_RIAL_VALUE', canonical: null, tenths: null };
    tenths = BigInt(parts.integer) * BigInt(parts.sign);
  } else if (sourceUnit === 'toman') {
    if (parts.fraction.length > 1 && !/^0+$/.test(parts.fraction.slice(1))) return { ok: false, code: 'SUB_RIAL_VALUE', canonical: null, tenths: null };
    const tenth = parts.fraction ? Number(parts.fraction[0]) : 0;
    tenths = (BigInt(parts.integer) * 10n + BigInt(tenth)) * BigInt(parts.sign);
  } else {
    return { ok: false, code: 'INVALID_SOURCE_UNIT', canonical: null, tenths: null };
  }

  if (!allowZero && tenths === 0n) return { ok: false, code: 'ZERO_MONEY_NOT_ALLOWED', canonical: null, tenths: null };
  return { ok: true, code: null, canonical: canonicalFromTenths(tenths), tenths: tenths.toString() };
}

export function normalizeBankDate(value) {
  const raw = latinDigits(value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/[.]/g, '/');
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year >= 1700) {
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(`${iso}T12:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
    return iso;
  }
  return jalaliToIso(`${year}/${month}/${day}`) || null;
}

function parseRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i += 1; continue; }
      if (ch === '"') { quoted = false; continue; }
      field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === delimiter) { row.push(field); field = ''; continue; }
    if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
      row = []; field = '';
      continue;
    }
    field += ch;
  }
  if (quoted) throw new Error('CSV_UNCLOSED_QUOTE');
  row.push(field.replace(/\r$/, ''));
  if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
  return rows;
}

function delimiterScore(text, delimiter) {
  try {
    const rows = parseRows(text, delimiter).slice(0, 8);
    if (rows.length < 2) return -1;
    const widths = rows.map(r => r.length);
    const mode = widths.sort((a,b) => widths.filter(x=>x===a).length - widths.filter(x=>x===b).length).at(-1);
    return mode > 1 ? widths.filter(x => x === mode).length * 10 + mode : -1;
  } catch { return -1; }
}

export function detectCsvDelimiter(text) {
  const candidates = [',', ';', '\t'];
  return candidates.map(delimiter => [delimiter, delimiterScore(text, delimiter)])
    .sort((a,b) => b[1] - a[1])[0]?.[0] || ',';
}

export function parseCsvText(text, { delimiter = null } = {}) {
  const chosen = delimiter || detectCsvDelimiter(text);
  const rows = parseRows(text, chosen);
  if (rows.length < 2) throw new Error('CSV_NO_DATA_ROWS');
  const headers = rows[0].map((value, index) => String(value || '').trim() || `ستون ${index + 1}`);
  if (headers.length < 2) throw new Error('CSV_COLUMNS_REQUIRED');
  const dataRows = rows.slice(1).map((values, index) => ({
    sourceLine: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']))
  }));
  if (dataRows.length > MAX_ROWS) throw new Error('CSV_ROW_LIMIT_EXCEEDED');
  return Object.freeze({ delimiter: chosen, headers: Object.freeze(headers), rows: Object.freeze(dataRows) });
}

export function inferBankStatementMapping(headers = []) {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]));
  const mapping = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const hit = aliases.map(normalizeHeader).find(alias => normalized.has(alias));
    mapping[field] = hit ? normalized.get(hit) : '';
  }
  return mapping;
}

function directionFromText(value) {
  const raw = normalizeHeader(value).replace(/\s/g, '');
  if (['credit','deposit','واریز','بستانکار','ورودی','دریافت'].includes(raw)) return 'credit';
  if (['debit','withdrawal','برداشت','بدهکار','خروجی','پرداخت'].includes(raw)) return 'debit';
  return null;
}

function valueFor(row, header) {
  return header ? row.values?.[header] ?? '' : '';
}

function moneyErrorMessage(result) {
  return result?.code === 'SUB_RIAL_VALUE' ? 'مبلغ کمتر از یک ریال مجاز نیست' : 'مبلغ واریز/برداشت معتبر نیست';
}

export function normalizeBankStatementRows(parsed, { mapping = {}, sourceUnit = 'toman' } = {}) {
  const errors = [];
  const normalized = [];
  const hasSplit = Boolean(mapping.debit || mapping.credit);
  const hasCombined = Boolean(mapping.amount && mapping.direction);
  if (!mapping.date) errors.push({ sourceLine: 1, code: 'DATE_COLUMN_REQUIRED', message: 'ستون تاریخ مشخص نشده است.' });
  if (!hasSplit && !hasCombined) errors.push({ sourceLine: 1, code: 'AMOUNT_MAPPING_REQUIRED', message: 'ستون‌های واریز/برداشت یا مبلغ/جهت را مشخص کنید.' });
  if (!['rial','toman'].includes(sourceUnit)) errors.push({ sourceLine: 1, code: 'SOURCE_UNIT_REQUIRED', message: 'واحد فایل باید ریال یا تومان باشد.' });
  if (errors.length) return { rows: [], errors };

  for (const row of parsed?.rows || []) {
    const rowErrors = [];
    const bookingDate = normalizeBankDate(valueFor(row, mapping.date));
    if (!bookingDate) rowErrors.push('تاریخ معتبر نیست');
    const valueDateRaw = valueFor(row, mapping.valueDate);
    const valueDate = String(valueDateRaw).trim() ? normalizeBankDate(valueDateRaw) : null;
    if (String(valueDateRaw).trim() && !valueDate) rowErrors.push('تاریخ مؤثر معتبر نیست');

    let direction = null;
    let amountRaw = '';
    let amount = null;
    if (hasSplit) {
      const debitRaw = valueFor(row, mapping.debit) || '0';
      const creditRaw = valueFor(row, mapping.credit) || '0';
      const debit = parseBankMoney(debitRaw, { sourceUnit, allowZero: true });
      const credit = parseBankMoney(creditRaw, { sourceUnit, allowZero: true });
      if (!debit.ok || !credit.ok) {
        if (!debit.ok) rowErrors.push(moneyErrorMessage(debit));
        if (!credit.ok) rowErrors.push(moneyErrorMessage(credit));
      } else {
        const d = BigInt(debit.tenths); const c = BigInt(credit.tenths);
        if (d > 0n && c === 0n) { direction = 'debit'; amountRaw = debitRaw; amount = debit; }
        else if (c > 0n && d === 0n) { direction = 'credit'; amountRaw = creditRaw; amount = credit; }
        else rowErrors.push('در هر ردیف دقیقاً یکی از واریز یا برداشت باید بیشتر از صفر باشد');
      }
    } else {
      direction = directionFromText(valueFor(row, mapping.direction));
      amountRaw = valueFor(row, mapping.amount);
      if (!direction) rowErrors.push('جهت تراکنش معتبر نیست');
    }

    if (!amount) amount = parseBankMoney(amountRaw, { sourceUnit, allowZero: false });
    if (!amount.ok && !rowErrors.some(message => message.includes('کمتر از یک ریال'))) {
      rowErrors.push(amount.code === 'SUB_RIAL_VALUE' ? 'مبلغ کمتر از یک ریال مجاز نیست' : 'مبلغ معتبر نیست');
    }
    const balanceRaw = valueFor(row, mapping.balance);
    const balance = String(balanceRaw).trim() ? parseBankMoney(balanceRaw, { sourceUnit, allowNegative: true }) : null;
    if (balance && !balance.ok) rowErrors.push(balance.code === 'SUB_RIAL_VALUE' ? 'مانده با دقت کمتر از یک ریال مجاز نیست' : 'مانده معتبر نیست');

    if (rowErrors.length) {
      errors.push({ sourceLine: row.sourceLine, code: 'INVALID_ROW', message: rowErrors.join('؛ ') });
      continue;
    }

    normalized.push({
      line_no: normalized.length + 1,
      source_line: row.sourceLine,
      booking_date: bookingDate,
      value_date: valueDate,
      direction,
      amount: amount.canonical,
      description: String(valueFor(row, mapping.description) || '').trim(),
      reference_no: String(valueFor(row, mapping.reference) || '').trim() || null,
      counterparty: String(valueFor(row, mapping.counterparty) || '').trim() || null,
      balance_after: balance?.canonical ?? null
    });
  }

  return { rows: normalized, errors };
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function attachStatementFingerprints(rows = []) {
  return Promise.all(rows.map(async row => ({
    ...row,
    fingerprint: await sha256Hex(JSON.stringify([
      row.booking_date, row.value_date, row.direction, row.amount,
      row.reference_no || '', row.description || '', row.counterparty || '', row.balance_after || ''
    ]))
  })));
}

export const BANK_STATEMENT_MAX_ROWS = MAX_ROWS;