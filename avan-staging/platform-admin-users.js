'use strict';

import { createSupabaseClient } from './src/infrastructure/supabase/supabase-client.js';

const client = createSupabaseClient({ config: window.AVAN_CONFIG || {}, storage: localStorage });
let users = [];
let installed = false;
let loading = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const faDate = value => {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '—';
  }
};

const roleFa = Object.freeze({
  owner: 'مالک', manager: 'مدیر', accountant: 'حسابدار', viewer: 'مشاهده‌گر'
});

function ensurePanel() {
  if (installed) return;
  const kpis = document.getElementById('platformKpis');
  if (!kpis) return;

  kpis.insertAdjacentHTML('afterend', `
    <section class="panel platform-users-panel" id="platformUsersPanel">
      <div class="panel-head platform-users-head">
        <div>
          <h2>کاربران سامانه</h2>
          <p>همه حساب‌های ثبت‌نام‌شده، حتی کاربران بدون شرکت، در این بخش نمایش داده می‌شوند.</p>
        </div>
        <div class="platform-users-tools">
          <input id="platformUserSearch" type="search" placeholder="جستجو با ایمیل یا نام شرکت">
          <button type="button" class="ghost" id="refreshPlatformUsers">به‌روزرسانی کاربران</button>
        </div>
      </div>
      <div id="platformUserStatus" class="platform-user-status" aria-live="polite"></div>
      <div class="table-wrap platform-users-table-wrap">
        <table class="platform-users-table">
          <thead>
            <tr>
              <th>حساب کاربری</th>
              <th>شرکت / نقش</th>
              <th>ثبت‌نام</th>
              <th>آخرین ورود</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody id="platformUserRows"></tbody>
        </table>
      </div>
      <div class="control-note">حذف مالک شرکت یا مدیر سامانه برای جلوگیری از یتیم‌شدن شرکت و از دست‌رفتن کنترل مدیریتی مسدود است. ابتدا باید مالکیت یا نقش مدیریتی منتقل شود.</div>
    </section>
  `);

  document.getElementById('platformUserSearch')?.addEventListener('input', render);
  document.getElementById('refreshPlatformUsers')?.addEventListener('click', loadUsers);
  installed = true;
}

function membershipHtml(user) {
  const memberships = Array.isArray(user.memberships) ? user.memberships : [];
  if (!memberships.length) return '<span class="badge waiting">بدون شرکت</span>';
  return memberships.map(membership => `
    <div class="platform-user-membership ${membership.is_active ? '' : 'inactive'}">
      <strong>${esc(membership.workspace_name || 'شرکت بدون نام')}</strong>
      <small>${esc(roleFa[membership.role] || membership.role || 'عضو')}${membership.is_active ? '' : ' · غیرفعال'}</small>
    </div>
  `).join('');
}

function userMatches(user, query) {
  if (!query) return true;
  const haystack = [
    user.email,
    ...(user.memberships || []).flatMap(item => [item.workspace_name, item.role])
  ].map(value => String(value || '').toLowerCase()).join(' ');
  return haystack.includes(query);
}

