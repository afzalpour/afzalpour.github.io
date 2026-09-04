'use strict';

import {
  recognizeLocalDocumentV6
} from './local-ocr-runtime-v6.js';

const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

let tessPromise = null;

function report(cb, value) {
  if (typeof cb === 'function') cb(value);
}

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

function normalizePersian(value) {
  return String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function onlyDigits(value) {
  return normalizeDigits(value).replace(/[^0-9]/g, '');
}

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) {
    return Promise.resolve(globalThis.Tesseract);
  }

  if (!tessPromise) {
    tessPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-avan-tesseract-v7],script[data-avan-tesseract-v5]'
      );

      const finish = () => {
        if (globalThis.Tesseract?.createWorker) {
          resolve(globalThis.Tesseract);
        } else {
          reject(new Error('LOCAL_OCR_RUNTIME_UNAVAILABLE'));
        }
      };

      if (existing) {
        if (globalThis.Tesseract?.createWorker) {
          resolve(globalThis.Tesseract);
          return;
        }
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener(
          'error',
          () => reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.avanTesseractV7 = '1';
      script.onload = finish;
      script.onerror = () =>
        reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return tessPromise;
}

async function sourceCanvas(sourceUrl) {
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('LOCAL_OCR_SOURCE_DOWNLOAD_FAILED');
  const blob = await response.blob();

  let bitmap = null;
  try {
    if (globalThis.createImageBitmap) {
      try {
        bitmap = await createImageBitmap(blob, {
          imageOrientation: 'from-image'
        });
      } catch {
        bitmap = await createImageBitmap(blob);
      }
    }

    if (bitmap) {
      const maxWidth = 2800;
      const scale = Math.min(
        bitmap.width < 1800 ? 2.4 : 1.25,
        maxWidth / Math.max(1, bitmap.width)
      );
      let width = Math.max(1, Math.round(bitmap.width * scale));
      let height = Math.max(1, Math.round(bitmap.height * scale));
      const maxPixels = 9000000;
      if (width * height > maxPixels) {
        const down = Math.sqrt(maxPixels / (width * height));
        width = Math.max(1, Math.round(width * down));
        height = Math.max(1, Math.round(height * down));
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: true
      });
      if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      return canvas;
    }
  } finally {
    bitmap?.close?.();
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.style.imageOrientation = 'from-image';
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    const scale = Math.min(
      image.naturalWidth < 1800 ? 2.4 : 1.25,
      2800 / Math.max(1, image.naturalWidth)
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true
    });
    if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function crop(source, top, bottom, left = 0, right = 1) {
  const sx = Math.max(0, Math.round(source.width * left));
  const sy = Math.max(0, Math.round(source.height * top));
  const ex = Math.min(source.width, Math.round(source.width * right));
  const ey = Math.min(source.height, Math.round(source.height * bottom));
  const width = Math.max(1, ex - sx);
  const height = Math.max(1, ey - sy);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
  return canvas;
}

function grayscale(source, invert = false) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const values = new Uint8Array(canvas.width * canvas.height);
  const hist = new Uint32Array(256);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    let v = Math.round(
      data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114
    );
    if (invert) v = 255 - v;
    values[p] = v;
    hist[v] += 1;
  }

  const total = values.length;
  let acc = 0;
  let low = 0;
  let high = 255;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc >= total * .015) {
      low = i;
      break;
    }
  }
  acc = 0;
  for (let i = 0; i < 256; i += 1) {
    acc += hist[i];
    if (acc >= total * .985) {
      high = i;
      break;
    }
  }
  const span = Math.max(28, high - low);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const v = Math.max(
      0,
      Math.min(255, Math.round(((values[p] - low) * 255) / span))
    );
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function otsuThreshold(source) {
  const ctx = source.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  const image = ctx.getImageData(0, 0, source.width, source.height);
  const data = image.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) hist[data[i]] += 1;

  const total = source.width * source.height;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let max = -1;
  for (let i = 0; i < 256; i += 1) {
    wB += hist[i];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      best = i;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const out = canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });
  if (!out) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  const clone = new ImageData(
    new Uint8ClampedArray(data),
    source.width,
    source.height
  );
  for (let i = 0; i < clone.data.length; i += 4) {
    const v = clone.data[i] <= best ? 0 : 255;
    clone.data[i] = clone.data[i + 1] = clone.data[i + 2] = v;
  }
  out.putImageData(clone, 0, 0);
  return canvas;
}

