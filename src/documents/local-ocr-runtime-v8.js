'use strict';

import {
  recognizeLocalDocumentV7
} from './local-ocr-runtime-v7.js';

function faToEn(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalize(value) {
  return faToEn(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[—–_]/g, '-');
}

function validDate(y, m, d) {
  const yearOk =
    (y >= 1300 && y <= 1600) ||
    (y >= 1900 && y <= 2200);
  return yearOk && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function dateCandidates(value) {
  const text = normalize(value);
  const output = [];
  const add = (y, m, d, source) => {
    y = Number(y);
    m = Number(m);
    d = Number(d);
    if (!validDate(y, m, d)) return;
    const date = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    if (!output.some(item => item.date === date)) {
      output.push({
        date,
        year: y,
        source,
        score:
          (y >= 1300 && y <= 1600 ? 100 : 55) +
          (source === 'separated' ? 30 : 0)
      });
    }
  };

  for (const match of text.matchAll(
    /(1[3-6]\d{2}|19\d{2}|20\d{2}|21\d{2})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,2})/g
  )) {
    add(match[1], match[2], match[3], 'separated');
  }

  for (const match of text.matchAll(
    /(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(1[3-6]\d{2}|19\d{2}|20\d{2}|21\d{2})/g
  )) {
    add(match[3], match[2], match[1], 'separated-rtl');
  }

  const digits = text.replace(/[^0-9]/g, '');
  for (let i = 0; i <= digits.length - 8; i += 1) {
    const c = digits.slice(i, i + 8);
    add(c.slice(0, 4), c.slice(4, 6), c.slice(6, 8), 'compact');
    add(c.slice(4, 8), c.slice(2, 4), c.slice(0, 2), 'compact-rtl');
  }

  return output.sort((a, b) => b.score - a.score);
}

function bestDate(readings) {
  const all = [];
  for (const text of readings) {
    for (const candidate of dateCandidates(text)) {
      const existing = all.find(item => item.date === candidate.date);
      if (existing) {
        existing.hits += 1;
        existing.score += 25;
      } else {
        all.push({ ...candidate, hits: 1 });
      }
    }
  }
  all.sort((a, b) => b.score - a.score || b.hits - a.hits);
  return all[0] || null;
}

function amountCandidates(value) {
  const text = normalize(value);
  const out = [];
  const sequences = text.match(
    /[0-9]{1,3}(?:[\s,٬،.]+[0-9]{1,3}){1,5}/g
  ) || [];

  for (const raw of sequences) {
    const groups = raw.match(/[0-9]+/g) || [];
    if (groups.length < 2) continue;

    const normalValid =
      groups[0].length >= 1 &&
      groups[0].length <= 3 &&
      groups.slice(1).every(group => group.length === 3);

    const rtlValid =
      groups[groups.length - 1].length >= 1 &&
      groups[groups.length - 1].length <= 3 &&
      groups.slice(0, -1).every(group => group.length === 3);

    const variants = [];
    if (normalValid) variants.push({ digits: groups.join(''), mode: 'grouped' });
    if (rtlValid) variants.push({ digits: [...groups].reverse().join(''), mode: 'grouped-rtl' });

    for (const variant of variants) {
      if (/^0+$/.test(variant.digits)) continue;
      const n = Number(variant.digits);
      if (!Number.isSafeInteger(n) || n <= 0) continue;
      out.push({
        ...variant,
        value: n,
        grouped: true
      });
    }
  }

  for (const digits of text.match(/[0-9]{4,15}/g) || []) {
    if (/^0+$/.test(digits)) continue;
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n <= 0) continue;
    out.push({
      digits,
      value: n,
      mode: 'plain',
      grouped: false
    });
  }

  return out;
}

