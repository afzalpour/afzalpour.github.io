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
      const existing = document.querySelector(
        'script[data-avan-tesseract-v5]'
      );

      const finish = () => {
        if (globalThis.Tesseract?.createWorker) {
          resolve(globalThis.Tesseract);
        } else {
          reject(new Error('LOCAL_OCR_RUNTIME_UNAVAILABLE'));
        }
      };

      if (existing) {
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
      script.dataset.avanTesseractV5 = '1';
      script.onload = finish;
      script.onerror = () =>
        reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return tessPromise;
}

async function downloadBlob(sourceUrl) {
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('LOCAL_OCR_SOURCE_DOWNLOAD_FAILED');
  }
  return response.blob();
}

async function blobToCanvas(blob) {
  let bitmap = null;

  try {
    if (globalThis.createImageBitmap) {
      try {
        bitmap = await createImageBitmap(
          blob,
          { imageOrientation: 'from-image' }
        );
      } catch {
        bitmap = await createImageBitmap(blob);
      }
    }

    if (bitmap) {
      let width = bitmap.width;
      let height = bitmap.height;
      const scale = width < 1800
        ? Math.min(2.25, 2300 / Math.max(1, width))
        : Math.min(1, 2400 / Math.max(1, width));

      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));

      const maxPixels = 8000000;
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
    const scale = image.naturalWidth < 1800
      ? Math.min(2.25, 2300 / Math.max(1, image.naturalWidth))
      : Math.min(1, 2400 / Math.max(1, image.naturalWidth));

    canvas.width = Math.max(
      1,
      Math.round(image.naturalWidth * scale)
    );
    canvas.height = Math.max(
      1,
      Math.round(image.naturalHeight * scale)
    );

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
  ctx.drawImage(
    source,
    sx,
    sy,
    width,
    height,
    0,
    0,
    width,
    height
  );
  return canvas;
}

