'use strict';

import { createSupabaseClient } from './src/infrastructure/supabase/supabase-client.js';

const client = createSupabaseClient({
  config: window.AVAN_CONFIG || {},
  storage: localStorage
});

const authState = document.getElementById('platformAuthState');
const content = document.getElementById('platformContent');
const kpis = document.getElementById('platformKpis');
const companyRows = document.getElementById('companyRows');
const auditHost = document.getElementById('platformAudit');
const companySearch = document.getElementById('companySearch');
const refreshButton = document.getElementById('refreshPlatform');

let companies = [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[ch]);

function faNumber(value) {
  return Number(value || 0).toLocaleString('fa-IR');
}

function faDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year:'numeric', month:'2-digit', day:'2-digit'
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function statusLabel(status) {
  return ({
    active:'فعال', onboarding:'راه‌اندازی', suspended:'تعلیق', archived:'آرشیو'
  })[status] || status || '—';
}

function registryLabel(state) {
  return ({
    ok:'سالم', missing_owner:'مالک ثبت نشده', missing_owner_user:'حساب مالک موجود نیست'
  })[state] || 'نیازمند بررسی';
}

function setAuthState(text, kind = '') {
  authState.textContent = text;
  authState.className = `state-card ${kind}`.trim();
}

function renderKpis(data = {}) {
  const items = [
    ['کل شرکت‌ها', data.companies_total],
    ['شرکت‌های فعال', data.companies_active],
    ['کاربران سامانه', data.users_total],
    ['عضویت‌های فعال', data.active_memberships],
    ['در حال راه‌اندازی', data.companies_onboarding],
    ['تعلیق‌شده', data.companies_suspended],
    ['آرشیوشده', data.companies_archived],
    ['ادمین پلتفرم', data.platform_admins_active]
  ];
  kpis.innerHTML = items.map(([label,value]) => `
    <article class="kpi"><span>${esc(label)}</span><strong>${faNumber(value)}</strong></article>
  `).join('');
}

function renderCompanies(filter = '') {
  const q = String(filter || '').trim().toLowerCase();
  const rows = companies.filter(company => {
    if (!q) return true;
    return [company.display_name, company.name, company.legal_name, company.owner_email]
      .some(value => String(value || '').toLowerCase().includes(q));
  });

  companyRows.innerHTML = rows.length ? rows.map(company => {
    const registryOk = company.registry_state === 'ok';
    return `
      <tr>
        <td><div class="company-name"><strong>${esc(company.display_name || company.name || 'شرکت بدون نام')}</strong><small>${esc(company.legal_name || company.company_id || '')}</small></div></td>
        <td>${esc(company.owner_email || '—')}</td>
        <td>${faNumber(company.active_members)}</td>
        <td><span class="badge ${esc(company.status || '')}">${esc(statusLabel(company.status))}</span></td>
        <td><span class="badge ${registryOk ? 'ok' : 'bad'}">${esc(registryLabel(company.registry_state))}</span></td>
        <td>${esc(faDate(company.created_at))}</td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="6" class="empty">موردی پیدا نشد.</td></tr>';
}

function renderAudit(rows = []) {
  auditHost.innerHTML = rows.length ? rows.map(row => `
    <div class="audit-item">
      <div>
        <strong>${esc(row.summary || row.action)}</strong>
        <span>${esc(row.action || '')}</span>
      </div>
      <time>${esc(faDate(row.created_at))}</time>
    </div>
  `).join('') : '<div class="empty">هنوز رویداد Control Plane ثبت نشده است.</div>';
}

async function load() {
  if (refreshButton) refreshButton.disabled = true;
  setAuthState('در حال بررسی دسترسی ادمین کل…');
  content.hidden = true;

  try {
    const user = await client.user();
    if (!user?.id) {
      setAuthState('برای ورود به کنترل‌پنل ابتدا در آوان وارد حساب کاربری شوید.', 'error');
      return;
    }

    const me = await client.rpc('platform_admin_me', {});
    if (!me?.authorized) {
      setAuthState('این حساب دسترسی Platform Admin ندارد. این صفحه از نقش‌های داخل شرکت مستقل است.', 'error');
      return;
    }

    await client.rpc('platform_admin_enter', {});

    const [overview, companyList, auditRows] = await Promise.all([
      client.rpc('platform_admin_overview', {}),
      client.rpc('platform_admin_companies', {}),
      client.rpc('platform_admin_audit', { p_limit: 30 })
    ]);

    companies = Array.isArray(companyList) ? companyList : [];
    renderKpis(overview || {});
    renderCompanies(companySearch?.value || '');
    renderAudit(Array.isArray(auditRows) ? auditRows : []);

    content.hidden = false;
    setAuthState(`دسترسی تأیید شد — ${me.role === 'platform_owner' ? 'مالک پلتفرم' : 'ادمین پلتفرم'}. Control Plane فقط Metadata عملیاتی را می‌خواند.`, 'ok');
  } catch (error) {
    console.error('[Avan Platform Admin] load failed', error);
    const message = String(error?.message || error || '');
    setAuthState(
      message.includes('PLATFORM_ADMIN_REQUIRED')
        ? 'این حساب دسترسی Platform Admin ندارد.'
        : 'بارگذاری Control Plane انجام نشد. Session و اتصال Supabase را بررسی کنید.',
      'error'
    );
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

if (companySearch) {
  companySearch.addEventListener('input', () => renderCompanies(companySearch.value));
}
if (refreshButton) refreshButton.onclick = load;

load();
