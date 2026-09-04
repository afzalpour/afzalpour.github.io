'use strict';

const TESSERACT_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
const PDFJS_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.min.mjs';
const PDF_WORKER_URL =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs';

let tessPromise = null;
let pdfPromise = null;

function report(cb, value) {
  if (typeof cb === 'function') cb(value);
}

function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) {
    return Promise.resolve(globalThis.Tesseract);
  }

  if (!tessPromise) {
    tessPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-avan-tesseract-v2]');
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
      script.dataset.avanTesseractV2 = '1';
      script.onload = finish;
      script.onerror = () => reject(new Error('LOCAL_OCR_RUNTIME_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }

  return tessPromise;
}

async function loadPdfJs() {
  if (!pdfPromise) {
    pdfPromise = import(PDFJS_URL).then(module => {
      module.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
      return module;
    });
  }
  return pdfPromise;
}

async function downloadBlob(sourceUrl) {
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('LOCAL_OCR_SOURCE_DOWNLOAD_FAILED');
  return response.blob();
}

function fitSize(width, height, targetWidth = 2200, maxPixels = 8000000) {
  let scale = 1;
  if (width < 1500) scale = Math.min(2.5, targetWidth / width);
  else if (width > targetWidth) scale = targetWidth / width;

  let w = Math.max(1, Math.round(width * scale));
  let h = Math.max(1, Math.round(height * scale));
  const pixels = w * h;
  if (pixels > maxPixels) {
    const down = Math.sqrt(maxPixels / pixels);
    w = Math.max(1, Math.round(w * down));
    h = Math.max(1, Math.round(h * down));
  }
  return { width: w, height: h };
}

async function imageToCanvas(blob) {
  let bitmap = null;
  try {
    if (globalThis.createImageBitmap) {
      try {
        bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      } catch {
        bitmap = await createImageBitmap(blob);
      }
    }

    if (bitmap) {
      const size = fitSize(bitmap.width, bitmap.height);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
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
    const size = fitSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function contrastCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const hist = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const g = Math.max(0, Math.min(255, Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114)));
    hist[g]++;
    data[i] = data[i + 1] = data[i + 2] = g;
  }

  const total = canvas.width * canvas.height;
  const lowTarget = total * .02;
  const highTarget = total * .98;
  let sum = 0, low = 0, high = 255;
  for (let i = 0; i < 256; i++) {
    sum += hist[i];
    if (sum >= lowTarget) { low = i; break; }
  }
  sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist[i];
    if (sum >= highTarget) { high = i; break; }
  }
  const span = Math.max(24, high - low);
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((data[i] - low) * 255) / span));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function otsuThreshold(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++;

  const total = canvas.width * canvas.height;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, weightB = 0, maxVar = 0, threshold = 170;
  for (let i = 0; i < 256; i++) {
    weightB += hist[i];
    if (!weightB) continue;
    const weightF = total - weightB;
    if (!weightF) break;
    sumB += i * hist[i];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) ** 2;
    if (variance > maxVar) {
      maxVar = variance;
      threshold = i;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function usefulScore(result) {
  const text = String(result?.data?.text || '').trim();
  const confidence = Number(result?.data?.confidence || 0);
  const useful = (text.match(/[\u0600-\u06FF0-9۰-۹]/g) || []).length;
  const keywords = (text.match(/مبلغ|جمع|ریال|تومان|تاریخ|فاکتور|رسید|total|amount|invoice|date/gi) || []).length;
  return confidence + Math.min(25, useful / 10) + Math.min(15, keywords * 2);
}

async function createWorker(onProgress) {
  const tess = await loadTesseract();
  report(onProgress, { phase: 'loading', progress: 0, message: 'در حال بارگذاری موتور تشخیص متن…' });
  return tess.createWorker(['fas', 'eng'], 1, {
    logger: msg => {
      if (typeof msg?.progress === 'number') {
        report(onProgress, { phase: 'ocr', progress: msg.progress, status: msg.status || '' });
      }
    }
  });
}

async function recognizePass(worker, canvas, psm) {
  await worker.setParameters({
    tessedit_pageseg_mode: String(psm),
    preserve_interword_spaces: '1',
    user_defined_dpi: '300'
  });
  return worker.recognize(canvas);
}

function criticalFromText(text) {
  const lines = String(text || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const datePattern = /(?:13|14|15|19|20|21)\d{2}[\/\-.]\d{1,2}[\/\-.]\d{1,2}|تاریخ|date/i;
  const amountPattern = /مبلغ|جمع|قابل\s*پرداخت|ریال|تومان|total|amount|rial|toman/i;
  const dateLines = lines.filter(line => datePattern.test(line)).slice(0, 10);
  const amountLines = lines.filter(line => amountPattern.test(line)).slice(-12);
  return {
    date_text: dateLines.join('\n'),
    amount_text: amountLines.join('\n')
  };
}

async function recognizeImageBlob(blob, onProgress) {
  report(onProgress, { phase: 'preprocess', progress: 0, message: 'در حال اصلاح جهت و کیفیت تصویر…' });
  const original = await imageToCanvas(blob);
  const gray = contrastCanvas(original);
  const binary = otsuThreshold(gray);
  const worker = await createWorker(onProgress);

  try {
    report(onProgress, { phase: 'ocr', progress: .05, message: 'در حال خواندن متن اصلی…' });
    const block = await recognizePass(worker, gray, 6);
    report(onProgress, { phase: 'ocr', progress: .55, message: 'در حال کنترل متن‌های پراکنده و اعداد…' });
    const sparse = await recognizePass(worker, binary, 11);
    const best = usefulScore(block) >= usefulScore(sparse) ? block : sparse;
    const alternate = best === block ? sparse : block;
    let text = String(best?.data?.text || '').trim();
    const altText = String(alternate?.data?.text || '').trim();
    if (altText && altText !== text) text = `${text}\n${altText}`.trim();
    const critical = criticalFromText(text);

    return {
      text,
      confidence: Number(best?.data?.confidence || 0),
      critical_text: [critical.date_text, critical.amount_text].filter(Boolean).join('\n'),
      critical: {
        ...critical,
        date_confidence: Number(best?.data?.confidence || 0),
        amount_confidence: Number(best?.data?.confidence || 0)
      },
      pages: 1,
      truncated: false,
      engine: 'tesseract-browser-v2',
      languages: ['fas', 'eng']
    };
  } finally {
    await worker.terminate();
  }
}

function embeddedTextQuality(text) {
  const compact = String(text || '').replace(/\s/g, '');
  if (!compact) return 0;
  const useful = (compact.match(/[\u0600-\u06FF0-9A-Za-z]/g) || []).length;
  return useful / compact.length;
}

async function pdfEmbeddedText(pdf, maxPages) {
  const pageCount = Math.min(pdf.numPages, maxPages);
  const chunks = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    chunks.push(content.items.map(item => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('').trim());
  }
  return {
    text: chunks.filter(Boolean).join('\n'),
    pages: pageCount,
    truncated: pdf.numPages > pageCount
  };
}

async function renderPdfPage(page) {
  const viewport = page.getViewport({ scale: 2.2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error('LOCAL_OCR_CANVAS_FAILED');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return contrastCanvas(canvas);
}

async function recognizePdfBlob(blob, onProgress, maxPages) {
  const pdfjs = await loadPdfJs();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const embedded = await pdfEmbeddedText(pdf, maxPages);

  if (embedded.text.length >= 40 && embeddedTextQuality(embedded.text) >= .55) {
    const critical = criticalFromText(embedded.text);
    report(onProgress, { phase: 'done', progress: 1, message: 'متن PDF مستقیماً و با کیفیت بالا خوانده شد.' });
    return {
      text: embedded.text,
      confidence: 98,
      critical_text: [critical.date_text, critical.amount_text].filter(Boolean).join('\n'),
      critical: { ...critical, date_confidence: 98, amount_confidence: 98 },
      pages: embedded.pages,
      truncated: embedded.truncated,
      engine: 'pdf-text-v2',
      languages: ['fas', 'eng']
    };
  }

  const worker = await createWorker(onProgress);
  const texts = [];
  const confidences = [];
  const pageCount = Math.min(pdf.numPages, maxPages);

  try {
    for (let i = 1; i <= pageCount; i++) {
      report(onProgress, { phase: 'rendering', progress: (i - 1) / pageCount, page: i, pages: pageCount, message: `در حال آماده‌سازی صفحه ${i}…` });
      const page = await pdf.getPage(i);
      const gray = await renderPdfPage(page);
      const result = await recognizePass(worker, gray, 6);
      texts.push(String(result?.data?.text || '').trim());
      confidences.push(Number(result?.data?.confidence || 0));
    }
  } finally {
    await worker.terminate();
  }

  const text = texts.filter(Boolean).join('\n');
  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;
  const critical = criticalFromText(text);
  return {
    text,
    confidence,
    critical_text: [critical.date_text, critical.amount_text].filter(Boolean).join('\n'),
    critical: { ...critical, date_confidence: confidence, amount_confidence: confidence },
    pages: pageCount,
    truncated: pdf.numPages > pageCount,
    engine: 'tesseract-pdf-v2',
    languages: ['fas', 'eng']
  };
}

export async function recognizeLocalDocumentV2({
  sourceUrl,
  mimeType,
  fileName,
  onProgress,
  maxPages = 4
} = {}) {
  if (!sourceUrl) throw new Error('LOCAL_OCR_SOURCE_REQUIRED');
  const blob = await downloadBlob(sourceUrl);
  const pdf = String(mimeType || '') === 'application/pdf' || /\.pdf$/i.test(String(fileName || ''));

  const result = pdf
    ? await recognizePdfBlob(blob, onProgress, maxPages)
    : await recognizeImageBlob(blob, onProgress);

  if (!String(result?.text || '').trim()) throw new Error('LOCAL_OCR_TEXT_EMPTY');
  report(onProgress, { phase: 'done', progress: 1, message: 'استخراج متن انجام شد.' });
  return result;
}
