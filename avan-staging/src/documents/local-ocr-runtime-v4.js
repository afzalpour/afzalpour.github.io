'use strict';

import {
  recognizeLocalDocumentV3
} from './local-ocr-runtime-v3.js';

const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';

let tessPromise = null;

function report(cb, value) {
  if (typeof cb === 'function') cb(value);
}

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) {
    return Promise.resolve(globalThis.Tesseract);
  }

  if (!tessPromise) {
    tessPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-avan-tesseract-v4]');
      const finish = () => {
        if (globalThis.Tesseract?.createWorker) resolve(globalThis.Tesseract);
        else reject(new Error('LOCAL_OCR_RUNTIME_UNAVAILABLE'));
      };

      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', () => reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.avanTesseractV4 = '1';
      script.onload = finish;
      script.onerror = () => reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return tessPromise;
}

async function downloadBlob(sourceUrl) {
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('LOCAL_OCR_SOURCE_DOWNLOAD_FAILED');
  return response.blob();
}

async function blobToCanvas(blob) {
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

    let width = image.naturalWidth;
    let height = image.naturalHeight;
    const maxWidth = 2400;
    const scale = width > maxWidth
      ? maxWidth / width
      : Math.min(2.2, 2200 / Math.max(1, width));

    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const maxPixels = 7500000;
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
    ctx.drawImage(image, 0, 0, width, height);
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

function grayscaleContrast(source, invert = false) {
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

  let min = 255;
  let max = 0;

  for (let i = 0; i < data.length; i += 4) {
    const g = Math.round(
      data[i] * .299 +
      data[i + 1] * .587 +
      data[i + 2] * .114
    );

    min = Math.min(min, g);
    max = Math.max(max, g);
    data[i] = data[i + 1] = data[i + 2] = g;
  }

  const span = Math.max(42, max - min);

  for (let i = 0; i < data.length; i += 4) {
    let value = Math.max(
      0,
      Math.min(
        255,
        Math.round(((data[i] - min) * 255) / span)
      )
    );

    if (invert) value = 255 - value;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function rowDarkness(source, y) {
  const ctx = source.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });

  if (!ctx) return 0;

  const image = ctx.getImageData(0, y, source.width, 1).data;
  let dark = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(source.width / 420));

  for (let x = 0; x < source.width; x += step) {
    const i = x * 4;
    const g = image[i] * .299 + image[i + 1] * .587 + image[i + 2] * .114;
    if (g < 105) dark += 1;
    count += 1;
  }

  return count ? dark / count : 0;
}

function detectAmountBand(source) {
  const start = Math.round(source.height * .62);
  const end = Math.round(source.height * .94);
  const step = Math.max(1, Math.round(source.height / 350));
  let bestY = -1;
  let best = 0;

  for (let y = start; y < end; y += step) {
    const score = rowDarkness(source, y);
    if (score > best) {
      best = score;
      bestY = y;
    }
  }

  if (bestY < 0 || best < .34) return null;

  const half = Math.max(32, Math.round(source.height * .055));

  return {
    top: Math.max(0, (bestY - half) / source.height),
    bottom: Math.min(1, (bestY + half) / source.height),
    darkness: best
  };
}

function faToEn(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function cleanDigits(value) {
  return faToEn(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[^0-9]/g, '');
}

function chooseAmount(text) {
  const normalized = faToEn(text);
  const matches = normalized.match(/\d[\d\s,٬.]{3,18}\d|\d{4,16}/g) || [];
  const candidates = [];

  for (const raw of matches) {
    const digits = cleanDigits(raw);
    if (digits.length < 4 || digits.length > 13) continue;
    if (/^0+$/.test(digits)) continue;

    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value <= 0) continue;

    candidates.push({
      digits,
      value
    });
  }

  candidates.sort((a, b) => b.value - a.value);
  return candidates[0] || null;
}

