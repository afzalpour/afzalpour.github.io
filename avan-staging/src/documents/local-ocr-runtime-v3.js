'use strict';

import {
  recognizeLocalDocumentV2
} from './local-ocr-runtime-v2.js';

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
        'script[data-avan-tesseract-v3]'
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
      script.dataset.avanTesseractV3 = '1';
      script.onload = finish;
      script.onerror = () =>
        reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return tessPromise;
}

async function downloadBlob(sourceUrl) {
  const response = await fetch(sourceUrl, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('LOCAL_OCR_SOURCE_DOWNLOAD_FAILED');
  }

  return response.blob();
}

function fitSize(
  width,
  height,
  targetWidth = 2300,
  maxPixels = 7000000
) {
  let scale = 1;

  if (width < 1500) {
    scale = Math.min(2.35, targetWidth / width);
  } else if (width > targetWidth) {
    scale = targetWidth / width;
  }

  let w = Math.max(1, Math.round(width * scale));
  let h = Math.max(1, Math.round(height * scale));

  const pixels = w * h;
  if (pixels > maxPixels) {
    const down = Math.sqrt(maxPixels / pixels);
    w = Math.max(1, Math.round(w * down));
    h = Math.max(1, Math.round(h * down));
  }

  return {
    width: w,
    height: h
  };
}

async function imageToCanvas(blob) {
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
      const size = fitSize(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;

      const ctx = canvas.getContext(
        '2d',
        { alpha: false, willReadFrequently: true }
      );

      if (!ctx) {
        throw new Error('LOCAL_OCR_CANVAS_FAILED');
      }

      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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

    const size = fitSize(
      image.naturalWidth,
      image.naturalHeight
    );

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext(
      '2d',
      { alpha: false, willReadFrequently: true }
    );

    if (!ctx) {
      throw new Error('LOCAL_OCR_CANVAS_FAILED');
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function grayscaleCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const g = Math.max(
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

    data[i] = data[i + 1] = data[i + 2] = g;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function percentileStretch(source, lowPct = .012, highPct = .992) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = image.data;
  const hist = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]] += 1;
  }

  const total = canvas.width * canvas.height;
  const lowTarget = total * lowPct;
  const highTarget = total * highPct;

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

  const span = Math.max(28, high - low);

  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(
      0,
      Math.min(
        255,
        Math.round(((data[i] - low) * 255) / span)
      )
    );

    data[i] = data[i + 1] = data[i + 2] = v;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function flattenBackground(source) {
  const small = document.createElement('canvas');
  small.width = Math.max(32, Math.round(source.width / 26));
  small.height = Math.max(32, Math.round(source.height / 26));

  const sctx = small.getContext('2d', { alpha: false });
  if (!sctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(source, 0, 0, small.width, small.height);

  const background = document.createElement('canvas');
  background.width = source.width;
  background.height = source.height;

  const bctx = background.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!bctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(
    small,
    0,
    0,
    background.width,
    background.height
  );

  const sourceCtx = source.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!sourceCtx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  const src = sourceCtx.getImageData(
    0,
    0,
    source.width,
    source.height
  );

  const bg = bctx.getImageData(
    0,
    0,
    background.width,
    background.height
  );

  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;

  const octx = out.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!octx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  const result = octx.createImageData(out.width, out.height);

  for (let i = 0; i < src.data.length; i += 4) {
    const value = Math.max(
      0,
      Math.min(
        255,
        Math.round(176 + src.data[i] - bg.data[i])
      )
    );

    result.data[i] = value;
    result.data[i + 1] = value;
    result.data[i + 2] = value;
    result.data[i + 3] = 255;
  }

  octx.putImageData(result, 0, 0);
  return percentileStretch(out, .008, .995);
}

function otsuThreshold(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  const data = image.data;
  const hist = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]] += 1;
  }

  const total = canvas.width * canvas.height;
  let sum = 0;

  for (let i = 0; i < 256; i += 1) {
    sum += i * hist[i];
  }

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 170;

  for (let i = 0; i < 256; i += 1) {
    weightB += hist[i];
    if (!weightB) continue;

    const weightF = total - weightB;
    if (!weightF) break;

    sumB += i * hist[i];

    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance =
      weightB * weightF * (meanB - meanF) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function cropCanvas(source, topRatio, bottomRatio, leftRatio = 0, rightRatio = 1) {
  const sx = Math.max(0, Math.round(source.width * leftRatio));
  const sy = Math.max(0, Math.round(source.height * topRatio));
  const ex = Math.min(source.width, Math.round(source.width * rightRatio));
  const ey = Math.min(source.height, Math.round(source.height * bottomRatio));

  const width = Math.max(1, ex - sx);
  const height = Math.max(1, ey - sy);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

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

function invertCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) {
    throw new Error('LOCAL_OCR_CANVAS_FAILED');
  }

  ctx.drawImage(source, 0, 0);

  const image = ctx.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  for (let i = 0; i < image.data.length; i += 4) {
    const value = 255 - image.data[i];
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function findAmountBand(source) {
  const preview = document.createElement('canvas');
  const width = 360;
  const height = Math.max(
    120,
    Math.round(source.height * (width / source.width))
  );

  preview.width = width;
  preview.height = height;

  const ctx = preview.getContext(
    '2d',
    { alpha: false, willReadFrequently: true }
  );

  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, width, height);

  const image = ctx.getImageData(0, 0, width, height);
  const fromY = Math.round(height * .56);
  const toY = Math.round(height * .97);
  const rowScores = [];

  for (let y = fromY; y < toY; y += 1) {
    let dark = 0;

    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      if (image.data[index] < 105) dark += 1;
    }

    rowScores.push({
      y,
      ratio: dark / Math.ceil(width / 2)
    });
  }

  const groups = [];
  let current = null;

  for (const row of rowScores) {
    if (row.ratio >= .34) {
      if (!current) {
        current = {
          start: row.y,
          end: row.y,
          score: row.ratio,
          rows: 1
        };
      } else {
        current.end = row.y;
        current.score += row.ratio;
        current.rows += 1;
      }
    } else if (current) {
      groups.push(current);
      current = null;
    }
  }

  if (current) groups.push(current);

  const valid = groups
    .filter(group => group.rows >= Math.max(4, Math.round(height * .012)))
    .sort((a, b) => {
      const scoreA = (a.score / a.rows) * a.rows + a.end / height;
      const scoreB = (b.score / b.rows) * b.rows + b.end / height;
      return scoreB - scoreA;
    });

  const best = valid[0];
  if (!best) return null;

  const pad = Math.max(5, Math.round(height * .025));

  return {
    top: Math.max(.52, (best.start - pad) / height),
    bottom: Math.min(.995, (best.end + pad) / height)
  };
}

