'use strict';

import { toast } from './src/ui/feedback/toast.js';

const PRINTABLE_PAGES = new Set([
  'گزارش‌ها',
  'فاکتورها',
  'اسناد حسابداری'
]);

let scheduled = null;

function text(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPersianDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function currentPageTitle() {
  return text(document.getElementById('pageTitle')?.textContent);
}

function localizePrintDigits(root) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    node.nodeValue = toPersianDigits(node.nodeValue);
  });
}

function printableClone(source) {
  const clone = source.cloneNode(true);

  const naturalForm = clone.querySelector('#nlReportForm');
  naturalForm?.closest('.card')?.remove();

  clone.querySelectorAll([
    '.avan-export-toolbar',
    '.report-toolbar',
    '.tabs',
    '.form-actions',
    '.row-actions',
    'button',
    'script',
    'style',
    '[hidden]'
  ].join(',')).forEach(node => node.remove());

  clone.querySelectorAll('input,select,textarea').forEach(control => {
    const replacement = document.createElement('span');
    replacement.textContent = toPersianDigits(control.value || '—');
    control.replaceWith(replacement);
  });

  localizePrintDigits(clone);
  return clone;
}

function printCss() {
  return `
    @page{size:A4;margin:12mm}
    *{box-sizing:border-box}
    html{direction:rtl}
    body{
      margin:0;
      color:#211f2b;
      background:#fff;
      font-family:'Vazirmatn',Tahoma,Arial,sans-serif;
      font-size:11px;
      line-height:1.75;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .avan-print-shell{max-width:190mm;margin:0 auto}
    .avan-print-header{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:12px;
      padding-bottom:8px;
      margin-bottom:12px;
      border-bottom:1.5px solid #302b68;
    }
    .avan-print-brand{font-size:20px;font-weight:800;color:#302b68}
    .avan-print-title{font-size:14px;font-weight:750}
    .avan-print-meta{font-size:9px;color:#777;white-space:nowrap}
    h1,h2,h3{color:#2d2938;margin:8px 0}
    h2{font-size:15px}h3{font-size:13px}
    table{width:100%;border-collapse:collapse;margin:8px 0 12px;page-break-inside:auto}
    thead{display:table-header-group}
    tr{page-break-inside:avoid;page-break-after:auto}
    th,td{border:1px solid #d8d1c6;padding:5px 6px;text-align:right;vertical-align:top}
    th{background:#f3eee6;font-weight:750;text-align:center;vertical-align:middle}
    .avan-detail-print table th,
    .avan-detail-print table td{text-align:center;vertical-align:middle}
    td.num,.num{font-variant-numeric:tabular-nums;white-space:nowrap}
    .grid4,.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0}
    .card{border:1px solid #ddd4c8;border-radius:8px;padding:9px;background:#fff;page-break-inside:avoid}
    .kpi-label{font-size:9px;color:#746f7f;margin-bottom:3px}
    .kpi-value{font-size:15px;font-weight:800}
    .section{margin-top:10px}
    .summary-strip{display:flex;flex-wrap:wrap;gap:6px}
    .summary-pill,.badge{border:1px solid #d8d1c6;border-radius:999px;padding:2px 7px;display:inline-block}
    .pos{color:#176d55}.neg{color:#a83c48}.warn{color:#98641e}
    .muted{color:#746f7f}
    .info-box,.error-box,.success-box{border:1px solid #ddd4c8;border-radius:7px;padding:7px;margin:8px 0;background:#faf7f2}
    a{color:inherit;text-decoration:none}
    .avan-doc-viewer-stage{background:#fff!important;border:0!important;padding:0!important;overflow:visible!important;max-height:none!important;min-height:0!important}
    .avan-doc-viewer-image{max-width:100%!important;height:auto!important;width:auto!important;transform:none!important;box-shadow:none!important}
    .avan-doc-viewer-pdf-canvas{max-width:100%!important;height:auto!important;box-shadow:none!important}
  `;
}

