'use strict';

// RC1.3-D Live Gate recovery layer.
// The shared RC1.2 print engine remains the single print implementation.
// This module guarantees list + detail print controls across desktop/mobile.

const PRINTABLE_KEYS = new Set(['reports', 'invoices', 'journal']);
const TITLE_BY_KEY = Object.freeze({
  reports: 'گزارش‌ها',
  invoices: 'فاکتورها',
  journal: 'اسناد حسابداری'
});

let scheduled = null;
let detailObserver = null;

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
    window.AvanLiveGatePolish?.prepare?.();
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

function detailKind(modal) {
  if (!modal || modal.classList.contains('avan-doc-viewer-modal')) return '';
  if (modal.querySelector('form')) return '';
  if (!modal.querySelector('table')) return '';

  const heading = text(modal.querySelector('h2')?.textContent);
  if (heading.startsWith('سند ')) return 'journal';
  if (heading.startsWith('فاکتور')) return 'invoice';
  return '';
}

function ensureDetailActionsHost(modal) {
  let actions = modal.querySelector('.form-actions');
  if (actions) return actions;

  actions = document.createElement('div');
  actions.className = 'form-actions avan-detail-print-actions';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ghost';
  close.textContent = 'بستن';
  close.addEventListener('click', () => {
    const backdrop = document.getElementById('modalBackdrop');
    if (backdrop) backdrop.hidden = true;
    modal.innerHTML = '';
    document.body.classList.remove('mobile-scroll-lock');
  });

  actions.appendChild(close);
  modal.appendChild(actions);
  return actions;
}

function ensureDetailPrintControl() {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modal');
  if (!modal || !backdrop) return;

  const kind = detailKind(modal);
  if (!kind) return;

  // The modal content itself is authoritative. Do not depend solely on the
  // hidden attribute because some browsers/PWA transitions can report it late.
  if (backdrop.hidden && !modal.textContent.trim()) return;

  const existing = modal.querySelector('[data-avan-print-detail]');
  if (existing) {
    existing.hidden = false;
    existing.style.display = '';
    existing.dataset.desktopPrintVerified = '1';
    return;
  }

  const actions = ensureDetailActionsHost(modal);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.dataset.avanPrintDetail = '1';
  button.dataset.avanPrintRecovery = '1';
  button.dataset.desktopPrintVerified = '1';
  button.dataset.detailKind = kind;
  button.textContent = 'چاپ / ذخیره PDF';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const title = text(modal.querySelector('h2')?.textContent) || (kind === 'invoice' ? 'فاکتور آوان' : 'سند آوان');
    runPrint(modal, title);
  });

  // Keep the print action visually next to the existing close action.
  actions.prepend(button);
}

function retryDetailControl() {
  ensureDetailPrintControl();
  queueMicrotask(ensureDetailPrintControl);
  window.requestAnimationFrame(() => {
    ensureDetailPrintControl();
    window.requestAnimationFrame(ensureDetailPrintControl);
  });
  [0, 25, 80, 180].forEach(delay => window.setTimeout(ensureDetailPrintControl, delay));
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
  }, 20);
}

function installDirectDetailObserver() {
  const modal = document.getElementById('modal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  detailObserver?.disconnect?.();
  detailObserver = new MutationObserver(() => {
    // Run directly; do not debounce this critical control behind other page mutations.
    retryDetailControl();
  });

  detailObserver.observe(modal, {
    childList: true,
    subtree: true,
    characterData: true
  });

  detailObserver.observe(backdrop, {
    attributes: true,
    attributeFilter: ['hidden']
  });
}

function install() {
  recover();
  installDirectDetailObserver();

  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:modal-opened', retryDetailControl);
  window.addEventListener('avan:company-context-changed', schedule);
  window.addEventListener('avan:company-profile-updated', schedule);

  // Exact view actions get an immediate post-click recovery pass.
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-view-invoice],[data-view-journal]');
    if (button) retryDetailControl();
  }, false);

  // Defense-in-depth for legacy render paths.
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });

  document.addEventListener('click', schedule, true);
  window.setTimeout(recover, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanPrintControlsRecovery = Object.freeze({
  recover,
  ensureDetailPrintControl,
  retryDetailControl
});
