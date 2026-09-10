'use strict';

import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from './src/ui/runtime/lifecycle.js';
import { safeUserFacingFa } from './src/ui/localization/user-facing-fa.js';

const cloud = installAvanCloud();
const companyContext = cloud.companyContext;
const Lifecycle = installUiLifecycle();

let workspace = null;
let workspaceRole = '';
let currentUser = null;
let rows = [];
let loading = false;
let loadPromise = null;
let rowsSignature = '';

const ACTION_FA = Object.freeze({
  status_change: 'تغییر وضعیت', post: 'ثبت قطعی', upload: 'بارگذاری', save_draft: 'ذخیره پیش‌نویس',
  bootstrap: 'ایجاد شرکت', reverse: 'سند برگشتی', workspace_print_profile_changed: 'تغییر مشخصات شرکت',
  money_display_unit_changed: 'تغییر واحد نمایش پول', close_period: 'بستن دوره مالی', reopen_period: 'بازگشایی دوره مالی',
  workspace_invitation_created: 'دعوت کاربر', workspace_member_added: 'افزودن عضو'
});

const ENTITY_FA = Object.freeze({
  document: 'سند هوشمند', journal_entry: 'سند حسابداری', invoice: 'فاکتور', workspace: 'شرکت',
  workspace_print_profile: 'مشخصات شرکت', workspace_settings: 'تنظیمات شرکت', fiscal_period: 'دوره مالی',
  workspace_invitation: 'دعوت کاربر', workspace_member: 'عضو شرکت'
});

const CATEGORY_ACTIONS = Object.freeze({
  accounting: new Set(['post', 'save_draft', 'reverse', 'close_period', 'reopen_period']),
  documents: new Set(['upload', 'status_change']),
  access: new Set(['workspace_invitation_created', 'workspace_member_added']),
  settings: new Set(['workspace_print_profile_changed', 'money_display_unit_changed', 'bootstrap'])
});

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
}[char]));

function isSettingsPage() {
  return document.getElementById('pageTitle')?.textContent?.trim() === 'تنظیمات';
}

function isAuditAdminRole() {
  return workspaceRole === 'owner' || workspaceRole === 'manager' || workspaceRole === 'financial_manager';
}

