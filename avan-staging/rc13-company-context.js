'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = installAvanCloud();
const companyContext = cloud.companyContext;
const ROLE_FA = Object.freeze({ owner:'مالک', manager:'مدیر', financial_manager:'مدیر', accountant:'حسابدار', viewer:'مشاهده‌گر' });
const STATUS_FA = Object.freeze({ active:'فعال', onboarding:'در حال راه‌اندازی', suspended:'تعلیق‌شده', archived:'آرشیوشده' });

let companies = [];
let current = null;
let selectionRequired = false;
let loading = false;
let resolved = false;
let lastLoadError = null;
let refreshPromise = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));
const roleLabel = role => ROLE_FA[role] || String(role || '—');
const statusLabel = status => STATUS_FA[status] || String(status || '—');
const appVisible = () => {
  const app = document.getElementById('appShell');
  return Boolean(app && !app.hidden);
};

async function loadState(force = false) {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    loading = true;
    lastLoadError = null;
    try {
      const state = force
        ? await companyContext.refresh({ force: true })
        : await companyContext.ensure();
      companies = Array.isArray(state?.companies) ? state.companies : [];
      current = state?.active_company || null;
      selectionRequired = Boolean(state?.selection_required);
      resolved = true;
      return state;
    } catch (error) {
      lastLoadError = error;
      resolved = false;
      console.warn('[Avan company shell] context load failed', error);
      return null;
    } finally {
      loading = false;
    }
  })();
  try { return await refreshPromise; }
  finally { refreshPromise = null; }
}

function contextHtml() {
  if (!current) return '';
  return `<div class="avan-company-context-inner"><span class="avan-company-context-label">شرکت فعال</span><select id="avanActiveCompanySelect" aria-label="شرکت فعال">${companies.filter(company => company.access_allowed !== false).map(company => `<option value="${esc(company.id)}" ${company.id === current.id ? 'selected' : ''}>${esc(company.display_name)} — ${esc(roleLabel(company.role))}</option>`).join('')}</select><span class="badge avan-company-role">${esc(roleLabel(current.role))}</span><button type="button" class="ghost small avan-company-portfolio-button" id="avanOpenCompanyPortfolio">شرکت‌های من</button></div>`;
}

async function chooseCompany(id) {
  try {
    await companyContext.selectCompany(id);
    location.reload();
  } catch (error) {
    const status = document.getElementById('avanCompanyPortfolioStatus');
    const message = String(error?.message || error || '');
    if (status) {
      status.textContent = message.includes('COMPANY_ARCHIVED')
        ? 'این شرکت آرشیو شده و ورود به آن بسته است.'
        : message.includes('COMPANY_SUSPENDED')
          ? 'این شرکت توسط مدیریت سامانه تعلیق شده است.'
          : 'ورود به این شرکت انجام نشد.';
    }
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

  const signature = companies.map(company => `${company.id}:${company.display_name}:${company.role}:${company.status}`).join('|');
  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.innerHTML = contextHtml();
  }

  const select = host.querySelector('#avanActiveCompanySelect');
  if (select && !select.dataset.bound) {
    select.dataset.bound = '1';
    select.onchange = () => {
      if (select.value && select.value !== current?.id) void chooseCompany(select.value);
    };
  }

  const button = host.querySelector('#avanOpenCompanyPortfolio');
  if (button && !button.dataset.bound) {
    button.dataset.bound = '1';
    button.onclick = () => void openPortfolio({ required: false, refreshState: true });
  }
}

function portfolioCompanyHtml(company) {
  const active = company.id === current?.id;
  const blocked = company.access_allowed === false;
  const secondary = company.legal_name || (company.mode === 'personal' ? 'شرکت / کسب‌وکار شخصی' : 'شرکت عضو آوان');
  const action = active
    ? '<span class="avan-current-company-indicator" aria-current="true">شرکت انتخاب‌شده</span>'
    : `<button type="button" class="primary" data-enter-company="${esc(company.id)}" ${blocked ? 'disabled' : ''}>${blocked ? 'ورود بسته است' : 'ورود به شرکت'}</button>`;
  return `<article class="avan-company-portfolio-card ${active ? 'active' : ''} ${blocked ? 'disabled' : ''}"><div class="avan-company-portfolio-mark">${esc((company.display_name || 'آ').slice(0, 1))}</div><div class="avan-company-portfolio-copy"><div class="avan-company-portfolio-title"><strong>${esc(company.display_name || 'شرکت بدون نام')}</strong>${active ? '<span class="badge posted">فعال</span>' : `<span class="badge ${blocked ? 'reversed' : 'draft'}">${esc(statusLabel(company.status))}</span>`}</div><span>${esc(secondary)}</span><small>نقش شما: ${esc(roleLabel(company.role))}${company.plan_code ? ` · پلن ${esc(company.plan_code)}` : ''}</small>${blocked ? '<small>دسترسی به دفتر مالی این Tenant از سطح سامانه بسته است.</small>' : ''}</div>${action}</article>`;
}