function upscale(source, factor = 1.8) {
  let width = Math.max(1, Math.round(source.width * factor));
  let height = Math.max(1, Math.round(source.height * factor));
  const maxPixels = 6000000;
  if (width * height > maxPixels) {
    const down = Math.sqrt(maxPixels / (width * height));
    width = Math.max(1, Math.round(width * down));
    height = Math.max(1, Math.round(height * down));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function recognize(worker, canvas, {
  psm = 7,
  whitelist = ''
} = {}) {
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    tessedit_char_whitelist: whitelist
  });
  const result = await worker.recognize(canvas);
  return {
    text: String(result?.data?.text || '').trim(),
    confidence: Number(result?.data?.confidence || 0)
  };
}

function validDate(y, m, d) {
  const yearOk =
    (y >= 1300 && y <= 1600) ||
    (y >= 1900 && y <= 2200);
  return yearOk && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function dateFromText(value) {
  const text = normalizeDigits(value);
  const patterns = [
    /(1[3-6]\d{2}|19\d{2}|20\d{2}|21\d{2})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,2})/,
    /(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(1[3-6]\d{2}|19\d{2}|20\d{2}|21\d{2})/
  ];

  const first = text.match(patterns[0]);
  if (first) {
    const y = Number(first[1]);
    const m = Number(first[2]);
    const d = Number(first[3]);
    if (validDate(y, m, d)) {
      return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    }
  }

  const rtl = text.match(patterns[1]);
  if (rtl) {
    const d = Number(rtl[1]);
    const m = Number(rtl[2]);
    const y = Number(rtl[3]);
    if (validDate(y, m, d)) {
      return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    }
  }

  const compact = onlyDigits(text);
  for (let i = 0; i <= compact.length - 8; i += 1) {
    const c = compact.slice(i, i + 8);
    const y1 = Number(c.slice(0, 4));
    const m1 = Number(c.slice(4, 6));
    const d1 = Number(c.slice(6, 8));
    if (validDate(y1, m1, d1)) {
      return `${y1}/${c.slice(4, 6)}/${c.slice(6, 8)}`;
    }
    const d2 = Number(c.slice(0, 2));
    const m2 = Number(c.slice(2, 4));
    const y2 = Number(c.slice(4, 8));
    if (validDate(y2, m2, d2)) {
      return `${y2}/${c.slice(2, 4)}/${c.slice(0, 2)}`;
    }
  }
  return '';
}

function amountCandidates(value) {
  const text = normalizeDigits(value);
  const outputs = [];
  const grouped = text.match(/[0-9]{1,3}(?:[\s,٬،.]+[0-9]{3}){1,4}/g) || [];
  for (const raw of grouped) {
    const groups = raw.match(/[0-9]+/g) || [];
    const normal = groups.join('');
    const reversed = [...groups].reverse().join('');
    for (const digits of [normal, reversed]) {
      if (digits.length < 4 || digits.length > 15 || /^0+$/.test(digits)) continue;
      const n = Number(digits);
      if (Number.isSafeInteger(n) && n > 0) outputs.push({ digits, value: n, grouped: true });
    }
  }

  const plain = text.match(/[0-9]{4,15}/g) || [];
  for (const digits of plain) {
    if (/^0+$/.test(digits)) continue;
    const n = Number(digits);
    if (Number.isSafeInteger(n) && n > 0) outputs.push({ digits, value: n, grouped: false });
  }
  return outputs;
}