function render() {
  const host = document.getElementById('platformUserRows');
  if (!host) return;
  const query = String(document.getElementById('platformUserSearch')?.value || '').trim().toLowerCase();
  const rows = users.filter(user => userMatches(user, query));

  host.innerHTML = rows.length ? rows.map(user => `
    <tr data-platform-user="${esc(user.id)}">
      <td>
        <div class="platform-user-account">
          <input type="email" data-user-email value="${esc(user.email || '')}" aria-label="ایمیل کاربر">
          <small>${user.email_confirmed_at ? 'ایمیل تأیید شده' : 'ایمیل در انتظار تأیید'}${user.is_self ? ' · حساب فعلی شما' : ''}</small>
        </div>
      </td>
      <td>${membershipHtml(user)}</td>
      <td>${esc(faDate(user.created_at))}</td>
      <td>${esc(faDate(user.last_sign_in_at))}</td>
      <td>
        <div class="platform-user-actions">
          <button type="button" class="primary small" data-save-user>ذخیره ویرایش</button>
          <button type="button" class="danger small" data-delete-user ${user.is_self ? 'disabled' : ''}>حذف کاربر</button>
        </div>
        <small class="platform-user-row-status" aria-live="polite"></small>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="5" class="empty">کاربری پیدا نشد.</td></tr>';

  host.querySelectorAll('[data-save-user]').forEach(button => {
    button.onclick = () => saveUser(button.closest('[data-platform-user]'), button);
  });
  host.querySelectorAll('[data-delete-user]').forEach(button => {
    button.onclick = () => deleteUser(button.closest('[data-platform-user]'), button);
  });
}

function setPanelStatus(text, kind = '') {
  const node = document.getElementById('platformUserStatus');
  if (!node) return;
  node.textContent = text;
  node.className = `platform-user-status ${kind}`.trim();
}

function userErrorMessage(error, fallback) {
  const code = String(error?.payload?.error || error?.message || '');
  if (code === 'EMAIL_INVALID') return 'ایمیل واردشده معتبر نیست.';
  if (code === 'USER_UPDATE_FAILED') return 'ویرایش حساب کاربری انجام نشد؛ ایمیل تکراری یا نامعتبر را بررسی کنید.';
  if (code === 'USER_DELETE_FAILED') return 'حذف حساب کاربری انجام نشد؛ ممکن است داده وابسته محافظت‌شده وجود داشته باشد.';
  if (code === 'USER_DELETE_PROTECTED') {
    if (error?.payload?.is_self) return 'حساب مدیر فعلی از همین صفحه قابل حذف نیست.';
    if (error?.payload?.is_platform_admin) return 'برای حذف این حساب ابتدا نقش مدیریت سامانه آن را منتقل یا غیرفعال کنید.';
    if (Number(error?.payload?.owned_companies || 0) > 0) return 'این کاربر مالک شرکت است؛ ابتدا مالکیت شرکت را منتقل کنید.';
    return 'حذف این حساب به دلیل وابستگی مدیریتی مجاز نیست.';
  }
  if (code === 'PLATFORM_ADMIN_REQUIRED') return 'مجوز مدیریت سامانه برای این عملیات کافی نیست.';
  return fallback;
}

async function loadUsers() {
  ensurePanel();
  if (!installed || loading) return;
  loading = true;
  const refresh = document.getElementById('refreshPlatformUsers');
  if (refresh) refresh.disabled = true;
  setPanelStatus('در حال دریافت فهرست کاربران…');
  try {
    const result = await client.invokeFunction('platform-admin-users', { action: 'list' });
    users = Array.isArray(result?.users) ? result.users : [];
    render();
    setPanelStatus(`${users.length.toLocaleString('fa-IR')} حساب کاربری نمایش داده شد.`, 'ok');
  } catch (error) {
    console.error('[platform users] load failed', error);
    setPanelStatus(userErrorMessage(error, 'فهرست کاربران بارگذاری نشد.'), 'error');
  } finally {
    if (refresh) refresh.disabled = false;
    loading = false;
  }
}

async function saveUser(row, button) {
  if (!row) return;
  const targetUserId = row.dataset.platformUser;
  const email = String(row.querySelector('[data-user-email]')?.value || '').trim();
  const status = row.querySelector('.platform-user-row-status');
  button.disabled = true;
  if (status) status.textContent = 'در حال ذخیره…';
  try {
    await client.invokeFunction('platform-admin-users', {
      action: 'update',
      target_user_id: targetUserId,
      email
    });
    if (status) status.textContent = 'ویرایش ذخیره شد.';
    await loadUsers();
  } catch (error) {
    if (status) status.textContent = userErrorMessage(error, 'ویرایش انجام نشد.');
  } finally {
    button.disabled = false;
  }
}

async function deleteUser(row, button) {
  if (!row) return;
  const targetUserId = row.dataset.platformUser;
  const email = String(row.querySelector('[data-user-email]')?.value || '').trim();
  const status = row.querySelector('.platform-user-row-status');
  if (!confirm(`حساب «${email || 'کاربر انتخاب‌شده'}» حذف شود؟ این عملیات برای حساب‌های مجاز برگشت‌پذیر نیست.`)) return;

  button.disabled = true;
  if (status) status.textContent = 'در حال حذف…';
  try {
    await client.invokeFunction('platform-admin-users', {
      action: 'delete',
      target_user_id: targetUserId
    });
    await loadUsers();
  } catch (error) {
    if (status) status.textContent = userErrorMessage(error, 'حذف انجام نشد.');
  } finally {
    button.disabled = false;
  }
}

window.addEventListener('avan:platform-admin-refreshed', () => {
  ensurePanel();
  loadUsers();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensurePanel, { once: true });
} else {
  ensurePanel();
}