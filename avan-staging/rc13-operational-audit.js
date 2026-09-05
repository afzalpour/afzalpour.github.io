'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';

const cloud = installAvanCloud();
const companyContext = cloud.companyContext;
const content = document.getElementById('content');
const pageTitle = document.getElementById('pageTitle');

let workspace = null;
let workspaceRole = '';
let currentUser = null;
let rows = [];
let loading = false;
let scheduled = null;

const ACTION_FA = Object.freeze({
  status_change: 'تغییر وضعیت',
  post: 'ثبت قطعی',
  upload: 'بارگذاری',
  save_draft: 'ذخیره پیش‌نویس',
  bootstrap: 'ایجاد شرکت',
  reverse: 'سند برگشتی',
  workspace_print_profile_changed: 'تغییر مشخصات شرکت',
  money_display_unit_changed: 'تغییر واحد نمایش پول',
  close_period: 'بستن دوره مالی',
  reopen_period: 'بازگشایی دوره مالی',
  workspace_invitation_created: 'دعوت کاربر',
  workspace_member_added: 'افزودن عضو'
});

const ENTITY_FA = Object.freeze({
  document: 'سند هوشمند',
  journal_entry: 'سند حسابداری',
  invoice: 'فاکتور',
  workspace: 'شرکت',
  workspace_print_profile: 'مشخصات شرکت',
  workspace_settings: 'تنظیمات شرکت',
  fiscal_period: 'دوره مالی',
  workspace_invitation: 'دعوت کاربر',
  workspace_member: 'عضو شرکت'
});

