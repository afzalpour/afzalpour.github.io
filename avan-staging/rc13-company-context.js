'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = installAvanCloud();
const companyContext = cloud.companyContext;

const ROLE_FA = Object.freeze({
  owner: 'مالک',
  manager: 'مدیر',
  financial_manager: 'مدیر',
  accountant: 'حسابدار',
  viewer: 'مشاهده‌گر'
});

let companies = [];
let current = null;
let selectionRequired = false;
let loading = false;
let scheduled = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function roleLabel(role) {
  return ROLE_FA[role] || String(role || '—');
}

async function loadState(force = false) {
  if (loading) return;
  loading = true;

  try {
    const state = await companyContext.refresh({ force });
    companies = state.companies || [];
    current = state.active_company || null;
    selectionRequired = Boolean(state.selection_required);
  } catch (error) {
    console.warn('[Avan company shell] context load failed', error);
  } finally {
    loading = false;
  }
}

function contextHtml() {
  if (!current) return '';

  return `
    <div class="avan-company-context-inner">
      <span class="avan-company-context-label">شرکت فعال</span>
      <select id="avanActiveCompanySelect" aria-label="شرکت فعال">
        ${companies.map(company => `
          <option value="${esc(company.id)}" ${company.id === current.id ? 'selected' : ''}>
            ${esc(company.display_name)} — ${esc(roleLabel(company.role))}
          </option>
        `).join('')}
      </select>
      <span class="badge avan-company-role">${esc(roleLabel(current.role))}</span>
      <button type="button" class="ghost small avan-company-portfolio-button" id="avanOpenCompanyPortfolio">
        شرکت‌های من
      </button>
    </div>
  `;
}

async function chooseCompany(companyId) {
  try {
    await companyContext.selectCompany(companyId);
    location.reload();
  } catch (error) {
    console.warn('[Avan company shell] company selection failed', error);
    const status = document.getElementById('avanCompanyPortfolioStatus');
    if (status) status.textContent = 'ورود به این شرکت انجام نشد. دسترسی را دوباره بررسی کنید.';
  }
}

function renderTopbar() {
  const appShell = document.getElementById('appShell');
  const topbar = document.querySelector('.topbar');
  if (!topbar || !appShell || appShell.hidden) return;

  let host = document.getElementById('avanCompanyContextHost');

  if (!current) {
    host?.remove();
    return;
  }

  if (!host) {
    host = document.createElement('div');
    host.id = 'avanCompanyContextHost';
    host.className = 'avan-company-context';
    topbar.append(host);
  }

  const signature = companies
    .map(company => `${company.id}:${company.display_name}:${company.role}`)
    .join('|');

  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.innerHTML = contextHtml();
  }

  const select = host.querySelector('#avanActiveCompanySelect');
  if (select && !select.dataset.bound) {
    select.dataset.bound = '1';
    select.onchange = () => {
      const nextId = select.value;
      if (!nextId || nextId === current?.id) return;
      chooseCompany(nextId);
    };
  }

  const portfolioButton = host.querySelector('#avanOpenCompanyPortfolio');
  if (portfolioButton && !portfolioButton.dataset.bound) {
    portfolioButton.dataset.bound = '1';
    portfolioButton.onclick = () => openPortfolio({ required: false });
  }
}

function portfolioCompanyHtml(company) {
  const active = company.id === current?.id;
  const secondary = company.legal_name || (
    company.mode === 'personal'
      ? 'شرکت / کسب‌وکار شخصی'
      : 'شرکت عضو آوان'
  );

  return `
    <article class="avan-company-portfolio-card ${active ? 'active' : ''}">
      <div class="avan-company-portfolio-mark">${esc((company.display_name || 'آ').slice(0, 1))}</div>
      <div class="avan-company-portfolio-copy">
        <div class="avan-company-portfolio-title">
          <strong>${esc(company.display_name || 'شرکت بدون نام')}</strong>
          ${active ? '<span class="badge posted">فعال</span>' : ''}
        </div>
        <span>${esc(secondary)}</span>
        <small>نقش شما: ${esc(roleLabel(company.role))}</small>
      </div>
      <button type="button" class="${active ? 'ghost' : 'primary'}" data-enter-company="${esc(company.id)}">
        ${active ? 'بازگشت به شرکت' : 'ورود به شرکت'}
      </button>
    </article>
  `;
}

function portfolioHtml(required) {
  return `
    <div class="avan-company-portfolio-panel" role="dialog" aria-modal="true" aria-labelledby="avanCompanyPortfolioTitle">
      <div class="avan-company-portfolio-head">
        <div>
          <span class="eyebrow">آوان · Company Portfolio</span>
          <h2 id="avanCompanyPortfolioTitle">شرکت‌های من</h2>
          <p>هر شرکت یک محیط مالی مستقل است. نقش، اسناد، گزارش‌ها و تنظیمات در Context همان شرکت اعمال می‌شوند.</p>
        </div>
        ${!required && current ? '<button type="button" class="ghost" id="avanCloseCompanyPortfolio" aria-label="بستن">بستن</button>' : ''}
      </div>

      <div class="avan-company-portfolio-list">
        ${companies.length
          ? companies.map(portfolioCompanyHtml).join('')
          : '<div class="empty">هنوز شرکتی برای این حساب در دسترس نیست.</div>'}
      </div>

      <div class="avan-company-portfolio-foot">
        <span class="muted" id="avanCompanyPortfolioStatus">
          ${required
            ? 'برای ادامه یک شرکت را انتخاب کنید.'
            : 'ایجاد و مدیریت شرکت جدید در مرحله MT-B اضافه می‌شود.'}
        </span>
      </div>
    </div>
  `;
}