function openPrintWindow(source, title) {
  const popup = window.open('', '_blank');
  if (!popup) {
    toast('مرورگر پنجره چاپ را مسدود کرد. اجازه Pop-up را برای آوان فعال کنید.');
    return false;
  }

  try {
    popup.opener = null;
  } catch {
    // Best-effort opener isolation.
  }

  const clone = printableClone(source);
  const now = new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date());

  const detail = /^(فاکتور|سند\s)/.test(text(title));
  const localizedTitle = toPersianDigits(title);

  popup.document.open();
  popup.document.write(`<!doctype html>
    <html lang="fa" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>${escapeHtml(localizedTitle)}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vazirmatn@33.0.3/Vazirmatn-Variable-font-face.css">
        <style>${printCss()}</style>
      </head>
      <body>
        <main class="avan-print-shell ${detail ? 'avan-detail-print' : ''}">
          <header class="avan-print-header">
            <div>
              <div class="avan-print-brand">آوان</div>
              ${detail ? '' : `<div class="avan-print-title">${escapeHtml(localizedTitle)}</div>`}
            </div>
            <div class="avan-print-meta">${escapeHtml(toPersianDigits(now))}</div>
          </header>
          ${clone.outerHTML}
        </main>
      </body>
    </html>`);
  popup.document.close();

  window.setTimeout(() => {
    try {
      popup.focus();
      popup.print();
    } catch {
      // User can still print from the opened window.
    }
  }, 350);

  return true;
}

