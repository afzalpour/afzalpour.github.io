'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = window.AvanCloud || installAvanCloud();
const ACTIVE_KEY = cloud.ACTIVE_WORKSPACE_KEY || 'avan.active_workspace_id';

const ROLE_FA = Object.freeze({
  owner: 'مالک',
  manager: 'مدیر',
  financial_manager: 'مدیر',
  accountant: 'حسابدار',
  viewer: 'مشاهده‌گر'
});

let companies = [];
let loading = false;
let loadedSignature = '';
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

function activeCompany() {
  return companies[0] || null;
}

async function enrichCompany(workspace) {
  let role = '';
  let profile = null;

  try {
    role = await cloud.rpc('workspace_role', { wid: workspace.id });
  } catch (error) {
    console.warn('[Avan company context] role unavailable', error);
  }

  try {
    profile = await cloud.rpc('get_workspace_print_profile', { wid: workspace.id });
  } catch {
    // Company profile is optional for context rendering; workspace name is fallback.
  }

  return {
    ...workspace,
    role,
    display_name: String(
      profile?.display_name || workspace.name || 'شرکت بدون نام'
    ).trim()
  };
}

async function loadCompanies(force = false) {
  if (loading) return;
  loading = true;

  try {
    const user = await cloud.user();
    if (!user?.id) {
      companies = [];
      loadedSignature = '';
      return;
    }

    const rows = await cloud.select(
      'workspaces',
      'select=id,name,mode,base_currency,created_at&order=created_at.asc'
    ) || [];

    const signature = rows.map(row => `${row.id}:${row.name || ''}`).join('|');
    if (!force && signature === loadedSignature && companies.length === rows.length) {
      return;
    }

    companies = await Promise.all(rows.map(enrichCompany));
    loadedSignature = signature;
  } catch (error) {
    console.warn('[Avan company context] load failed', error);
  } finally {
    loading = false;
  }
}

function contextHtml() {
  const current = activeCompany();
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
    </div>
  `;
}

function renderTopbar() {
  const appShell = document.getElementById('appShell');
  const topbar = document.querySelector('.topbar');
  if (!topbar || !appShell || appShell.hidden) return;

  let host = document.getElementById('avanCompanyContextHost');
  const current = activeCompany();

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
      if (!nextId || nextId === current.id) return;

      try {
        window.sessionStorage?.setItem(ACTIVE_KEY, nextId);
      } catch {
        // Session preference is optional and contains no accounting data.
      }

      location.reload();
    };
  }
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

  const current = activeCompany();
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
  await loadCompanies(force);
  renderTopbar();
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
  window.addEventListener('avan:workspace-changed', () => schedule(true));

  schedule(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}

window.AvanCompanyContext = Object.freeze({
  active: () => ({ ...(activeCompany() || {}) }),
  list: () => companies.map(company => ({ ...company })),
  refresh: async () => {
    await refresh(true);
    return companies.map(company => ({ ...company }));
  }
});