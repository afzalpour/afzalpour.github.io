'use strict';

// RC1.3-D Live Gate polish — presentation/print only.
// No accounting/domain mutation.

let scheduled = null;
let restoreTimer = null;

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function pageTitle() {
  return text(document.getElementById('pageTitle')?.textContent);
}

function normalizeUnitChips() {
  document.querySelectorAll('.avan-output-money-unit').forEach(chip => {
    const label = chip.querySelector('span');
    if (label) label.textContent = 'واحد مبالغ:\u00A0';
    chip.style.display = 'flex';
    chip.style.alignItems = 'center';
    chip.style.gap = '6px';
  });
}

function removeTechnicalSubtitles() {
  const page = pageTitle();
  if (page !== 'اسناد حسابداری' && page !== 'فاکتورها') return;

  document.querySelectorAll('#content .section-head .muted').forEach(node => {
    const value = text(node.textContent);
    const isJournalTech = value.includes('Draft → Posted → Reversed') || value.includes('Immutable');
    const isInvoiceTech = value.includes('ثبت قطعی فاکتور مستقیماً سند دوبل روی Ledger می‌سازد');
    if (isJournalTech || isInvoiceTech) node.remove();
  });
}

function headerIndex(table, label) {
  return [...table.querySelectorAll('thead th')]
    .findIndex(th => text(th.childNodes?.[0]?.nodeValue || th.textContent) === label);
}

function alignColumn(table, index, alignment) {
  if (index < 0) return;
  table.querySelectorAll('tr').forEach(row => {
    const cell = row.children[index];
    if (!cell || !/^(TH|TD)$/.test(cell.tagName)) return;
    cell.style.textAlign = alignment;
    if (alignment === 'center') cell.style.verticalAlign = 'middle';
  });
}

function polishListTable() {
  const page = pageTitle();
  if (page !== 'اسناد حسابداری' && page !== 'فاکتورها') return;

  const tables = [...document.querySelectorAll('#content > table, #content table')];
  const table = tables.find(candidate => headerIndex(candidate, 'اقدام') >= 0);
  if (!table) return;

  if (page === 'اسناد حسابداری') {
    ['شماره', 'تاریخ', 'منبع', 'وضعیت', 'اقدام'].forEach(label => {
      alignColumn(table, headerIndex(table, label), 'center');
    });
    alignColumn(table, headerIndex(table, 'شرح'), 'right');
  } else {
    ['شماره', 'نوع', 'تاریخ', 'مبلغ', 'وضعیت', 'اقدام'].forEach(label => {
      alignColumn(table, headerIndex(table, label), 'center');
    });
    alignColumn(table, headerIndex(table, 'طرف‌حساب'), 'right');
  }
}

function markActionColumnsForPrint() {
  const page = pageTitle();
  if (page !== 'اسناد حسابداری' && page !== 'فاکتورها') return;

  document.querySelectorAll('#content table').forEach(table => {
    const actionIndex = headerIndex(table, 'اقدام');
    if (actionIndex < 0) return;

    table.querySelectorAll('tr').forEach(row => {
      const cell = row.children[actionIndex];
      if (!cell || !/^(TH|TD)$/.test(cell.tagName)) return;
      if (cell.hidden) return;
      cell.hidden = true;
      cell.dataset.avanPrintTempHidden = '1';
    });
  });

  if (restoreTimer) window.clearTimeout(restoreTimer);
  restoreTimer = window.setTimeout(() => {
    document.querySelectorAll('[data-avan-print-temp-hidden="1"]').forEach(cell => {
      cell.hidden = false;
      delete cell.dataset.avanPrintTempHidden;
    });
    restoreTimer = null;
  }, 0);
}

function prepare() {
  normalizeUnitChips();
  removeTechnicalSubtitles();
  polishListTable();
}

function schedule() {
  if (scheduled) window.clearTimeout(scheduled);
  scheduled = window.setTimeout(() => {
    scheduled = null;
    prepare();
  }, 20);
}

function beforePrintClick(event) {
  const button = event.target?.closest?.('button');
  if (!button) return;
  const label = text(button.textContent);
  const isPrint = button.hasAttribute('data-avan-print-detail') || /چاپ|PDF/.test(label);
  if (!isPrint) return;
  prepare();
  markActionColumnsForPrint();
}

function install() {
  prepare();
  document.addEventListener('click', beforePrintClick, true);
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:modal-opened', schedule);
  window.addEventListener('avan:money-unit-changed', schedule);
  window.addEventListener('avan:company-context-changed', schedule);

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class']
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanLiveGatePolish = Object.freeze({ prepare });
