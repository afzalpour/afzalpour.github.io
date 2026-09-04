'use strict';

import {
  recognizeLocalDocumentV5
} from './local-ocr-runtime-v5.js';

function faToEn(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeDigits(value) {
  return faToEn(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[—–_]/g, '-');
}

function digitsOnly(value) {
  return normalizeDigits(value).replace(/[^0-9]/g, '');
}

function validDate(year, month, day) {
  const validYear =
    (year >= 1300 && year <= 1599) ||
    (year >= 2000 && year <= 2199);

  return validYear &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31;
}

function dateValue(year, month, day) {
  return validDate(year, month, day)
    ? `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
    : '';
}

function reverseString(value) {
  return String(value ?? '').split('').reverse().join('');
}

function fourDigitYear(value) {
  const text = String(value ?? '');
  if (!/^\d{4}$/.test(text)) return '';

  const direct = Number(text);
  if ((direct >= 1300 && direct <= 1599) || (direct >= 2000 && direct <= 2199)) {
    return text;
  }

  const reversed = reverseString(text);
  const reverseYear = Number(reversed);
  if ((reverseYear >= 1300 && reverseYear <= 1599) || (reverseYear >= 2000 && reverseYear <= 2199)) {
    return reversed;
  }

  return '';
}

function flexibleDateFromText(value) {
  const text = normalizeDigits(value);
  const triplets = text.matchAll(
    /(\d{1,4})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,4})/g
  );

  for (const match of triplets) {
    const a = match[1];
    const b = match[2];
    const c = match[3];

    const firstYear = fourDigitYear(a);
    if (firstYear) {
      const found = dateValue(Number(firstYear), Number(b), Number(c));
      if (found) return found;
    }

    const lastYear = fourDigitYear(c);
    if (lastYear) {
      const found = dateValue(Number(lastYear), Number(b), Number(a));
      if (found) return found;
    }
  }

  const compact = digitsOnly(text);
  for (let index = 0; index <= compact.length - 8; index += 1) {
    const candidate = compact.slice(index, index + 8);
    const variants = [candidate, reverseString(candidate)];

    for (const variant of variants) {
      const year = fourDigitYear(variant.slice(0, 4));
      if (!year) continue;

      const found = dateValue(
        Number(year),
        Number(variant.slice(4, 6)),
        Number(variant.slice(6, 8))
      );
      if (found) return found;
    }
  }

  return '';
}

function groupedAmountCandidates(raw) {
  const normalized = normalizeDigits(raw);
  const digitGroups = normalized
    .split(/[^0-9]+/)
    .filter(Boolean);

  const results = [];

  const add = (digits, score, mode) => {
    if (!/^\d{4,13}$/.test(digits)) return;
    if (/^0+$/.test(digits)) return;

    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value <= 0) return;

    results.push({ digits, value, score, mode });
  };

  const direct = digitsOnly(normalized);
  add(direct, 10, 'direct');

  if (/^00+\d/.test(direct) && /[1-9]$/.test(direct)) {
    add(reverseString(direct), 34, 'rtl-digit-reversal');
  }

  if (digitGroups.length >= 2) {
    const normalGrouping =
      digitGroups[0].length >= 1 && digitGroups[0].length <= 3 &&
      digitGroups.slice(1).every(group => group.length === 3);

    if (normalGrouping) {
      add(digitGroups.join(''), 30, 'grouped-normal');
    }

    const rtlGrouping =
      digitGroups[digitGroups.length - 1].length >= 1 &&
      digitGroups[digitGroups.length - 1].length <= 3 &&
      digitGroups.slice(0, -1).every(group => group.length === 3);

    if (rtlGrouping) {
      add([...digitGroups].reverse().join(''), 42, 'grouped-rtl');
    }
  }

  return results;
}

function recoverAmount(fields) {
  const existing = digitsOnly(fields?.amount_digits || '');
  if (/^\d{4,13}$/.test(existing) && !/^0+$/.test(existing)) {
    return {
      digits: existing,
      confidence: Number(fields?.amount_confidence || 0),
      mode: 'v5-structured'
    };
  }

  const readings = Array.isArray(fields?.debug?.amount_readings)
    ? fields.debug.amount_readings
    : [];

  const map = new Map();

  readings.forEach((reading, readingIndex) => {
    const normalized = normalizeDigits(reading);
    const chunks = normalized.match(
      /\d[\d\s,٬،.]{2,20}\d|\d{4,14}/g
    ) || [];

    chunks.forEach(chunk => {
      groupedAmountCandidates(chunk).forEach(candidate => {
        const current = map.get(candidate.digits) || {
          ...candidate,
          hits: 0,
          readingIndexes: new Set()
        };

        current.hits += 1;
        current.score = Math.max(current.score, candidate.score);
        current.readingIndexes.add(readingIndex);
        map.set(candidate.digits, current);
      });
    });
  });

  const candidates = Array.from(map.values());
  candidates.forEach(candidate => {
    candidate.finalScore =
      candidate.score +
      candidate.hits * 22 +
      candidate.readingIndexes.size * 12 +
      (candidate.value % 10 === 0 ? 6 : 0) +
      (candidate.digits.length >= 5 && candidate.digits.length <= 10 ? 5 : 0);
  });

  candidates.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b.value - a.value;
  });

  const best = candidates[0];
  if (!best) {
    return { digits: '', confidence: 0, mode: '' };
  }

  return {
    digits: best.digits,
    confidence: Math.min(1, .42 + Math.min(.33, best.hits * .09)),
    mode: best.mode
  };
}

function levenshtein(a, b) {
  const left = Array.from(a);
  const right = Array.from(b);
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

function normalizePersian(value) {
  return String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recoverUnit(fields, fullText) {
  if (fields?.amount_unit === 'rial' || fields?.amount_unit === 'toman') {
    return {
      unit: fields.amount_unit,
      confidence: 1,
      mode: 'v5-structured'
    };
  }

  const evidence = normalizePersian([
    fullText,
    ...(Array.isArray(fields?.debug?.amount_readings)
      ? fields.debug.amount_readings
      : [])
  ].join('\n'));

  if (/ریال/i.test(evidence)) {
    return { unit: 'rial', confidence: .96, mode: 'exact-text' };
  }
  if (/تومان/i.test(evidence)) {
    return { unit: 'toman', confidence: .96, mode: 'exact-text' };
  }

  const tokens = evidence.match(/[\u0600-\u06FF]{3,7}/g) || [];
  let bestRial = 99;
  let bestToman = 99;

  for (const token of tokens) {
    bestRial = Math.min(bestRial, levenshtein(token, 'ریال'));
    bestToman = Math.min(bestToman, levenshtein(token, 'تومان'));
  }

  if (bestRial <= 1 && bestRial < bestToman) {
    return { unit: 'rial', confidence: .72, mode: 'fuzzy-text' };
  }
  if (bestToman <= 1 && bestToman < bestRial) {
    return { unit: 'toman', confidence: .72, mode: 'fuzzy-text' };
  }

  return { unit: '', confidence: 0, mode: '' };
}

function recoverDate(fields, fullText) {
  const existing = flexibleDateFromText(fields?.date_text || '');
  if (existing) {
    return {
      date: existing,
      confidence: Number(fields?.date_confidence || 0) || .72,
      mode: 'v5-structured'
    };
  }

  const readings = [
    ...(Array.isArray(fields?.debug?.date_readings)
      ? fields.debug.date_readings
      : []),
    fullText
  ];

  for (const reading of readings) {
    const found = flexibleDateFromText(reading);
    if (found) {
      return {
        date: found,
        confidence: .62,
        mode: 'rtl-flexible-parser'
      };
    }
  }

  return { date: '', confidence: 0, mode: '' };
}

function standardizedReceiptLines(fields) {
  const lines = [];

  if (fields?.amount_digits && (fields.amount_unit === 'rial' || fields.amount_unit === 'toman')) {
    lines.push(
      `مبلغ ${fields.amount_digits} ${fields.amount_unit === 'rial' ? 'ریال' : 'تومان'}`
    );
  }

  if (fields?.date_text) {
    lines.push(`تاریخ ${fields.date_text}`);
  }

  if (fields?.reference) {
    lines.push(`پیگیری/مرجع ${fields.reference}`);
  }

  if (fields?.success) {
    lines.push('عملیات موفق');
  }

  return lines.join('\n');
}

export async function recognizeLocalDocumentV6(options = {}) {
  const base = await recognizeLocalDocumentV5(options);
  const type = String(options.documentType || '');
  const isReceiptImage =
    String(options.mimeType || '').startsWith('image/') &&
    (type === 'receipt' || type === 'bank_slip');

  if (!isReceiptImage) return base;

  const originalFields =
    base?.receipt_fields && typeof base.receipt_fields === 'object'
      ? base.receipt_fields
      : {};

  const amount = recoverAmount(originalFields);
  const unit = recoverUnit(originalFields, String(base?.text || ''));
  const date = recoverDate(originalFields, String(base?.text || ''));

  const fields = {
    ...originalFields,
    amount_digits: amount.digits || originalFields.amount_digits || '',
    amount_unit: unit.unit || originalFields.amount_unit || '',
    amount_confidence: amount.digits
      ? Math.max(Number(originalFields.amount_confidence || 0), amount.confidence)
      : Number(originalFields.amount_confidence || 0),
    date_text: date.date || originalFields.date_text || '',
    date_confidence: date.date
      ? Math.max(Number(originalFields.date_confidence || 0), date.confidence)
      : Number(originalFields.date_confidence || 0),
    amount_unit_confidence: unit.confidence,
    recovery: {
      amount: amount.mode,
      unit: unit.mode,
      date: date.mode
    }
  };

  const standardText = standardizedReceiptLines(fields);
  const text = [
    String(base?.text || '').trim(),
    standardText
  ].filter(Boolean).join('\n');

  const criticalText = [
    standardText,
    String(base?.critical_text || '').trim()
  ].filter(Boolean).join('\n');

  return {
    ...base,
    text,
    critical_text: criticalText,
    critical: {
      ...(base?.critical || {}),
      amount_text: fields.amount_digits && fields.amount_unit
        ? `مبلغ ${fields.amount_digits} ${fields.amount_unit === 'rial' ? 'ریال' : 'تومان'}`
        : String(base?.critical?.amount_text || ''),
      date_text: fields.date_text
        ? `تاریخ ${fields.date_text}`
        : String(base?.critical?.date_text || ''),
      amount_confidence: fields.amount_confidence || Number(base?.critical?.amount_confidence || 0),
      date_confidence: fields.date_confidence || Number(base?.critical?.date_confidence || 0)
    },
    receipt_fields: fields,
    receipt_pipeline: {
      ...(base?.receipt_pipeline || {}),
      version: 'v6-rtl-structured-handoff',
      rtl_date_recovery: true,
      rtl_amount_group_recovery: true,
      fuzzy_unit_recovery: true,
      human_review_required: true
    },
    engine: 'tesseract-receipt-rtl-v6'
  };
}