function auditMount() {
  if (!isSettingsPage()) return null;
  const content = document.getElementById('content');
  return content ? (content.querySelector('[data-avan-audit-slot]') || content) : null;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function actorLabel(actorId) {
  if (!actorId) return 'سیستم';
  if (currentUser?.id && actorId === currentUser.id) return 'شما';
  return 'کاربر دیگر';
}

function actionLabel(value) {
  return ACTION_FA[value] || safeUserFacingFa(value, 'فعالیت');
}

function entityLabel(value) {
  return ENTITY_FA[value] || safeUserFacingFa(value, 'رویداد سامانه');
}

function summaryLabel(value) {
  return safeUserFacingFa(value, 'جزئیات این رویداد در گزارش فنی سامانه ثبت شده است.');
}

function filteredRows(category) {
  if (!category || category === 'all') return rows;
  const allowed = CATEGORY_ACTIONS[category];
  if (!allowed) return rows;
  return rows.filter(row => allowed.has(row.action));
}

function rowHtml(row) {
  const summary = String(row.summary || '').trim();
  return `<article class="avan-audit-row"><div class="avan-audit-row-main"><strong>${esc(actionLabel(row.action))}</strong><span>${esc(entityLabel(row.entity_type))}</span>${summary ? `<small>${esc(summaryLabel(summary))}</small>` : ''}</div><div class="avan-audit-row-meta"><span>${esc(actorLabel(row.actor_id))}</span><time>${esc(formatDate(row.created_at))}</time></div></article>`;
}

function cardShell() {
  return `<section class="section card avan-audit-card avan-audit-stable-shell" data-avan-operational-audit data-avan-settings-mounted="audit">
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
      <span class="muted" id="avanAuditStatus">در حال آماده‌سازی…</span>
    </div>
    <div class="avan-audit-list" id="avanAuditList"><div class="loading">در حال خواندن گزارش فعالیت…</div></div>
  </section>`;
}

function removePlaceholder(mount) {
  mount?.querySelector?.(':scope > [data-avan-settings-placeholder="audit"]')?.remove();
}

function ensureCard() {
  const mount = auditMount();
  if (!mount) return null;
  let card = document.querySelector('[data-avan-operational-audit]');
  if (!card) {
    const template = document.createElement('template');
    template.innerHTML = cardShell().trim();
    card = template.content.firstElementChild;
    mount.append(card);
    bindCard(card);
  } else if (card.parentElement !== mount) {
    mount.append(card);
  }
  removePlaceholder(mount);
  return card;
}

function applyRoleVisibility(card = ensureCard()) {
  const filter = card?.querySelector('#avanAuditFilter');
  const note = card?.querySelector('#avanAuditScopeNote');
  if (!filter) return;
  let accessOption = filter.querySelector('option[value="access"]');
  if (isAuditAdminRole()) {
    if (!accessOption) filter.insertAdjacentHTML('beforeend', '<option value="access">کاربران و دسترسی</option>');
    if (note) note.textContent = 'مالک و مدیر شرکت: رویدادهای مدیریتی و دسترسی نیز قابل مشاهده‌اند.';
    return;
  }
  accessOption?.remove();
  if (filter.value === 'access') filter.value = 'all';
  if (note) note.textContent = 'رویدادهای کاربران، دعوت‌ها و تغییرات دسترسی فقط برای مالک یا مدیر همان شرکت قابل مشاهده‌اند.';
}

function paint(category = 'all') {
  const card = ensureCard();
  const list = card?.querySelector('#avanAuditList');
  const status = card?.querySelector('#avanAuditStatus');
  if (!list || !status) return;

  const visible = filteredRows(category);
  status.textContent = `${visible.length.toLocaleString('fa-IR')} رویداد`;
  const signature = JSON.stringify(visible.map(row => [row.id, row.action, row.entity_type, row.actor_id, row.summary, row.created_at]));
  if (list.dataset.signature === signature && rowsSignature === signature) return;
  rowsSignature = signature;
  list.dataset.signature = signature;
  list.innerHTML = visible.length
    ? visible.map(rowHtml).join('')
    : '<div class="muted avan-audit-empty">رویدادی برای این فیلتر وجود ندارد.</div>';
}

async function resolveContext(force = false) {
  currentUser = await cloud.user();
  if (!currentUser?.id) throw new Error('AUTH_REQUIRED');
  const state = force
    ? await companyContext.refresh({ force: true })
    : await companyContext.ensure();
  workspace = state?.active_company || null;
  if (!workspace?.id) throw new Error('COMPANY_REQUIRED');
  workspaceRole = workspace.role || await cloud.rpc('workspace_role', { wid: workspace.id }) || '';
}

async function loadAudit({ forceContext = false } = {}) {
  if (!isSettingsPage()) return;
  if (loadPromise && !forceContext) return loadPromise;
  loadPromise = (async () => {
    loading = true;
    const card = ensureCard();
    const refresh = card?.querySelector('#avanAuditRefresh');
    const status = card?.querySelector('#avanAuditStatus');
    if (refresh) refresh.disabled = true;
    if (status) status.textContent = 'در حال به‌روزرسانی…';
    try {
      if (forceContext || !workspace?.id || !currentUser?.id || !workspaceRole) await resolveContext(forceContext);
      applyRoleVisibility(card);
      rows = await cloud.select('audit_logs', `select=id,actor_id,action,entity_type,entity_id,summary,created_at&workspace_id=eq.${workspace.id}&order=created_at.desc&limit=40`) || [];
      paint(card?.querySelector('#avanAuditFilter')?.value || 'all');
    } catch (error) {
      console.warn('[Avan audit] load failed', error);
      const list = card?.querySelector('#avanAuditList');
      if (list) list.innerHTML = '<div class="error-box">خواندن گزارش فعالیت انجام نشد. دوباره تلاش کنید.</div>';
      if (status) status.textContent = 'خطا در دریافت';
    } finally {
      loading = false;
      if (refresh?.isConnected) refresh.disabled = false;
    }
  })();
  try { return await loadPromise; }
  finally { loadPromise = null; }
}

function bindCard(card) {
  const refresh = card.querySelector('#avanAuditRefresh');
  const filter = card.querySelector('#avanAuditFilter');
  if (refresh) refresh.onclick = () => void loadAudit({ forceContext: true });
  if (filter) filter.onchange = () => paint(filter.value);
}

function onPageRendered() {
  if (!isSettingsPage()) return;
  ensureCard();
  applyRoleVisibility();
  void loadAudit({ forceContext: false });
}

Lifecycle.use('settings:operational-audit-shell', () => {
  if (!isSettingsPage()) return;
  ensureCard();
  applyRoleVisibility();
  if (rows.length) paint(document.getElementById('avanAuditFilter')?.value || 'all');
}, { priority: 45 });

window.addEventListener('avan:page-rendered', onPageRendered);
window.addEventListener('avan:company-context-changed', () => {
  workspace = null;
  workspaceRole = '';
  rows = [];
  rowsSignature = '';
  if (isSettingsPage()) void loadAudit({ forceContext: true });
});
window.addEventListener('avan:company-context-cleared', () => {
  workspace = null;
  workspaceRole = '';
  rows = [];
  rowsSignature = '';
  document.querySelector('[data-avan-operational-audit]')?.remove();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isSettingsPage()) onPageRendered();
  }, { once: true });
} else if (isSettingsPage()) {
  onPageRendered();
}

window.AvanOperationalAudit = Object.freeze({
  architecture: 'stable-settings-shell-v2',
  refresh: () => loadAudit({ forceContext: true }),
  snapshot: () => Object.freeze({
    workspace_id: workspace?.id || null,
    role: workspaceRole,
    loading,
    row_count: rows.length
  })
});