function chooseAmount(readings) {
  const map = new Map();
  readings.forEach(reading => {
    amountCandidates(reading.text).forEach(candidate => {
      const current = map.get(candidate.digits) || {
        ...candidate,
        hits: 0,
        confidence: 0
      };
      current.hits += 1;
      current.confidence = Math.max(current.confidence, Number(reading.confidence || 0));
      map.set(candidate.digits, current);
    });
  });

  const candidates = [...map.values()];
  candidates.forEach(item => {
    item.score =
      item.hits * 55 +
      item.confidence +
      (item.grouped ? 18 : 0) +
      (item.value % 10 === 0 ? 8 : 0) +
      (item.digits.length >= 5 && item.digits.length <= 12 ? 6 : 0);
  });
  candidates.sort((a, b) => b.score - a.score || b.value - a.value);
  return candidates[0] || null;
}

function levenshtein(a, b) {
  const x = normalizePersian(a);
  const y = normalizePersian(b);
  const row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= y.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (x[i - 1] === y[j - 1] ? 0 : 1)
      );
      prev = old;
    }
  }
  return row[y.length];
}

function unitFromText(value) {
  const text = normalizePersian(value).toLowerCase();
  if (/ریال|rial/.test(text)) return { unit: 'rial', confidence: .98 };
  if (/تومان|toman/.test(text)) return { unit: 'toman', confidence: .98 };
  const words = text.match(/[\u0600-\u06ff]{3,7}/g) || [];
  let rial = 99;
  let toman = 99;
  for (const word of words) {
    rial = Math.min(rial, levenshtein(word, 'ریال'));
    toman = Math.min(toman, levenshtein(word, 'تومان'));
  }
  if (rial <= 1 && rial < toman) return { unit: 'rial', confidence: .74 };
  if (toman <= 1 && toman < rial) return { unit: 'toman', confidence: .74 };
  return { unit: '', confidence: 0 };
}

async function focusedReceiptPass({ sourceUrl, onProgress }) {
  const source = await sourceCanvas(sourceUrl);
  const tess = await loadTesseract();
  const worker = await tess.createWorker(['fas', 'eng'], 1, {
    logger: msg => {
      if (typeof msg?.progress === 'number') {
        report(onProgress, {
          phase: 'receipt-focus-v7',
          progress: .78 + msg.progress * .20,
          status: msg.status || '',
          message: 'در حال خواندن دقیق مبلغ و تاریخ رسید…'
        });
      }
    }
  });

  const digitWhitelist =
    '0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩/\\-:.,٬، ';

  try {
    const dateRegions = [
      crop(source, .385, .555, .00, .82),
      crop(source, .415, .535, .00, .78),
      crop(source, .355, .585, .00, .88)
    ];
    const dateReadings = [];
    for (const region of dateRegions) {
      const g = upscale(grayscale(region, false), 1.75);
      const b = otsuThreshold(g);
      dateReadings.push(await recognize(worker, g, { psm: 7, whitelist: digitWhitelist }));
      dateReadings.push(await recognize(worker, b, { psm: 7, whitelist: digitWhitelist }));
      dateReadings.push(await recognize(worker, b, { psm: 13, whitelist: digitWhitelist }));
    }

    let dateText = '';
    let dateConfidence = 0;
    for (const reading of dateReadings) {
      const found = dateFromText(reading.text);
      if (found) {
        dateText = found;
        dateConfidence = Math.max(dateConfidence, Number(reading.confidence || 0) / 100);
      }
    }

    const amountRegions = [
      crop(source, .755, .925, .02, .76),
      crop(source, .785, .915, .03, .70),
      crop(source, .725, .945, .00, .82)
    ];
    const amountReadings = [];
    for (const region of amountRegions) {
      const inv = upscale(grayscale(region, true), 1.85);
      const bin = otsuThreshold(inv);
      amountReadings.push(await recognize(worker, inv, { psm: 7, whitelist: digitWhitelist }));
      amountReadings.push(await recognize(worker, bin, { psm: 7, whitelist: digitWhitelist }));
      amountReadings.push(await recognize(worker, bin, { psm: 13, whitelist: digitWhitelist }));
    }
    const amount = chooseAmount(amountReadings);

    const unitRegions = [
      crop(source, .755, .93, .00, .32),
      crop(source, .73, .95, .00, .42),
      crop(source, .73, .95, .00, 1.00)
    ];
    const unitReadings = [];
    for (const region of unitRegions) {
      const inv = upscale(grayscale(region, true), 1.55);
      const bin = otsuThreshold(inv);
      unitReadings.push(await recognize(worker, inv, { psm: 7, whitelist: '' }));
      unitReadings.push(await recognize(worker, bin, { psm: 6, whitelist: '' }));
    }
    let unit = { unit: '', confidence: 0 };
    for (const reading of unitReadings) {
      const found = unitFromText(reading.text);
      if (found.confidence > unit.confidence) unit = found;
    }

    return {
      amount_digits: amount?.digits || '',
      amount_confidence: amount
        ? Math.min(1, Math.max(.52, Number(amount.confidence || 0) / 100) + Math.min(.18, (amount.hits - 1) * .06))
        : 0,
      amount_unit: unit.unit,
      amount_unit_confidence: unit.confidence,
      date_text: dateText,
      date_confidence: dateText ? Math.max(.55, dateConfidence) : 0,
      debug: {
        date_readings: dateReadings.map(x => x.text).slice(0, 9),
        amount_readings: amountReadings.map(x => x.text).slice(0, 9),
        unit_readings: unitReadings.map(x => x.text).slice(0, 6)
      }
    };
  } finally {
    await worker.terminate();
  }
}