const CATEGORY_ACTIONS = Object.freeze({
  accounting: new Set(['post', 'save_draft', 'reverse', 'close_period', 'reopen_period']),
  documents: new Set(['upload', 'status_change']),
  access: new Set(['workspace_invitation_created', 'workspace_member_added']),
  settings: new Set(['workspace_print_profile_changed', 'money_display_unit_changed', 'bootstrap'])
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function isSettingsPage() {
  return String(pageTitle?.textContent || '').trim() === 'تنظیمات';
}

function isAuditAdminRole() {
  return workspaceRole === 'owner' || workspaceRole === 'manager';
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function actorLabel(actorId) {
  if (!actorId) return 'سیستم';
  if (currentUser?.id && actorId === currentUser.id) return 'شما';
  return 'کاربر دیگر';
}

function actionLabel(value) {
  return ACTION_FA[value] || String(value || 'فعالیت');
}

function entityLabel(value) {
  return ENTITY_FA[value] || String(value || '—');
}

function filteredRows(category) {
  if (!category || category === 'all') return rows;
  const allowed = CATEGORY_ACTIONS[category];
  if (!allowed) return rows;
  return rows.filter(row => allowed.has(row.action));
}

function rowHtml(row) {
  const summary = String(row.summary || '').trim();
  return `
    <article class="avan-audit-row">
      <div class="avan-audit-row-main">
        <strong>${esc(actionLabel(row.action))}</strong>
        <span>${esc(entityLabel(row.entity_type))}</span>
        ${summary ? `<small>${esc(summary)}</small>` : ''}
      </div>
      <div class="avan-audit-row-meta">
        <span>${esc(actorLabel(row.actor_id))}</span>
        <time>${esc(formatDate(row.created_at))}</time>
      </div>
    </article>
  `;
}

function cardShell() {
  return `
    <section class="section card avan-audit-card" data-avan-operational-audit>
      <div class="section-head avan-audit-head">
        <div>
          <h2>گزارش فعالیت</h2>
          <span class="muted">آخرین رویدادهای شرکت فعال، فقط به‌صورت خواندنی</span>
          <small class="muted" id="avanAuditScopeNote"></small>
        </div>
        <button type="button" class="ghost" id="avanAuditRefresh">به‌روزرسانی</button>
      </div>
      <div class="avan-audit-toolbar">
        <label for="avanAuditFilter">فیلتر</label>
        <select id="avanAuditFilter">
          <option value="all">همه فعالیت‌ها</option>
          <option value="accounting">حسابداری و دوره مالی</option>
          <option value="documents">اسناد هوشمند</option>
          <option value="settings">تنظیمات</option>
        </select>
        <span class="muted" id="avanAuditStatus"></span>
      </div>
      <div class="avan-audit-list" id="avanAuditList">
        <div class="loading">در حال خواندن گزارش فعالیت…</div>
      </div>
    </section>
  `;
}

function applyRoleVisibility() {
  const filter = document.getElementById('avanAuditFilter');
  const note = document.getElementById('avanAuditScopeNote');
  if (!filter) return;

  let accessOption = filter.querySelector('option[value="access"]');

  if (isAuditAdminRole()) {
    if (!accessOption) {
      filter.insertAdjacentHTML(
        'beforeend',
        '<option value="access">کاربران و دسترسی</option>'
      );
    }
    if (note) {
      note.textContent = 'مالک و مدیر شرکت: رویدادهای مدیریتی و دسترسی نیز قابل مشاهده‌اند.';
    }
    return;
  }

  if (accessOption) accessOption.remove();
  if (filter.value === 'access') filter.value = 'all';
  if (note) {
    note.textContent = 'رویدادهای کاربران، دعوت‌ها و تغییرات دسترسی فقط برای مالک یا مدیر همان شرکت قابل مشاهده‌اند.';
  }
}

function paint(category = 'all') {
  const list = document.getElementById('avanAuditList');
  const status = document.getElementById('avanAuditStatus');
  if (!list || !status) return;

  const visible = filteredRows(category);
  status.textContent = `${visible.length} رویداد`;

  if (!visible.length) {
    list.innerHTML = '<div class="muted avan-audit-empty">رویدادی برای این فیلتر وجود ندارد.</div>';
    return;
  }

  list.innerHTML = visible.map(rowHtml).join('');
}

async function resolveContext() {
  currentUser = await cloud.user();
  if (!currentUser?.id) throw new Error('AUTH_REQUIRED');

  const state = await companyContext.ensure();
  workspace = state.active_company || null;
  if (!workspace?.id) throw new Error('COMPANY_REQUIRED');

  workspaceRole = workspace.role || await cloud.rpc(
    'workspace_role',
    { wid: workspace.id }
  ) || '';
}

async function loadAudit({ forceContext = false } = {}) {
  if (loading) return;
  loading = true;

  const refresh = document.getElementById('avanAuditRefresh');
  const status = document.getElementById('avanAuditStatus');
  if (refresh) refresh.disabled = true;
  if (status) status.textContent = 'در حال به‌روزرسانی…';

  try {
    if (forceContext || !workspace?.id || !currentUser?.id || !workspaceRole) {
      if (forceContext) await companyContext.refresh({ force: true });
      await resolveContext();
    }

    applyRoleVisibility();

    rows = await cloud.select(
      'audit_logs',
      `select=id,actor_id,action,entity_type,entity_id,summary,created_at&workspace_id=eq.${workspace.id}&order=created_at.desc&limit=40`
    ) || [];

    const filter = document.getElementById('avanAuditFilter');
    paint(filter?.value || 'all');
  } catch (error) {
    console.warn('[Avan audit] load failed', error);
    const list = document.getElementById('avanAuditList');
    if (list) {
      list.innerHTML = '<div class="error-box">خواندن گزارش فعالیت انجام نشد. دوباره تلاش کنید.</div>';
    }
    if (status) status.textContent = 'خطا در دریافت';
  } finally {
    loading = false;
    if (refresh?.isConnected) refresh.disabled = false;
  }
}

function bindCard() {
  const refresh = document.getElementById('avanAuditRefresh');
  const filter = document.getElementById('avanAuditFilter');

  if (refresh) {
    refresh.onclick = () => loadAudit({ forceContext: true });
  }

  if (filter) {
    filter.onchange = () => paint(filter.value);
  }
}

function ensureCard() {
  if (!content || !isSettingsPage()) return;
  if (content.querySelector('[data-avan-operational-audit]')) return;

  content.insertAdjacentHTML('beforeend', cardShell());
  bindCard();
  loadAudit({ forceContext: true });
}

function scheduleEnsure() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    ensureCard();
  }, 40);
}

if (content) {
  const observer = new MutationObserver(scheduleEnsure);
  observer.observe(content, { childList: true });
}

window.addEventListener('avan:company-context-changed', () => {
  workspace = null;
  workspaceRole = '';
  rows = [];
  scheduleEnsure();
});

scheduleEnsure();