function bestAmount(readings) {
  const map = new Map();
  for (const text of readings) {
    for (const candidate of amountCandidates(text)) {
      const key = candidate.digits;
      const current = map.get(key) || {
        ...candidate,
        hits: 0,
        score: 0
      };
      current.hits += 1;
      current.score +=
        50 +
        (candidate.grouped ? 25 : 0) +
        (candidate.mode === 'grouped-rtl' ? 5 : 0) +
        (candidate.value % 10 === 0 ? 8 : 0);
      map.set(key, current);
    }
  }

  const all = [...map.values()];
  all.forEach(item => {
    item.score += Math.min(50, item.hits * 12);
  });
  all.sort((a, b) => b.score - a.score || b.value - a.value);
  return all[0] || null;
}

export async function recognizeLocalDocumentV8(options = {}) {
  const base = await recognizeLocalDocumentV7(options);
  const type = String(options.documentType || '');
  const isReceiptImage =
    String(options.mimeType || '').startsWith('image/') &&
    (type === 'receipt' || type === 'bank_slip');

  if (!isReceiptImage) return base;

  const fields = {
    ...(base?.receipt_fields || {})
  };

  const focus = fields?.debug?.focus_v7 || {};
  const dateReadings = [
    ...(Array.isArray(focus.date_readings) ? focus.date_readings : []),
    String(fields.date_text || ''),
    String(base?.critical?.date_text || '')
  ].filter(Boolean);

  const amountReadings = [
    ...(Array.isArray(focus.amount_readings) ? focus.amount_readings : []),
    String(fields.amount_digits || ''),
    String(base?.critical?.amount_text || '')
  ].filter(Boolean);

  const date = bestDate(dateReadings);
  const amount = bestAmount(amountReadings);

  if (date) {
    const currentYear = Number(String(fields.date_text || '').slice(0, 4));
    const currentIsJalali = currentYear >= 1300 && currentYear <= 1600;
    const recoveredIsJalali = date.year >= 1300 && date.year <= 1600;

    if (!fields.date_text || (!currentIsJalali && recoveredIsJalali)) {
      fields.date_text = date.date;
      fields.date_confidence = Math.max(
        Number(fields.date_confidence || 0),
        date.hits > 1 ? .78 : .62
      );
    }
  }

  if (amount && !fields.amount_digits) {
    fields.amount_digits = amount.digits;
    fields.amount_confidence = amount.hits > 1 ? .76 : .58;
  }

  fields.recovery = {
    ...(fields.recovery || {}),
    consensus_v8: true,
    amount_mode: amount?.mode || '',
    date_source: date?.source || ''
  };

  const standard = [];
  if (fields.amount_digits && fields.amount_unit) {
    standard.push(
      `مبلغ ${fields.amount_digits} ${fields.amount_unit === 'rial' ? 'ریال' : 'تومان'}`
    );
  }
  if (fields.date_text) standard.push(`تاریخ ${fields.date_text}`);
  if (fields.reference) standard.push(`پیگیری/مرجع ${fields.reference}`);
  if (fields.success) standard.push('عملیات موفق');

  const standardText = standard.join('\n');

  return {
    ...base,
    text: [String(base?.text || '').trim(), standardText]
      .filter(Boolean)
      .join('\n'),
    critical_text: [standardText, String(base?.critical_text || '').trim()]
      .filter(Boolean)
      .join('\n'),
    critical: {
      ...(base?.critical || {}),
      amount_text:
        fields.amount_digits && fields.amount_unit
          ? `مبلغ ${fields.amount_digits} ${fields.amount_unit === 'rial' ? 'ریال' : 'تومان'}`
          : String(base?.critical?.amount_text || ''),
      date_text:
        fields.date_text
          ? `تاریخ ${fields.date_text}`
          : String(base?.critical?.date_text || ''),
      amount_confidence:
        Number(fields.amount_confidence || 0) ||
        Number(base?.critical?.amount_confidence || 0),
      date_confidence:
        Number(fields.date_confidence || 0) ||
        Number(base?.critical?.date_confidence || 0)
    },
    receipt_fields: fields,
    receipt_pipeline: {
      ...(base?.receipt_pipeline || {}),
      version: 'v8-rtl-consensus',
      rtl_group_consensus: true,
      jalali_priority: true,
      human_review_required: true
    },
    engine: 'tesseract-receipt-rtl-consensus-v8'
  };
}