function closePortfolio() {
  document.getElementById('avanCompanyPortfolio')?.remove();
  document.body.classList.remove('avan-company-portfolio-open');
}

function bindPortfolio(required) {
  const overlay = document.getElementById('avanCompanyPortfolio');
  if (!overlay) return;

  overlay.querySelectorAll('[data-enter-company]').forEach(button => {
    button.onclick = () => chooseCompany(button.dataset.enterCompany);
  });

  const close = document.getElementById('avanCloseCompanyPortfolio');
  if (close) close.onclick = closePortfolio;

  overlay.onclick = event => {
    if (!required && event.target === overlay) closePortfolio();
  };

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !required && document.getElementById('avanCompanyPortfolio')) {
      closePortfolio();
    }
  }, { once: true });
}

function openPortfolio({ required = false } = {}) {
  let overlay = document.getElementById('avanCompanyPortfolio');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'avanCompanyPortfolio';
    overlay.className = 'avan-company-portfolio-overlay';
    document.body.append(overlay);
  }

  overlay.dataset.required = required ? 'true' : 'false';
  overlay.innerHTML = portfolioHtml(required);
  document.body.classList.add('avan-company-portfolio-open');
  bindPortfolio(required);

  const first = overlay.querySelector('[data-enter-company]');
  first?.focus();
}

function syncRequiredPortfolio() {
  if (selectionRequired && companies.length > 1) {
    openPortfolio({ required: true });
    return;
  }

  const overlay = document.getElementById('avanCompanyPortfolio');
  if (overlay?.dataset.required === 'true') closePortfolio();
}

function findCardByTitle(content, title) {
  return [...content.querySelectorAll('.section.card')]
    .find(card => String(card.querySelector('h2')?.textContent || '').trim() === title) || null;
}

function moveAfter(node, reference) {
  if (!node || !reference || node === reference || reference.nextElementSibling === node) return;
  reference.after(node);
}

function arrangeSettings() {
  const title = document.getElementById('pageTitle');
  const content = document.getElementById('content');
  if (!content || String(title?.textContent || '').trim() !== 'تنظیمات') return;

  const account = findCardByTitle(content, 'حساب کاربری');
  const company = content.querySelector('[data-avan-company-profile]');
  const access = document.getElementById('workspaceAccessCard');
  const currency = document.getElementById('currencySettingsCard');

  if (account && content.firstElementChild !== account) {
    content.prepend(account);
  }

  if (company && account) moveAfter(company, account);
  if (access && company) moveAfter(access, company);
  else if (access && account) moveAfter(access, account);

  if (currency) {
    if (access) moveAfter(currency, access);
    else if (company) moveAfter(currency, company);
    else if (account) moveAfter(currency, account);
  }

  if (current) {
    const grid = content.querySelector('.grid4');
    const firstKpi = grid?.querySelector('.card');
    const firstLabel = firstKpi?.querySelector('.kpi-label');
    const firstValue = firstKpi?.querySelector('.kpi-value');
    if (firstLabel && firstValue) {
      firstLabel.textContent = 'شرکت فعال';
      firstValue.textContent = current.display_name;
    }

    const accessName = access?.querySelector('.access-card-head .muted');
    if (accessName) accessName.textContent = current.display_name;
  }

  content.querySelectorAll('.summary-pill').forEach(pill => {
    const text = String(pill.textContent || '').trim();
    if (text.startsWith('Workspace قابل مشاهده') || text.startsWith('شرکت قابل مشاهده')) {
      pill.textContent = `شرکت قابل مشاهده ${companies.length}`;
    }
  });
}

async function refresh(force = false) {
  await loadState(force);
  renderTopbar();
  syncRequiredPortfolio();
  arrangeSettings();
}

function schedule(force = false) {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(async () => {
    scheduled = null;
    await refresh(force);
  }, 80);
}

function install() {
  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');
  const appShell = document.getElementById('appShell');

  if (content) {
    new MutationObserver(() => schedule(false)).observe(content, {
      childList: true,
      subtree: false
    });
  }

  if (pageTitle) {
    new MutationObserver(() => schedule(false)).observe(pageTitle, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (appShell) {
    new MutationObserver(() => schedule(false)).observe(appShell, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  window.addEventListener('avan:company-profile-updated', () => schedule(true));
  window.addEventListener('avan:company-context-changed', () => schedule(true));
  window.addEventListener('avan:company-context-cleared', () => schedule(true));

  schedule(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanCompanyShell = Object.freeze({
  openPortfolio: () => openPortfolio({ required: false }),
  refresh: async () => {
    await refresh(true);
    return companyContext.snapshot();
  }
});