function stripBidi(value) {
  return String(value ?? '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ـ/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lineKey(value) {
  return stripBidi(value)
    .toLowerCase()
    .replace(/[\s\-_:،,.\/\\]+/g, '')
    .trim();
}

function usefulLine(value) {
  const text = stripBidi(value);
  if (text.length < 2 || text.length > 180) return false;

  const compact = text.replace(/\s/g, '');
  if (!compact) return false;

  const useful = (
    compact.match(/[\u0600-\u06ff0-9۰-۹]/g) || []
  ).length;

  return useful / compact.length >= .35;
}

function importantLine(value) {
  const text = stripBidi(value);
  return (
    /رسید|خرید|تاریخ|زمان|پایانه|کارتخوان|بانک|پیگیری|مرجع|عملیات|موفق|مبلغ|ریال|تومان/i.test(text) ||
    /(?:13|14|15|19|20|21)\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/.test(
      text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    )
  );
}

function mergeDisplayText(primary, regionTexts = []) {
  const output = [];
  const seen = new Set();

  const add = (line, force = false) => {
    const text = stripBidi(line);
    if (!text || (!force && !usefulLine(text))) return;

    const key = lineKey(text);
    if (!key || seen.has(key)) return;

    seen.add(key);
    output.push(text);
  };

  stripBidi(primary)
    .split(/\r?\n/)
    .forEach(line => add(line));

  for (const regionText of regionTexts) {
    stripBidi(regionText)
      .split(/\r?\n/)
      .filter(importantLine)
      .forEach(line => add(line, true));
  }

  return output.join('\n').slice(0, 12000);
}

function receiptScore(result) {
  const text = stripBidi(result?.data?.text || '');
  const confidence = Number(result?.data?.confidence || 0);

  const keywordCount = (
    text.match(
      /رسید|خرید|تاریخ|زمان|پایانه|کارتخوان|بانک|پیگیری|مرجع|عملیات|موفق|مبلغ|ریال|تومان/gi
    ) || []
  ).length;

  const digitGroups = (
    text.match(/[0-9۰-۹][0-9۰-۹٬,\/\-.]{2,}/g) || []
  ).length;

  const useful = (
    text.match(/[\u0600-\u06ff0-9۰-۹]/g) || []
  ).length;

  return (
    confidence +
    Math.min(36, keywordCount * 4.5) +
    Math.min(18, digitGroups * 1.8) +
    Math.min(12, useful / 24)
  );
}

function criticalFromText(text) {
  const lines = stripBidi(text)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const datePattern =
    /(?:13|14|15|19|20|21)[0-9۰-۹]{2}[\/\-.][0-9۰-۹]{1,2}[\/\-.][0-9۰-۹]{1,2}|تاریخ|زمان|date|time/i;

  const amountPattern =
    /مبلغ|جمع|قابل\s*پرداخت|ریال|تومان|total|amount|rial|toman/i;

  return {
    date_text: lines
      .filter(line => datePattern.test(line))
      .slice(0, 12)
      .join('\n'),

    amount_text: lines
      .filter(line => amountPattern.test(line))
      .slice(-12)
      .join('\n')
  };
}

async function createWorker(onProgress) {
  const tess = await loadTesseract();

  let passBase = .08;
  let passSpan = .20;
  let passMessage = 'در حال خواندن رسید…';

  const worker = await tess.createWorker(
    ['fas', 'eng'],
    1,
    {
      logger: message => {
        if (typeof message?.progress !== 'number') return;

        report(onProgress, {
          phase: 'ocr',
          progress: Math.min(
            .98,
            passBase + message.progress * passSpan
          ),
          status: message.status || '',
          message: passMessage
        });
      }
    }
  );

  return {
    worker,
    setStage(base, span, message) {
      passBase = base;
      passSpan = span;
      passMessage = message;
    }
  };
}

async function recognizePass(
  worker,
  canvas,
  psm,
  extra = {}
) {
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
    ...extra
  });

  return worker.recognize(canvas);
}

