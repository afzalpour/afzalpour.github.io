'use strict';

import {
  installAvanCloud
} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import {
  createDocumentService
} from './src/documents/document-service.js';
import {
  buildLocalOcrExtraction
} from './src/documents/local-ocr-extraction.js';
import {
  recognizeLocalDocumentV4
} from './src/documents/local-ocr-runtime-v4.js';
import {
  openDocumentViewer
} from './src/ui/documents/document-viewer-v2.js';
import {
  openModal,
  closeModal
} from './src/ui/components/modal.js';
import {
  toast
} from './src/ui/feedback/toast.js';

const cloud = installAvanCloud();
const documents = createDocumentService(cloud);
const RETURN_PAGE_KEY = 'avan.rc12c.return_page';
let activeReviewDocumentId = null;
let extractionBusy = false;

function esc(value) {
  return String(value ?? '')
    .replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]);
}

function rememberDocumentsPage() {
  try {
    window.sessionStorage?.setItem(
      RETURN_PAGE_KEY,
      'documents'
    );
  } catch {
    // Navigation preference must never block OCR persistence.
  }
}

function restoreDocumentsPageAfterRefresh() {
  let shouldRestore = false;

  try {
    shouldRestore =
      window.sessionStorage?.getItem(RETURN_PAGE_KEY) === 'documents';
  } catch {
    shouldRestore = false;
  }

  if (!shouldRestore) return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;

    const shell = document.getElementById('appShell');
    const button = document.querySelector(
      '#nav [data-page="documents"]'
    );

    if (shell && !shell.hidden && button) {
      window.clearInterval(timer);

      try {
        window.sessionStorage?.removeItem(RETURN_PAGE_KEY);
      } catch {
        // Ignore unavailable session storage.
      }

      window.setTimeout(() => {
        button.click();
      }, 80);

      return;
    }

    if (attempts >= 100) {
      window.clearInterval(timer);
    }
  }, 100);
}

function structuredReceiptDescription(item, ocr) {
  const fields = ocr?.receipt_fields;
  if (!fields || typeof fields !== 'object') return '';

  const parts = [
    item?.document_type === 'bank_slip'
      ? 'رسید بانکی'
      : 'رسید کارتخوان'
  ];

  parts.push(
    fields.success
      ? 'عملیات موفق'
      : 'نیازمند بازبینی'
  );

  const reference = String(fields.reference || '').trim();
  if (/^\d{6,22}$/.test(reference)) {
    parts.push(`پیگیری/مرجع ${reference}`);
  }

  return parts.join(' — ');
}

async function documentById(id) {
  const rows = await cloud.select(
    'documents',
    `select=*&id=eq.${encodeURIComponent(id)}&limit=1`
  );

  const item = rows?.[0];
  if (!item?.id) {
    throw new Error('DOCUMENT_NOT_FOUND');
  }
  return item;
}

async function openViewer(id) {
  const item = await documentById(id);
  const sourceUrl = await documents.signedUrl(item, 900);
  await openDocumentViewer({
    sourceUrl,
    mimeType: item.mime_type,
    fileName: item.file_name
  });
}

function progressModal(fileName) {
  openModal(`
    <div class="avan-ocr-progress">
      <h2>استخراج هوشمند سند</h2>
      <div class="muted">${esc(fileName || 'فایل سند')}</div>
      <div class="avan-ocr-progress-track section">
        <div class="avan-ocr-progress-bar" id="avanOcrProgressBar"></div>
      </div>
      <div id="avanOcrProgressText" class="section">در حال آماده‌سازی…</div>
      <div id="avanOcrProgressMeta" class="muted"></div>
      <div class="form-actions" id="avanOcrProgressActions" hidden>
        <button type="button" class="ghost" id="avanOcrClose">بستن</button>
      </div>
    </div>
  `);
}

function setProgress(value = {}) {
  const bar = document.getElementById('avanOcrProgressBar');
  const text = document.getElementById('avanOcrProgressText');
  const meta = document.getElementById('avanOcrProgressMeta');
  const raw = Number(value.progress ?? 0);
  const percent = Number.isFinite(raw)
    ? Math.max(0, Math.min(100, Math.round(raw * 100)))
    : 0;

  if (bar) bar.style.width = `${percent}%`;
  if (text && value.message) text.textContent = value.message;
  if (meta) {
    meta.textContent = value.page && value.pages
      ? `صفحه ${value.page} از ${value.pages}`
      : value.status || '';
  }
}