export async function recognizeLocalDocumentV7(options = {}) {
  const base = await recognizeLocalDocumentV6(options);
  const type = String(options.documentType || '');
  const isReceiptImage =
    String(options.mimeType || '').startsWith('image/') &&
    (type === 'receipt' || type === 'bank_slip');

  if (!isReceiptImage) return base;

  const existing =
    base?.receipt_fields && typeof base.receipt_fields === 'object'
      ? base.receipt_fields
      : {};

  if (
    existing.amount_digits &&
    existing.amount_unit &&
    existing.date_text
  ) {
    return base;
  }

  report(options.onProgress, {
    phase: 'receipt-focus-v7',
    progress: .78,
    message: 'در حال خواندن دقیق مبلغ و تاریخ رسید…'
  });

  let focused;
  try {
    focused = await focusedReceiptPass({
      sourceUrl: options.sourceUrl,
      onProgress: options.onProgress
    });
  } catch (error) {
    console.warn('AVAN_RECEIPT_FOCUS_V7_FAILED', error);
    focused = {
      amount_digits: '',
      amount_confidence: 0,
      amount_unit: '',
      amount_unit_confidence: 0,
      date_text: '',
      date_confidence: 0,
      debug: {}
    };
  }

  const fields = {
    ...existing,
    amount_digits:
      existing.amount_digits || focused.amount_digits || '',
    amount_confidence:
      existing.amount_digits
        ? Number(existing.amount_confidence || 0)
        : Number(focused.amount_confidence || 0),
    amount_unit:
      existing.amount_unit || focused.amount_unit || '',
    amount_unit_confidence:
      existing.amount_unit
        ? Number(existing.amount_unit_confidence || 0)
        : Number(focused.amount_unit_confidence || 0),
    date_text:
      existing.date_text || focused.date_text || '',
    date_confidence:
      existing.date_text
        ? Number(existing.date_confidence || 0)
        : Number(focused.date_confidence || 0),
    debug: {
      ...(existing.debug || {}),
      focus_v7: focused.debug || {}
    },
    recovery: {
      ...(existing.recovery || {}),
      focus_v7: true
    }
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
  const text = [String(base?.text || '').trim(), standardText]
    .filter(Boolean)
    .join('\n');
  const criticalText = [standardText, String(base?.critical_text || '').trim()]
    .filter(Boolean)
    .join('\n');

  report(options.onProgress, {
    phase: 'done',
    progress: 1,
    message:
      fields.amount_digits || fields.date_text
        ? 'فیلدهای رسید استخراج شد؛ نتیجه را بازبینی کنید.'
        : 'رسید خوانده شد اما مبلغ و تاریخ هنوز نیازمند بازبینی هستند.'
  });

  return {
    ...base,
    text,
    critical_text: criticalText,
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
      version: 'v7-focused-receipt',
      focused_date_crops: true,
      focused_amount_crops: true,
      separate_unit_ocr: true,
      otsu_preprocess: true,
      human_review_required: true
    },
    engine: 'tesseract-receipt-focus-v7'
  };
}