function portfolioHtml(required) {
  const empty = resolved && companies.length === 0;
  const status = lastLoadError
    ? 'خواندن شرکت‌های شما انجام نشد. دوباره تلاش کنید.'
    : empty
      ? 'برای شروع، اولین شرکت خود را ایجاد کنید.'
      : required
        ? 'برای ادامه یک شرکت فعال را انتخاب کنید.'
        : 'مدیریت وضعیت سرویس توسط ادمین سامانه انجام می‌شود.';
  const body = !resolved
    ? '<div class="loading">در حال خواندن شرکت‌های شما…</div>'
    : companies.length
      ? companies.map(portfolioCompanyHtml).join('')
      : '<div class="empty">هنوز شرکتی برای این حساب در دسترس نیست.</div>';
  const intro = !resolved
    ? 'فهرست شرکت‌های مجاز حساب شما در حال همگام‌سازی است.'
    : empty
      ? 'این حساب هنوز شرکتی ندارد. اولین شرکت را ایجاد کنید تا هسته مالی آوان برای شما راه‌اندازی شود.'
      : 'هر شرکت یک Tenant مستقل است. شرکت تعلیق/آرشیوشده همچنان دیده می‌شود اما دفتر مالی آن قابل ورود نیست.';
  return `<div class="avan-company-portfolio-panel" role="dialog" aria-modal="true"><div class="avan-company-portfolio-head"><div><span class="eyebrow">آوان · Company Portfolio</span><h2>شرکت‌های من</h2><p>${intro}</p></div>${!required && current ? '<button type="button" class="ghost" id="avanCloseCompanyPortfolio">بستن</button>' : ''}</div><div class="avan-company-portfolio-list">${body}</div><div class="avan-company-portfolio-foot"><span class="muted" id="avanCompanyPortfolioStatus">${status}</span>${lastLoadError ? '<button type="button" class="ghost small" id="avanRetryCompanyPortfolio">تلاش مجدد</button>' : ''}</div></div>`;
}

function closePortfolio() {
  document.getElementById('avanCompanyPortfolio')?.remove();
  document.body.classList.remove('avan-company-portfolio-open');
}

function bindPortfolio(required) {
  const overlay = document.getElementById('avanCompanyPortfolio');
  if (!overlay) return;
  overlay.querySelectorAll('[data-enter-company]:not(:disabled)').forEach(button => {
    button.onclick = () => void chooseCompany(button.dataset.enterCompany);
  });
  document.getElementById('avanCloseCompanyPortfolio')?.addEventListener('click', closePortfolio);
  document.getElementById('avanRetryCompanyPortfolio')?.addEventListener('click', () => void openPortfolio({ required, refreshState: true }));
  overlay.onclick = event => {
    if (!required && event.target === overlay) closePortfolio();
  };
}

function renderPortfolio(required) {
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
  overlay.querySelector('[data-enter-company]:not(:disabled)')?.focus();
}

async function openPortfolio({ required = false, refreshState = false } = {}) {
  if (refreshState || !resolved) {
    renderPortfolio(required);
    await loadState(true);
  }
  renderPortfolio(required);
}

function syncRequiredPortfolio() {
  if (loading || !resolved) return;
  const firstCompanyRequired = appVisible() && !current && companies.length === 0;
  if ((selectionRequired && companies.length) || firstCompanyRequired) {
    void openPortfolio({ required: true, refreshState: false });
    return;
  }
  const overlay = document.getElementById('avanCompanyPortfolio');
  if (overlay?.dataset.required === 'true') closePortfolio();
}

function projectCompanyLabels() {
  if (document.getElementById('pageTitle')?.textContent?.trim() !== 'تنظیمات') return;
  const content = document.getElementById('content');
  if (!content) return;
  if (current) {
    const first = content.querySelector('.grid4 .card');
    const label = first?.querySelector('.kpi-label');
    const value = first?.querySelector('.kpi-value');
    if (label && value) {
      label.textContent = 'شرکت فعال';
      value.textContent = current.display_name;
    }
  }
  content.querySelectorAll('.summary-pill').forEach(pill => {
    const text = String(pill.textContent || '').trim();
    if (text.startsWith('Workspace قابل مشاهده') || text.startsWith('شرکت قابل مشاهده')) {
      pill.textContent = `شرکت‌های من ${companies.length}`;
    }
  });
}

async function refresh(force = false) {
  await loadState(force);
  renderTopbar();
  syncRequiredPortfolio();
  projectCompanyLabels();
}

function onPageRendered() {
  renderTopbar();
  projectCompanyLabels();
  if (!resolved) {
    void refresh(true);
    return;
  }
  syncRequiredPortfolio();
}

function install() {
  window.addEventListener('avan:page-rendered', onPageRendered);
  window.addEventListener('avan:company-profile-updated', () => void refresh(true));
  window.addEventListener('avan:company-context-changed', () => void refresh(true));
  window.addEventListener('focus', () => {
    if (appVisible() && (!resolved || (!current && companies.length === 0))) void refresh(true);
  });
  window.addEventListener('avan:company-context-cleared', () => {
    companies = [];
    current = null;
    selectionRequired = false;
    resolved = false;
    document.getElementById('avanCompanyContextHost')?.remove();
    void refresh(true);
  });
  void refresh(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();

window.AvanCompanyShell = Object.freeze({
  openPortfolio: () => openPortfolio({ required: false, refreshState: true }),
  refresh: async () => {
    await refresh(true);
    return companyContext.snapshot();
  },
  snapshot: () => Object.freeze({
    loading,
    resolved,
    company_id: current?.id || null,
    company_count: companies.length,
    selection_required: selectionRequired
  })
});