function csvCell(value) {
  const normalized = text(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function tableRows(table) {
  return [...table.querySelectorAll('tr')].map(row =>
    [...row.querySelectorAll('th,td')].map(cell => csvCell(cell.innerText))
  );
}

function reportCsvRows(root) {
  const rows = [];
  const tables = [...root.querySelectorAll('table')]
    .filter(table => !table.closest('.avan-doc-viewer'));

  tables.forEach((table, index) => {
    if (index) rows.push([]);
    rows.push(...tableRows(table));
  });

  if (rows.length) return rows;

  const cards = [...root.querySelectorAll('.grid4 > .card,.grid2 > .card')];
  const metrics = cards.map(card => {
    const label = text(card.querySelector('.kpi-label')?.textContent);
    const value = text(card.querySelector('.kpi-value')?.textContent);
    return label ? [csvCell(label), csvCell(value)] : null;
  }).filter(Boolean);

  if (metrics.length) {
    return [
      [csvCell('شاخص'), csvCell('مقدار')],
      ...metrics
    ];
  }

  return [];
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportCurrentReportCsv() {
  const content = document.getElementById('content');
  if (!content) return;

  const rows = reportCsvRows(content);
  if (!rows.length) {
    toast('برای این نمای گزارش، داده جدولی قابل خروجی وجود ندارد.');
    return;
  }

  const csv = '\uFEFF' + rows.map(row => row.join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    `avan-report-${stamp}.csv`
  );
  toast('خروجی CSV آماده شد.');
}

function ensurePageToolbar() {
  const page = currentPageTitle();
  if (!PRINTABLE_PAGES.has(page)) return;

  const content = document.getElementById('content');
  if (!content || content.querySelector(':scope > .avan-export-toolbar')) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'avan-export-toolbar card';

  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'ghost';
  print.textContent = page === 'گزارش‌ها'
    ? 'چاپ / ذخیره PDF'
    : 'چاپ فهرست / PDF';
  print.onclick = () => openPrintWindow(content, page);
  toolbar.appendChild(print);

  if (page === 'گزارش‌ها') {
    const csv = document.createElement('button');
    csv.type = 'button';
    csv.className = 'ghost';
    csv.textContent = 'خروجی CSV';
    csv.onclick = exportCurrentReportCsv;
    toolbar.appendChild(csv);
  }

  const hint = document.createElement('span');
  hint.className = 'muted avan-export-hint';
  hint.textContent = 'در پنجره چاپ می‌توانید «Save as PDF / ذخیره به PDF» را انتخاب کنید.';
  toolbar.appendChild(hint);

  content.prepend(toolbar);
}

function isPrintableDetailModal(modal) {
  if (!modal || modal.hidden || modal.querySelector('form')) return false;
  if (modal.classList.contains('avan-doc-viewer-modal')) return false;

  const heading = text(modal.querySelector('h2')?.textContent);
  if (!heading || !modal.querySelector('table')) return false;

  return heading.startsWith('فاکتور') || heading.startsWith('سند ');
}

function ensureDetailPrintButton() {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  if (!backdrop || backdrop.hidden || !isPrintableDetailModal(modal)) return;
  if (modal.querySelector('[data-avan-print-detail]')) return;

  const actions = modal.querySelector('.form-actions');
  if (!actions) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.dataset.avanPrintDetail = '1';
  button.textContent = 'چاپ / ذخیره PDF';
  button.onclick = () => {
    const title = text(modal.querySelector('h2')?.textContent) || 'سند آوان';
    openPrintWindow(modal, title);
  };

  actions.prepend(button);
}

async function downloadOriginal(link, fileName) {
  try {
    const response = await fetch(link.href, { cache: 'no-store' });
    if (!response.ok) throw new Error('DOCUMENT_DOWNLOAD_FAILED');
    const blob = await response.blob();
    downloadBlob(blob, fileName || 'avan-document');
    toast('اصل فایل برای دانلود آماده شد.');
  } catch (error) {
    console.error('AVAN_DOCUMENT_DOWNLOAD_FAILED', error);
    window.open(link.href, '_blank', 'noopener,noreferrer');
    toast('دانلود مستقیم ممکن نشد؛ اصل فایل در تب جدید باز شد.');
  }
}

function ensureDocumentViewerActions() {
  const modal = document.getElementById('modal');
  if (!modal?.classList.contains('avan-doc-viewer-modal')) return;

  const original = modal.querySelector('.avan-doc-original-link');
  const actions = modal.querySelector('.avan-doc-viewer-head .row-actions');
  if (!original || !actions) return;

  if (!actions.querySelector('[data-avan-download-original]')) {
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'ghost small';
    download.dataset.avanDownloadOriginal = '1';
    download.textContent = 'دانلود اصل فایل';
    download.onclick = () => {
      const name = text(modal.querySelector('.avan-doc-viewer-name')?.textContent) || 'avan-document';
      downloadOriginal(original, name);
    };
    actions.insertBefore(download, original);
  }

  if (!actions.querySelector('[data-avan-print-original]')) {
    const print = document.createElement('button');
    print.type = 'button';
    print.className = 'primary small';
    print.dataset.avanPrintOriginal = '1';
    print.textContent = 'چاپ اصل سند';
    print.onclick = () => {
      const kind = modal.querySelector('.avan-doc-viewer')?.dataset.viewerKind;
      const name = text(modal.querySelector('.avan-doc-viewer-name')?.textContent) || 'اصل سند';

      if (kind === 'pdf') {
        window.open(original.href, '_blank', 'noopener,noreferrer');
        toast('PDF در تب جدید باز شد؛ از گزینه چاپ مرورگر برای چاپ یا ذخیره PDF استفاده کنید.');
        return;
      }

      const stage = modal.querySelector('.avan-doc-viewer-stage');
      if (stage) openPrintWindow(stage, name);
    };
    actions.insertBefore(print, original);
  }
}

function apply() {
  ensurePageToolbar();
  ensureDetailPrintButton();
  ensureDocumentViewerActions();
}

function schedule() {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = null;
    apply();
  }, 80);
}

function install() {
  apply();
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });
  document.addEventListener('click', schedule, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanPrintExport = Object.freeze({
  printElement: openPrintWindow,
  exportCurrentReportCsv
});