function chooseDate(text) {
  const normalized = faToEn(text);
  const patterns = [
    /(1[34]\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/,
    /(20\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
  }

  return '';
}

function chooseReference(text) {
  const normalized = faToEn(text);
  const labeled = normalized.match(
    /(?:پیگیری|مرجع|reference|trace)[^0-9]{0,18}([0-9][0-9\s\-\/]{5,22})/i
  );

  if (labeled?.[1]) {
    const digits = cleanDigits(labeled[1]);
    if (digits.length >= 6) return digits.slice(0, 22);
  }

  const sequences = normalized.match(/\d{6,22}/g) || [];

  return sequences
    .map(cleanDigits)
    .filter(value => value.length >= 6 && value.length <= 22)
    .sort((a, b) => b.length - a.length)[0] || '';
}

function hasSuccess(text) {
  const normalized = String(text || '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک');

  return /عملیات\s*موفق|موفق|successful|approved/i.test(normalized);
}

async function recognizeCanvas(worker, canvas, {
  psm = 6,
  whitelist = ''
} = {}) {
  const params = {
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    tessedit_char_whitelist: whitelist
  };

  await worker.setParameters(params);
  return worker.recognize(canvas);
}

async function structuredReceiptFields({
  sourceUrl,
  onProgress
}) {
  const blob = await downloadBlob(sourceUrl);
  const source = await blobToCanvas(blob);
  const tess = await loadTesseract();

  const worker = await tess.createWorker(['fas', 'eng'], 1, {
    logger: msg => {
      if (typeof msg?.progress === 'number') {
        report(onProgress, {
          phase: 'receipt-fields',
          progress: .70 + msg.progress * .25,
          status: msg.status || '',
          message: 'در حال خواندن فیلدهای عددی رسید…'
        });
      }
    }
  });

  try {
    const middle = grayscaleContrast(crop(source, .34, .76));
    const middleResult = await recognizeCanvas(worker, middle, {
      psm: 6,
      whitelist: ''
    });

    const middleText = String(middleResult?.data?.text || '');
    let amountText = '';
    let amountConfidence = 0;
    const band = detectAmountBand(source);

    if (band) {
      const amountCrop = crop(source, band.top, band.bottom, .03, .97);
      const amountPrepared = grayscaleContrast(amountCrop, true);
      const amountResult = await recognizeCanvas(worker, amountPrepared, {
        psm: 7,
        whitelist: '0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩,٬. '
      });

      amountText = String(amountResult?.data?.text || '');
      amountConfidence = Number(amountResult?.data?.confidence || 0);
    }

    if (!amountText.trim()) {
      const lower = grayscaleContrast(crop(source, .68, .94));
      const amountResult = await recognizeCanvas(worker, lower, {
        psm: 11,
        whitelist: '0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩,٬. '
      });

      amountText = String(amountResult?.data?.text || '');
      amountConfidence = Number(amountResult?.data?.confidence || 0);
    }

    const amount = chooseAmount(amountText);
    const date = chooseDate(middleText);
    const reference = chooseReference(middleText);

    return {
      amount_digits: amount?.digits || '',
      amount_confidence: amount ? amountConfidence / 100 : 0,
      amount_unit: amount ? 'rial' : '',
      date_text: date,
      date_confidence: date
        ? Number(middleResult?.data?.confidence || 0) / 100
        : 0,
      reference,
      reference_confidence: reference
        ? Number(middleResult?.data?.confidence || 0) / 100
        : 0,
      success: hasSuccess(middleText),
      middle_text: middleText.slice(0, 2500),
      amount_raw_text: amountText.slice(0, 1000),
      amount_band_detected: Boolean(band)
    };
  } finally {
    await worker.terminate();
  }
}

export async function recognizeLocalDocumentV4({
  sourceUrl,
  mimeType,
  fileName = '',
  documentType = 'other',
  maxPages = 4,
  onProgress
} = {}) {
  const base = await recognizeLocalDocumentV3({
    sourceUrl,
    mimeType,
    fileName,
    documentType,
    maxPages,
    onProgress
  });

  const type = String(documentType || '');
  const isReceiptImage =
    String(mimeType || '').startsWith('image/') &&
    (type === 'receipt' || type === 'bank_slip');

  if (!isReceiptImage) return base;

  report(onProgress, {
    phase: 'receipt-fields',
    progress: .70,
    message: 'در حال کنترل مبلغ، تاریخ و شماره مرجع…'
  });

  let fields = null;

  try {
    fields = await structuredReceiptFields({
      sourceUrl,
      onProgress
    });
  } catch (error) {
    console.warn('AVAN_RECEIPT_STRUCTURED_OCR_FAILED', error);
  }

  if (!fields) return base;

  const critical = {
    ...(base?.critical || {})
  };

  if (fields.amount_digits) {
    critical.amount_text = `مبلغ ${fields.amount_digits} ریال`;
    critical.amount_confidence = Math.round(fields.amount_confidence * 100);
  }

  if (fields.date_text) {
    critical.date_text = fields.date_text;
    critical.date_confidence = Math.round(fields.date_confidence * 100);
  }

  report(onProgress, {
    phase: 'done',
    progress: 1,
    message: 'فیلدهای اصلی رسید برای بازبینی آماده شد.'
  });

  return {
    ...base,
    critical,
    receipt_fields: fields,
    engine: 'receipt-structured-v4',
    receipt_pipeline: 'structured-fields-v4'
  };
}
