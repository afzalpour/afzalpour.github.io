'use strict';

const HAS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
const PRINTABLE_INTELLIGENCE_TITLES = new Set([
  'برج کنترل مالی',
  'دوقلوی مالی',
  'مرکز سرمایه در گردش',
  'تصمیم‌یار عملیاتی',
  'بستن و حسابرسی پیوسته'
]);

function currentTitle() {
  return String(document.getElementById('pageTitle')?.textContent || '').trim();
}

function removeStaleToolbar() {
  document.querySelector('[data-avan-intelligence-print-toolbar]')?.remove();
}

function intelligencePrintSource(content) {
  const clone = content.cloneNode(true);
  clone.querySelectorAll('.avan-working-capital-date-form,.avan-cca-date-form').forEach(form => {
    const visibleDate = form.querySelector('[data-jalalized]')?.value || '—';
    const replacement = document.createElement('div');
    replacement.className = 'muted';
    replacement.textContent = `تا تاریخ: ${visibleDate}`;
    form.replaceWith(replacement);
  });
  return clone;
}

function ensureIntelligencePrintToolbar() {
  if (!HAS_BROWSER) return false;
  const title = currentTitle();
  const content = document.getElementById('content');
  if (!content || !PRINTABLE_INTELLIGENCE_TITLES.has(title)) {
    removeStaleToolbar();
    return false;
  }
  if (content.querySelector(':scope > [data-avan-intelligence-print-toolbar]')) return true;

  const toolbar = document.createElement('div');
  toolbar.className = 'avan-export-toolbar card';
  toolbar.dataset.avanIntelligencePrintToolbar = '1';

  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'ghost';
  print.textContent = 'چاپ / ذخیره PDF';
  print.addEventListener('click', () => {
    const api = window.AvanPrintExport;
    if (!api?.printElement) return;
    api.printElement(intelligencePrintSource(content), title);
  });

  const hint = document.createElement('span');
  hint.className = 'muted avan-export-hint';
  hint.textContent = 'نام شرکت و واحد مبالغ در خروجی چاپی درج می‌شود.';
  toolbar.append(print, hint);
  content.prepend(toolbar);
  window.AvanMoneyOutput?.project?.();
  return true;
}

function schedule() {
  window.requestAnimationFrame(() => ensureIntelligencePrintToolbar());
}

export function installIntelligencePrintExport() {
  if (!HAS_BROWSER || window.AvanIntelligencePrintExport?.installed) return window.AvanIntelligencePrintExport || null;
  const api = Object.freeze({ installed: true, apply: ensureIntelligencePrintToolbar });
  window.AvanIntelligencePrintExport = api;
  window.addEventListener('avan:page-rendered', schedule);
  window.addEventListener('avan:control-tower-rendered', schedule);
  window.addEventListener('avan:continuous-close-audit-rendered', schedule);
  window.addEventListener('avan:company-context-changed', schedule);
  schedule();
  return api;
}

if (HAS_BROWSER) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installIntelligencePrintExport, { once: true });
  else installIntelligencePrintExport();
}