function showOcrError(error) {
  console.error('AVAN_RC12C_OCR_FAILED', error);
  const text = document.getElementById('avanOcrProgressText');
  const actions = document.getElementById('avanOcrProgressActions');
  if (text) {
    text.innerHTML = `
      <div class="error-box">
        استخراج متن انجام نشد. اصل فایل محفوظ است و می‌توانید دوباره تلاش کنید.
      </div>
    `;
  }
  if (actions) actions.hidden = false;
  const close = document.getElementById('avanOcrClose');
  if (close) close.onclick = closeModal;
}

async function runExtraction(id, button) {
  if (extractionBusy) return;
  extractionBusy = true;
  if (button) button.disabled = true;

  try {
    const item = await documentById(id);
    if (item.status !== 'uploaded') {
      throw new Error('DOCUMENT_STATUS_NOT_EXTRACTABLE');
    }

    progressModal(item.file_name);
    const sourceUrl = await documents.signedUrl(item, 1200);

    const [parties, accounts, ocr] = await Promise.all([
      cloud.select(
        'parties',
        `select=*&workspace_id=eq.${item.workspace_id}&order=name.asc`
      ),
      cloud.select(
        'accounts',
        `select=*&workspace_id=eq.${item.workspace_id}&order=code.asc`
      ),
      recognizeLocalDocumentV4({
        sourceUrl,
        mimeType: item.mime_type,
        fileName: item.file_name,
        documentType: item.document_type,
        maxPages: 4,
        onProgress: setProgress
      })
    ]);

    const extraction = buildLocalOcrExtraction({
      document: item,
      ocr,
      parties: parties || [],
      accounts: accounts || []
    });

    const receiptDescription = structuredReceiptDescription(item, ocr);
    if (receiptDescription) {
      extraction.description = receiptDescription;
      extraction.receipt_fields = ocr.receipt_fields;
    }

    extraction.local_ocr = {
      ...(extraction.local_ocr || {}),
      pipeline: String(ocr?.engine || '').includes('receipt-structured-v4')
        ? 'rc1.2-c3-structured-receipt-v4'
        : String(ocr?.engine || '').includes('receipt-v3')
          ? 'rc1.2-c2-receipt-v3'
          : 'rc1.2-c-v2',
      viewer_first: true,
      receipt_pipeline:
        ocr?.receipt_pipeline ||
        undefined
    };

    const updated = await documents.saveLocalExtraction({
      document: item,
      extraction
    });

    if (!updated?.id || updated.status !== 'extracted') {
      throw new Error('LOCAL_OCR_SAVE_FAILED');
    }

    setProgress({
      progress: 1,
      message: 'استخراج انجام شد؛ نتیجه برای بازبینی انسانی آماده است.'
    });

    toast('استخراج سند انجام شد.');
    rememberDocumentsPage();

    window.setTimeout(
      () => window.location.reload(),
      700
    );
  } catch (error) {
    showOcrError(error);
  } finally {
    extractionBusy = false;
    if (button?.isConnected) button.disabled = false;
  }
}

function intercept(event) {
  const review = event.target.closest?.('[data-review-document]');
  if (review?.dataset.reviewDocument) {
    activeReviewDocumentId = review.dataset.reviewDocument;
  }

  const sourceButton = event.target.closest?.('#viewSourceDocumentBtn');
  if (sourceButton && activeReviewDocumentId) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openViewer(activeReviewDocumentId).catch(error => {
      console.error('AVAN_DOCUMENT_VIEWER_FAILED', error);
      toast('نمایش فایل انجام نشد.');
    });
    return;
  }

  const view = event.target.closest?.('[data-view-document]');
  if (view?.dataset.viewDocument) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openViewer(view.dataset.viewDocument).catch(error => {
      console.error('AVAN_DOCUMENT_VIEWER_FAILED', error);
      toast('نمایش فایل انجام نشد.');
    });
    return;
  }

  const extract = event.target.closest?.('[data-extract-document]');
  if (extract?.dataset.extractDocument) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runExtraction(
      extract.dataset.extractDocument,
      extract
    );
  }
}

document.addEventListener('click', intercept, true);

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    restoreDocumentsPageAfterRefresh,
    { once: true }
  );
} else {
  restoreDocumentsPageAfterRefresh();
}
