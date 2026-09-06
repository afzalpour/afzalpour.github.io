'use strict';

// RC1.3-D Live Gate recovery layer.
// The shared RC1.2 print engine remains the single print implementation.
// This module only restores deterministic UI controls when the legacy
// MutationObserver injector misses a desktop render/modal transition.

const PRINTABLE_KEYS = new Set(['reports', 'invoices', 'journal']);
const TITLE_BY_KEY = Object.freeze({
  reports: 'گزارش‌ها',
  invoices: 'فاکتورها',
  journal: 'اسناد حسابداری'
});

let scheduled = null;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function activePageKey() {
  const desktop = document.querySelector('.sidebar [data-page].active')?.dataset?.page;
  if (desktop) return desktop;

  const title = text(document.getElementById('pageTitle')?.textContent);
  return Object.entries(TITLE_BY_KEY).find(([, value]) => value === title)?.[0] || '';
}

function printEngine() {
  return window.AvanPrintExport?.printElement || null;
}

function prepareOutput() {
  try {
    window.AvanOutputIntegrity?.prepare?.();
  } catch (error) {
    console.warn('[Avan print recovery] output preparation failed', error);
  }
}

function runPrint(source, title) {
  prepareOutput();
  const print = printEngine();
  if (typeof print === 'function') {
    return print(source, title);
  }

  console.error('[Avan print recovery] shared print engine unavailable');
  window.alert('ماژول چاپ هنوز بارگذاری نشده است. یک Hard Refresh انجام دهید و دوباره تلاش کنید.');
  return false;
}

function ensureListPrintControl() {
  const key = activePageKey();
  if (!PRINTABLE_KEYS.has(key)) return;

  const content = document.getElementById('content');
  if (!content) return;

  const existing = content.querySelector(':scope > .avan-export-toolbar');
  if (existing) {
    existing.hidden = false;
    existing.dataset.desktopPrintVerified = '1';
    return;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'avan-export-toolbar card';
  toolbar.dataset.avanPrintRecovery = '1';
  toolbar.dataset.desktopPrintVerified = '1';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost';
  button.dataset.avanPrintList = '1';
  button.textContent = key === 'reports' ? 'چاپ / ذخیره PDF' : 'چاپ فهرست / PDF';
  button.addEventListener('click', () => {
    const title = text(document.getElementById('pageTitle')?.textContent) || TITLE_BY_KEY[key];
    runPrint(content, title);
  });
  toolbar.appendChild(button);

  if (key === 'reports' && typeof window.AvanPrintExport?.exportCurrentReportCsv === 'function') {
    const csv = document.createElement('button');
    csv.type = 'button';
    csv.className = 'ghost';
    csv.textContent = 'خروجی CSV';
    csv.addEventListener('click', () => {
      prepareOutput();
      window.AvanPrintExport.exportCurrentReportCsv();
    });
    toolbar.appendChild(csv);
  }

  const hint = document.createElement('span');
  hint.className = 'muted avan-export-hint';
  hint.textContent = 'برای PDF در پنجره چاپ گزینه «Save as PDF / ذخیره به PDF» را انتخاب کنید.';
  toolbar.appendChild(hint);

  content.prepend(toolbar);
}

function printableDetail(modal) {
  if (!modal || modal.querySelector('form')) return false;
  if (modal.classList.contains('avan-doc-viewer-modal')) return false;
  if (!modal.querySelector('table')) return false;

  const heading = text(modal.querySelector('h2')?.textContent);
  return heading.startsWith('سند ') || heading.startsWith('فاکتور');
}

function ensureDetailPrintControl() {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  if (!backdrop || backdrop.hidden || !printableDetail(modal)) return;

  const existing = modal.querySelector('[data-avan-print-detail]');
  if (existing) {
    existing.hidden = false;
    existing.dataset.desktopPrintVerified = '1';
    return;
  }

  const actions = modal.querySelector('.form-actions');
  if (!actions) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.dataset.avanPrintDetail = '1';
  button.dataset.avanPrintRecovery = '1';
  button.dataset.desktopPrintVerified = '1';
  button.textContent = 'چاپ / ذخیره PDF';
  button.addEventListener('click', () => {
    const title = text(modal.querySelector('h2')?.textContent) || 'سند آوان';
    runPrint(modal, title);
  });

  actions.prepend(button);
}

function recover() {
  ensureListPrintControl();
  ensureDetailPrintControl();
}

function schedule() {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = null;
    recover();
  }, 30);
}

function install() {
  recover();

  // Deterministic hooks added in RC1.3-D.
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:modal-opened', schedule);
  window.addEventListener('avan:company-context-changed', schedule);
  window.addEventListener('avan:company-profile-updated', schedule);

  // Defense-in-depth for legacy render paths that do not dispatch hooks yet.
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });

  document.addEventListener('click', schedule, true);
  window.setTimeout(recover, 150);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanPrintControlsRecovery = Object.freeze({ recover });