async function recognizeReceiptImage(blob, onProgress) {
  report(onProgress, {
    phase: 'preprocess',
    progress: .02,
    message: 'در حال آماده‌سازی مخصوص رسید حرارتی…'
  });

  const original = await imageToCanvas(blob);
  const gray = grayscaleCanvas(original);
  const stretched = percentileStretch(gray);
  const flat = flattenBackground(stretched);
  const binary = otsuThreshold(flat);

  const middle = cropCanvas(flat, .34, .76);
  const amountBand = findAmountBand(stretched);

  const amountRegion = amountBand
    ? cropCanvas(stretched, amountBand.top, amountBand.bottom)
    : cropCanvas(stretched, .69, .94);

  const amountInverted = invertCanvas(amountRegion);

  const session = await createWorker(onProgress);
  const { worker } = session;

  try {
    session.setStage(
      .10,
      .22,
      'در حال خواندن ساختار اصلی رسید…'
    );
    const fullBlock = await recognizePass(worker, flat, 6);

    session.setStage(
      .33,
      .20,
      'در حال کنترل متن‌های پراکنده و شماره‌ها…'
    );
    const fullSparse = await recognizePass(worker, binary, 11);

    session.setStage(
      .54,
      .19,
      'در حال خواندن تاریخ، پایانه و شماره پیگیری…'
    );
    const middleResult = await recognizePass(worker, middle, 6);

    session.setStage(
      .74,
      .22,
      'در حال خواندن ناحیه مبلغ…'
    );
    const amountResult = await recognizePass(worker, amountInverted, 6);

    const main =
      receiptScore(fullBlock) >= receiptScore(fullSparse)
        ? fullBlock
        : fullSparse;

    const primaryText = stripBidi(main?.data?.text || '');
    const middleText = stripBidi(middleResult?.data?.text || '');
    let amountText = stripBidi(amountResult?.data?.text || '');

    if (
      amountText &&
      !/ریال|تومان/i.test(amountText) &&
      /ریال/i.test(primaryText)
    ) {
      amountText = `${amountText}\nریال`;
    }

    const displayText = mergeDisplayText(
      primaryText,
      [middleText, amountText]
    );

    const fallbackCritical = criticalFromText(displayText);

    const dateText = [
      criticalFromText(middleText).date_text,
      fallbackCritical.date_text
    ]
      .filter(Boolean)
      .join('\n');

    const amountCritical = [
      amountText,
      fallbackCritical.amount_text
    ]
      .filter(Boolean)
      .join('\n');

    report(onProgress, {
      phase: 'done',
      progress: 1,
      message: 'خواندن رسید انجام شد؛ نتیجه آماده بازبینی است.'
    });

    return {
      text: displayText,
      confidence: Number(main?.data?.confidence || 0),
      critical_text: [dateText, amountCritical]
        .filter(Boolean)
        .join('\n'),
      critical: {
        date_text: dateText.slice(0, 2600),
        date_confidence: Number(
          middleResult?.data?.confidence ||
          main?.data?.confidence ||
          0
        ),
        amount_text: amountCritical.slice(0, 2600),
        amount_confidence: Number(
          amountResult?.data?.confidence ||
          main?.data?.confidence ||
          0
        )
      },
      pages: 1,
      truncated: false,
      engine: 'tesseract-browser-receipt-v3',
      languages: ['fas', 'eng'],
      receipt_pipeline: {
        background_flattening: true,
        amount_band_detection: Boolean(amountBand),
        dark_band_inversion: true,
        region_ocr: true,
        bidi_cleanup: true
      }
    };
  } finally {
    await worker.terminate();
  }
}

function isReceiptLike(documentType) {
  return [
    'receipt',
    'bank_slip'
  ].includes(String(documentType || ''));
}

export async function recognizeLocalDocumentV3({
  sourceUrl,
  mimeType,
  fileName = '',
  documentType = '',
  maxPages = 4,
  onProgress = null
} = {}) {
  if (!sourceUrl) {
    throw new Error('LOCAL_OCR_SOURCE_REQUIRED');
  }

  const type = String(mimeType || '').toLowerCase();

  if (
    type === 'application/pdf' ||
    !isReceiptLike(documentType)
  ) {
    return recognizeLocalDocumentV2({
      sourceUrl,
      mimeType,
      fileName,
      maxPages,
      onProgress
    });
  }

  if (!type.startsWith('image/')) {
    return recognizeLocalDocumentV2({
      sourceUrl,
      mimeType,
      fileName,
      maxPages,
      onProgress
    });
  }

  const blob = await downloadBlob(sourceUrl);
  return recognizeReceiptImage(blob, onProgress);
}
