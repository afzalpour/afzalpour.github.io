'use strict';

const MORE_PAGES = new Set(['invoices', 'journal', 'documents', 'parties', 'settings']);
const ITEMS = [
  { page: 'invoices', icon: '▤', label: 'فاکتورها', hint: 'فروش و خرید' },
  { page: 'journal', icon: '≡', label: 'اسناد حسابداری', hint: 'پیش‌نویس، ثبت و برگشت' },
  { page: 'documents', icon: '▧', label: 'اسناد هوشمند', hint: 'اصل سند و بازبینی' },
  { page: 'parties', icon: '◎', label: 'طرف‌حساب‌ها', hint: 'مشتری و فروشنده' },
  { page: 'settings', icon: '⚙', label: 'تنظیمات', hint: 'کاربر، شرکت و سیستم' }
];

let layer = null;
let previousFocus = null;

function moreButton() {
  return document.getElementById('avanMobileMore');
}

function activePage() {
  return document.querySelector('.sidebar [data-page].active')?.dataset?.page || '';
}

function syncActiveState() {
  const button = moreButton();
  if (!button) return;
  button.classList.toggle('active', MORE_PAGES.has(activePage()));
  button.setAttribute('aria-expanded', layer ? 'true' : 'false');
}

function closeSheet() {
  if (!layer) return;
  const old = layer;
  layer = null;
  old.classList.remove('is-open');
  document.body.classList.remove('avan-mobile-more-open');
  syncActiveState();
  window.setTimeout(() => old.remove(), 180);
  previousFocus?.focus?.({ preventScroll: true });
  previousFocus = null;
}

function navigate(page) {
  const target = document.querySelector(`.sidebar [data-page="${page}"]`);
  if (!target) return;
  closeSheet();
  target.click();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function sheetHtml() {
  return `
    <div class="avan-mobile-more-panel" role="dialog" aria-modal="true" aria-labelledby="avanMobileMoreTitle">
      <div class="avan-mobile-more-handle" aria-hidden="true"></div>
      <div class="avan-mobile-more-head">
        <div>
          <strong id="avanMobileMoreTitle">بخش‌های بیشتر</strong>
          <span>دسترسی سریع به بخش‌های اصلی آوان</span>
        </div>
        <button type="button" class="avan-mobile-more-close" aria-label="بستن">×</button>
      </div>
      <div class="avan-mobile-more-grid">
        ${ITEMS.map(item => `
          <button type="button" class="avan-mobile-more-item" data-mobile-more-page="${item.page}">
            <span class="avan-mobile-more-icon" aria-hidden="true">${item.icon}</span>
            <span class="avan-mobile-more-copy">
              <b>${item.label}</b>
              <small>${item.hint}</small>
            </span>
            <span class="avan-mobile-more-chevron" aria-hidden="true">‹</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function openSheet() {
  if (layer || window.matchMedia('(min-width: 901px)').matches) return;

  previousFocus = document.activeElement;
  layer = document.createElement('div');
  layer.className = 'avan-mobile-more-layer';
  layer.innerHTML = sheetHtml();
  document.body.appendChild(layer);
  document.body.classList.add('avan-mobile-more-open');

  layer.querySelector('.avan-mobile-more-close')?.addEventListener('click', closeSheet);
  layer.querySelectorAll('[data-mobile-more-page]').forEach(button => {
    button.addEventListener('click', () => navigate(button.dataset.mobileMorePage));
  });
  layer.addEventListener('click', event => {
    if (event.target === layer) closeSheet();
  });

  requestAnimationFrame(() => {
    if (!layer) return;
    layer.classList.add('is-open');
    layer.querySelector('.avan-mobile-more-item')?.focus({ preventScroll: true });
    syncActiveState();
  });
}

function install() {
  const button = moreButton();
  if (!button) return;

  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', openSheet);

  const nav = document.getElementById('nav');
  if (nav) {
    new MutationObserver(syncActiveState).observe(nav, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && layer) closeSheet();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && layer) closeSheet();
  }, { passive: true });

  syncActiveState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