function grayscaleStretch(source, invert = false) {
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
  const hist = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.max(
      0,
      Math.min(
        255,
        Math.round(
          data[i] * .299 +
          data[i + 1] * .587 +
          data[i + 2] * .114
        )
      )
    );
    hist[gray] += 1;
    data[i] = data[i + 1] = data[i + 2] = gray;
  }

  const total = canvas.width * canvas.height;
  const lowTarget = total * .012;
  const highTarget = total * .992;
  let sum = 0;
  let low = 0;
  let high = 255;

  for (let i = 0; i < 256; i += 1) {
    sum += hist[i];
    if (sum >= lowTarget) {
      low = i;
      break;
    }
  }

  sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += hist[i];
    if (sum >= highTarget) {
      high = i;
      break;
    }
  }

  const span = Math.max(32, high - low);
  for (let i = 0; i < data.length; i += 4) {
    let value = Math.max(
      0,
      Math.min(
        255,
        Math.round(((data[i] - low) * 255) / span)
      )
    );
    if (invert) value = 255 - value;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function binaryThreshold(source, threshold = 145) {
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

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] < threshold ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function upscale(source, factor = 1.45) {
  const maxPixels = 5000000;
  let width = Math.max(1, Math.round(source.width * factor));
  let height = Math.max(1, Math.round(source.height * factor));

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

function rowDarkness(source, y) {
  const ctx = source.getContext('2d', {
    alpha: false,
    willReadFrequently: true
  });
  if (!ctx) return 0;

  const data = ctx.getImageData(0, y, source.width, 1).data;
  const step = Math.max(1, Math.floor(source.width / 400));
  let dark = 0;
  let count = 0;

  for (let x = 0; x < source.width; x += step) {
    const i = x * 4;
    const gray =
      data[i] * .299 +
      data[i + 1] * .587 +
      data[i + 2] * .114;
    if (gray < 115) dark += 1;
    count += 1;
  }

  return count ? dark / count : 0;
}

function detectDarkAmountBand(source) {
  const start = Math.round(source.height * .70);
  const end = Math.round(source.height * .96);
  const step = Math.max(1, Math.round(source.height / 420));
  let bestY = -1;
  let bestScore = 0;

  for (let y = start; y < end; y += step) {
    const score = rowDarkness(source, y);
    if (score > bestScore) {
      bestScore = score;
      bestY = y;
    }
  }

  if (bestY < 0 || bestScore < .28) return null;

  const half = Math.max(28, Math.round(source.height * .052));
  return {
    top: Math.max(0, (bestY - half) / source.height),
    bottom: Math.min(1, (bestY + half) / source.height),
    score: bestScore
  };
}

function faToEn(value) {
  return String(value ?? '')
    .replace(/[۰-۹]/g, d =>
      String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    )
    .replace(/[٠-٩]/g, d =>
      String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    );
}

function normalizeOcrDigits(value) {
  return faToEn(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[—–_]/g, '-');
}

function onlyDigits(value) {
  return normalizeOcrDigits(value)
    .replace(/[^0-9]/g, '');
}

function validDate(year, month, day) {
  if (year >= 1300 && year <= 1599) {
    return month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }
  if (year >= 2000 && year <= 2199) {
    return month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }
  return false;
}

function dateFromText(value) {
  const text = normalizeOcrDigits(value);
  const separated = text.match(
    /(1[3-5]\d{2}|20\d{2})\s*[\/\\.\-:]\s*(\d{1,2})\s*[\/\\.\-:]\s*(\d{1,2})/
  );

  if (separated) {
    const year = Number(separated[1]);
    const month = Number(separated[2]);
    const day = Number(separated[3]);
    if (validDate(year, month, day)) {
      return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }
  }

  const compact = onlyDigits(text);
  for (let i = 0; i <= compact.length - 8; i += 1) {
    const candidate = compact.slice(i, i + 8);
    if (!/^(1[3-5]\d{6}|20\d{6})$/.test(candidate)) continue;

    const year = Number(candidate.slice(0, 4));
    const month = Number(candidate.slice(4, 6));
    const day = Number(candidate.slice(6, 8));
    if (validDate(year, month, day)) {
      return `${year}/${candidate.slice(4, 6)}/${candidate.slice(6, 8)}`;
    }
  }

  return '';
}

function amountCandidates(text) {
  const normalized = normalizeOcrDigits(text);
  const matches = normalized.match(
    /\d[\d\s,٬،.]{2,20}\d|\d{4,14}/g
  ) || [];
  const output = [];

  for (const raw of matches) {
    const digits = onlyDigits(raw);
    if (digits.length < 4 || digits.length > 13) continue;
    if (/^0+$/.test(digits)) continue;

    const value = Number(digits);
    if (!Number.isSafeInteger(value) || value <= 0) continue;

    output.push({ digits, value, raw });
  }

  return output;
}

function chooseConsensusAmount(readings) {
  const byDigits = new Map();

  readings.forEach((reading, readingIndex) => {
    amountCandidates(reading.text).forEach(candidate => {
      const current = byDigits.get(candidate.digits) || {
        ...candidate,
        hits: 0,
        confidence: 0,
        readingIndex
      };
      current.hits += 1;
      current.confidence = Math.max(
        current.confidence,
        Number(reading.confidence || 0)
      );
      byDigits.set(candidate.digits, current);
    });
  });

  const candidates = Array.from(byDigits.values());
  candidates.forEach(candidate => {
    candidate.score =
      candidate.hits * 50 +
      candidate.confidence +
      (candidate.value % 10 === 0 ? 8 : 0) +
      (candidate.digits.length >= 5 && candidate.digits.length <= 10 ? 6 : 0);
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.value - a.value;
  });

  return candidates[0] || null;
}

function referenceFromText(value) {
  const normalized = normalizeOcrDigits(value);
  const labeled = normalized.match(
    /(?:پیگیری|مرجع|reference|trace)[^0-9]{0,20}([0-9][0-9\s\-\/]{5,24})/i
  );

  if (labeled?.[1]) {
    const digits = onlyDigits(labeled[1]);
    if (digits.length >= 6 && digits.length <= 22) return digits;
  }

  const candidates = normalized.match(/\d{6,22}/g) || [];
  return candidates
    .map(onlyDigits)
    .filter(v => v.length >= 6 && v.length <= 22)
    .sort((a, b) => b.length - a.length)[0] || '';
}

function normalizedPersian(value) {
  return String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function successFromText(value) {
  const text = normalizedPersian(value);
  return /عملیات\s*موفق|موفق|successful|approved/i.test(text);
}

function unitFromText(value) {
  const text = normalizedPersian(value).toLowerCase();
  if (/تومان|toman/.test(text)) return 'toman';
  if (/ریال|rial/.test(text)) return 'rial';
  return '';
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

async function targetedReceiptFields({
  sourceUrl,
  baseText,
  onProgress
}) {
  const blob = await downloadBlob(sourceUrl);
  const source = await blobToCanvas(blob);
  const tess = await loadTesseract();
  const worker = await tess.createWorker(['fas', 'eng'], 1, {
    logger: msg => {
      if (typeof msg?.progress === 'number') {
        report(onProgress, {
          phase: 'receipt-reference',
          progress: .72 + msg.progress * .25,
          status: msg.status || '',
          message: 'در حال کنترل هدفمند تاریخ و مبلغ رسید…'
        });
      }
    }
  });

  const digitWhitelist =
    '0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩/\\-:.,٬، ';

  try {
    const dateWide = crop(source, .385, .585, .00, .78);
    const dateTight = crop(source, .415, .555, .00, .74);
    const dateWideGray = upscale(grayscaleStretch(dateWide), 1.35);
    const dateTightGray = upscale(grayscaleStretch(dateTight), 1.45);
    const dateTightBinary = binaryThreshold(dateTightGray, 155);

    const dateReadings = [];
    dateReadings.push(await recognize(worker, dateTightGray, {
      psm: 7,
      whitelist: ''
    }));
    dateReadings.push(await recognize(worker, dateTightBinary, {
      psm: 7,
      whitelist: digitWhitelist
    }));
    dateReadings.push(await recognize(worker, dateWideGray, {
      psm: 11,
      whitelist: digitWhitelist
    }));

    let dateText = '';
    let dateConfidence = 0;
    for (const reading of dateReadings) {
      const found = dateFromText(reading.text);
      if (found) {
        dateText = found;
        dateConfidence = Math.max(
          dateConfidence,
          reading.confidence / 100
        );
      }
    }

    const band = detectDarkAmountBand(source);
    const amountSource = band
      ? crop(source, band.top, band.bottom, .02, .98)
      : crop(source, .775, .945, .02, .98);

    const amountInverted = upscale(
      grayscaleStretch(amountSource, true),
      1.55
    );
    const amountBinaryA = binaryThreshold(amountInverted, 120);
    const amountBinaryB = binaryThreshold(amountInverted, 160);

    const amountReadings = [];
    amountReadings.push(await recognize(worker, amountInverted, {
      psm: 7,
      whitelist: ''
    }));
    amountReadings.push(await recognize(worker, amountBinaryA, {
      psm: 7,
      whitelist: digitWhitelist
    }));
    amountReadings.push(await recognize(worker, amountBinaryB, {
      psm: 11,
      whitelist: digitWhitelist
    }));
    amountReadings.push(await recognize(worker, amountBinaryA, {
      psm: 6,
      whitelist: ''
    }));

    const amount = chooseConsensusAmount(amountReadings);
    const amountEvidence = [
      baseText,
      ...amountReadings.map(item => item.text)
    ].join('\n');
    const amountUnit = unitFromText(amountEvidence);

    const referenceArea = upscale(
      grayscaleStretch(crop(source, .50, .76, .00, .78)),
      1.25
    );
    const referenceReading = await recognize(worker, referenceArea, {
      psm: 6,
      whitelist: ''
    });

    const reference = referenceFromText(
      `${baseText}\n${referenceReading.text}`
    );

    return {
      amount_digits: amount?.digits || '',
      amount_unit: amountUnit,
      amount_confidence: amount
        ? Math.min(
            1,
            Math.max(.40, (amount.confidence || 0) / 100) +
              Math.min(.25, Math.max(0, amount.hits - 1) * .10)
          )
        : 0,
      date_text: dateText,
      date_confidence: dateText
        ? Math.max(.45, dateConfidence)
        : 0,
      reference,
      reference_confidence: reference
        ? Math.max(.40, referenceReading.confidence / 100)
        : 0,
      success: successFromText(
        `${baseText}\n${referenceReading.text}`
      ),
      amount_band_detected: Boolean(band),
      amount_band_score: Number(band?.score || 0),
      debug: {
        date_readings: dateReadings.map(item => item.text).slice(0, 3),
        amount_readings: amountReadings.map(item => item.text).slice(0, 4),
        amount_unit_evidence: amountUnit || '',
        reference_text: referenceReading.text.slice(0, 800)
      }
    };
  } finally {
    await worker.terminate();
  }
}

function standardizedReceiptLines(fields) {
  const lines = [];

  if (
    fields?.amount_digits &&
    (fields.amount_unit === 'rial' || fields.amount_unit === 'toman')
  ) {
    lines.push(
      `مبلغ ${fields.amount_digits} ${
        fields.amount_unit === 'rial' ? 'ریال' : 'تومان'
      }`
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

  return lines;
}

export async function recognizeLocalDocumentV5({
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
    phase: 'receipt-reference',
    progress: .72,
    message: 'در حال کنترل هدفمند تاریخ و مبلغ رسید…'
  });

  let fields = null;
  try {
    fields = await targetedReceiptFields({
      sourceUrl,
      baseText: String(base?.text || ''),
      onProgress
    });
  } catch (error) {
    console.warn('AVAN_RECEIPT_REFERENCE_OCR_FAILED', error);
    fields = {
      amount_digits: '',
      amount_unit: '',
      amount_confidence: 0,
      date_text: '',
      date_confidence: 0,
      reference: '',
      reference_confidence: 0,
      success: false,
      amount_band_detected: false,
      amount_band_score: 0
    };
  }

  const standardLines = standardizedReceiptLines(fields);
  const standardText = standardLines.join('\n');
  const text = [
    String(base?.text || '').trim(),
    standardText
  ].filter(Boolean).join('\n');

  const criticalText = [
    standardText,
    String(base?.critical_text || '').trim()
  ].filter(Boolean).join('\n');

  report(onProgress, {
    phase: 'done',
    progress: 1,
    message: fields.amount_digits || fields.date_text
      ? 'فیلدهای رسید استخراج شد؛ نتیجه را بازبینی کنید.'
      : 'رسید خوانده شد اما فیلدهای مالی نیازمند بازبینی هستند.'
  });

  return {
    ...base,
    text,
    critical_text: criticalText,
    critical: {
      ...(base?.critical || {}),
      amount_text: fields.amount_digits && fields.amount_unit
        ? `مبلغ ${fields.amount_digits} ${
            fields.amount_unit === 'rial' ? 'ریال' : 'تومان'
          }`
        : String(base?.critical?.amount_text || ''),
      date_text: fields.date_text
        ? `تاریخ ${fields.date_text}`
        : String(base?.critical?.date_text || ''),
      amount_confidence: fields.amount_confidence ||
        Number(base?.critical?.amount_confidence || 0),
      date_confidence: fields.date_confidence ||
        Number(base?.critical?.date_confidence || 0)
    },
    receipt_fields: fields,
    receipt_pipeline: {
      version: 'v5-reference-receipt',
      targeted_date_regions: true,
      targeted_amount_band: true,
      multi_preprocess: true,
      consensus_amount: true,
      human_review_required: true
    },
    engine: 'tesseract-receipt-reference-v5'
  };
}
