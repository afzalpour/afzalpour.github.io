'use strict';

import { toast } from './src/ui/feedback/toast.js';
import { openModal, closeModal } from './src/ui/components/modal.js';

const REMOVE_TEXTS = new Set([
  'گزارش فارسی از داده‌های معتبر Ledger، آوان SQL آزاد اجرا نمی‌کند؛ درخواست فقط به گزارش‌های کنترل‌شده تبدیل می‌شود.',
  'منبع معتبر: report_trial_balance',
  'Posting در بازه بسته توسط Database مسدود می‌شود.',
  'داده‌های مالی از PostgreSQL/Supabase خوانده می‌شوند؛ LocalStorage فقط Session کاربر را نگه می‌دارد.',
  'کل / معین / تفصیلی — حساب دارای گردش حذف نمی‌شود.',
  'Draft → Posted → Reversed؛ سند Posted و خطوط آن Immutable هستند.',
  'ثبت قطعی فاکتور مستقیماً سند دوبل روی Ledger می‌سازد.'
]);

const DASHBOARD_MUTED_PREFIXES = [
  'CFO Autopilot —',
  'پاسخ از داده‌های واقعی Workspace؛',
  'Continuous Audit Lite —',
  'Duplicate، Integrity،',
  'اولویت‌بندی وصول بر پایه Aging و اثر نقدی',
  'Aging مبتنی بر Ledger'
];

const ROLE_LABEL = {
  owner: 'مالک',
  manager: 'مدیر',
  financial_manager: 'مدیر',
  accountant: 'حسابدار',
  viewer: 'مشاهده‌گر'
};

let scheduled = null;
let workspaceRoleSignature = '';
let workspaceRoles = new Map();
let accessSignature = '';
let accessModel = null;

const normalize = value => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim();

function C() {
  return window.AvanCloud || null;
}

function preferredWorkspaceId() {
  const cloud = C();
  const key = cloud?.ACTIVE_WORKSPACE_KEY || 'avan.active_workspace_id';
  try {
    return window.sessionStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function cleanupTechnicalCopy(root = document) {
  const elements = [];
  if (root instanceof Element) elements.push(root);
  if (root.querySelectorAll) {
    elements.push(...root.querySelectorAll('p,span,small,div'));
  }

  elements.forEach(element => {
    if (!(element instanceof Element)) return;
    if (element.childElementCount) return;
    if (REMOVE_TEXTS.has(normalize(element.textContent))) {
      element.remove();
    }
  });
}

function removeHeadMuted(heading) {
  const head = heading?.closest('.section-head');
  if (!head) return;
  head.querySelectorAll('.muted').forEach(node => node.remove());
}

function compactDashboardCopy() {
  const title = document.getElementById('pageTitle');
  if (normalize(title?.textContent) !== 'داشبورد') return;

  document.querySelectorAll('#content h2,#content h3').forEach(heading => {
    const text = normalize(heading.textContent);

    if (text === '✦ Avan Intelligence') {
      heading.textContent = 'تحلیل مالی';
      removeHeadMuted(heading);
      return;
    }

    if (text === '🛡 Business Risk Radar') {
      heading.textContent = 'کنترل و ریسک';
      removeHeadMuted(heading);
      return;
    }

    if (text === 'Continuous Audit') {
      heading.textContent = 'کنترل‌های مستمر';
      removeHeadMuted(heading);
      return;
    }

    if (text === '🎯 Smart Collection Agent') {
      heading.textContent = 'وصول مطالبات';
      removeHeadMuted(heading);
      return;
    }

    if (text === '✓ Month-End Autopilot') {
      heading.textContent = 'آمادگی پایان دوره';
      removeHeadMuted(heading);
      return;
    }

    if (text === 'مطالبات و بدهی تجاری') {
      heading.textContent = 'سررسید مطالبات و بدهی‌ها';
      removeHeadMuted(heading);
      return;
    }

    if (text === 'از آوان درباره کسب‌وکار بپرس') {
      removeHeadMuted(heading);
    }
  });

  document.querySelectorAll('#content .muted').forEach(node => {
    const text = normalize(node.textContent);
    if (DASHBOARD_MUTED_PREFIXES.some(prefix => text.startsWith(prefix))) {
      node.remove();
    }
  });

  document.querySelectorAll('#content .info-box').forEach(box => {
    const text = normalize(box.textContent);
    if (text.startsWith('این نسخه، Close Assistant است:')) {
      box.remove();
    }
  });
}

async function ensureWorkspaceOptionLabels() {
  const select = document.getElementById('avanWorkspaceSwitcher');
  const cloud = C();
  if (!select || !cloud?.rpc) return;

  const options = [...select.options];
  if (options.length < 2) return;

  options.forEach(option => {
    if (!option.dataset.baseLabel) {
      option.dataset.baseLabel = normalize(option.textContent);
    }
  });

  const counts = new Map();
  options.forEach(option => {
    const base = option.dataset.baseLabel;
    counts.set(base, (counts.get(base) || 0) + 1);
  });

  const signature = options.map(option => option.value).join('|');
  if (signature !== workspaceRoleSignature) {
    workspaceRoleSignature = signature;
    workspaceRoles = new Map();

    await Promise.all(options.map(async option => {
      try {
        const role = await cloud.rpc('workspace_role', { wid: option.value });
        workspaceRoles.set(option.value, role || '');
      } catch {
        workspaceRoles.set(option.value, '');
      }
    }));
  }

  options.forEach(option => {
    const base = option.dataset.baseLabel;
    if ((counts.get(base) || 0) <= 1) {
      option.textContent = base;
      return;
    }

    const role = workspaceRoles.get(option.value) || '';
    const suffix = ROLE_LABEL[role] || 'Workspace';
    option.textContent = `${base} — ${suffix}`;
  });
}

async function currentWorkspaceId() {
  const select = document.getElementById('avanWorkspaceSwitcher');
  if (select?.value) return select.value;

  const preferred = preferredWorkspaceId();
  if (preferred) return preferred;

  const cloud = C();
  if (!cloud?.select) return null;
  try {
    const rows = await cloud.select(
      'workspaces',
      'select=id,name,mode,base_currency,created_at&order=created_at.asc'
    );
    return rows?.[0]?.id || null;
  } catch {
    return null;
  }
}

async function loadAccessForCurrentWorkspace(force = false) {
  const cloud = C();
  if (!cloud?.rpc) return null;
  const wid = await currentWorkspaceId();
  if (!wid) return null;

  const signature = wid;
  if (!force && accessModel && accessSignature === signature) return accessModel;

  try {
    const model = await cloud.rpc('list_workspace_access', { wid });
    accessSignature = signature;
    accessModel = model;
    return model;
  } catch {
    accessSignature = signature;
    accessModel = null;
    return null;
  }
}

function passwordError(error) {
  const text = String(error?.message || error || '');
  if (text.includes('PASSWORD_TOO_SHORT')) return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
  if (text.includes('TARGET_OWNER_PROTECTED')) return 'رمز مالک دیگر از این بخش تغییر نمی‌کند.';
  if (text.includes('TARGET_NOT_MEMBER')) return 'کاربر عضو فعال این Workspace نیست.';
  if (text.includes('SELF_PASSWORD_CHANGE_FORBIDDEN')) return 'رمز خودتان را از بخش حساب کاربری تغییر دهید.';
  if (text.includes('FORBIDDEN')) return 'فقط مالک Workspace می‌تواند رمز کاربران را تغییر دهد.';
  if (error?.status === 404 || text.includes('owner-set-user-password')) {
    return 'سرویس امن تغییر رمز هنوز روی Supabase Deploy نشده است.';
  }
  return 'تغییر رمز انجام نشد.';
}

function passwordModal(member, wid) {
  const email = member?.email || 'این کاربر';

  openModal(`
    <h2>تغییر رمز کاربر</h2>
    <p class="muted">${email}</p>
    <form id="ownerPasswordForm">
      <div class="field">
        <label>رمز عبور جدید</label>
        <input id="ownerNewPassword" type="password" minlength="8" autocomplete="new-password" required>
      </div>
      <div class="field" style="margin-top:10px">
        <label>تکرار رمز عبور</label>
        <input id="ownerNewPassword2" type="password" minlength="8" autocomplete="new-password" required>
      </div>
      <div class="form-actions">
        <button type="button" class="ghost" id="ownerPasswordCancel">انصراف</button>
        <button class="primary" id="ownerPasswordSubmit">ثبت رمز جدید</button>
      </div>
      <div id="ownerPasswordStatus"></div>
    </form>
  `);

  document.getElementById('ownerPasswordCancel').onclick = closeModal;
  document.getElementById('ownerPasswordForm').onsubmit = async event => {
    event.preventDefault();
    const p1 = document.getElementById('ownerNewPassword').value;
    const p2 = document.getElementById('ownerNewPassword2').value;
    const status = document.getElementById('ownerPasswordStatus');
    const submit = document.getElementById('ownerPasswordSubmit');

    if (p1.length < 8) {
      status.innerHTML = '<span class="error-box" style="display:block">رمز عبور باید حداقل ۸ کاراکتر باشد.</span>';
      return;
    }
    if (p1 !== p2) {
      status.innerHTML = '<span class="error-box" style="display:block">دو رمز عبور یکسان نیستند.</span>';
      return;
    }

    submit.disabled = true;
    try {
      await C().invokeFunction('owner-set-user-password', {
        workspace_id: wid,
        target_user_id: member.user_id,
        new_password: p1
      });
      closeModal();
      toast('رمز عبور کاربر تغییر کرد.');
    } catch (error) {
      status.innerHTML = `<span class="error-box" style="display:block">${passwordError(error)}</span>`;
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  };
}

async function ensureOwnerPasswordButtons() {
  const card = document.getElementById('workspaceAccessCard');
  const cloud = C();
  if (!card || !cloud?.invokeFunction) return;

  const wid = await currentWorkspaceId();
  if (!wid) return;

  const model = await loadAccessForCurrentWorkspace();
  if (!model || model.actor_role !== 'owner') return;

  const members = Array.isArray(model.members) ? model.members : [];
  const byId = new Map(members.map(member => [member.user_id, member]));

  card.querySelectorAll('[data-member-id]').forEach(row => {
    const member = byId.get(row.dataset.memberId);
    const actions = row.querySelector('.access-member-actions');
    if (!member || !actions || actions.querySelector('[data-owner-password]')) return;

    const targetRole = member.role === 'financial_manager' ? 'manager' : member.role;
    if (member.is_current || !member.is_active || targetRole === 'owner') return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost small owner-password-btn';
    button.dataset.ownerPassword = member.user_id;
    button.textContent = 'تغییر رمز';
    button.onclick = () => passwordModal(member, wid);
    actions.append(button);
  });
}

function selfPasswordError(error) {
  const text = String(error?.message || error || '');
  if (
    text.toLowerCase().includes('invalid login credentials') ||
    text.toLowerCase().includes('invalid credentials') ||
    error?.status === 400
  ) {
    return 'رمز عبور فعلی صحیح نیست.';
  }
  if (text.includes('AUTH_REQUIRED')) return 'برای تغییر رمز دوباره وارد حساب شوید.';
  return 'تغییر رمز عبور انجام نشد.';
}

async function selfPasswordModal() {
  const cloud = C();
  if (!cloud?.user || !cloud?.login || !cloud?.updatePassword) return;

  const user = await cloud.user();
  if (!user?.email) {
    toast('ایمیل حساب کاربری در دسترس نیست.');
    return;
  }

  openModal(`
    <h2>تغییر رمز عبور</h2>
    <form id="selfPasswordForm">
      <div class="field">
        <label>رمز عبور فعلی</label>
        <input id="selfCurrentPassword" type="password" autocomplete="current-password" required>
      </div>
      <div class="field" style="margin-top:10px">
        <label>رمز عبور جدید</label>
        <input id="selfNewPassword" type="password" minlength="8" autocomplete="new-password" required>
      </div>
      <div class="field" style="margin-top:10px">
        <label>تکرار رمز عبور جدید</label>
        <input id="selfNewPassword2" type="password" minlength="8" autocomplete="new-password" required>
      </div>
      <div class="form-actions">
        <button type="button" class="ghost" id="selfPasswordCancel">انصراف</button>
        <button class="primary" id="selfPasswordSubmit">تغییر رمز</button>
      </div>
      <div id="selfPasswordStatus"></div>
    </form>
  `);

  document.getElementById('selfPasswordCancel').onclick = closeModal;
  document.getElementById('selfPasswordForm').onsubmit = async event => {
    event.preventDefault();

    const current = document.getElementById('selfCurrentPassword').value;
    const p1 = document.getElementById('selfNewPassword').value;
    const p2 = document.getElementById('selfNewPassword2').value;
    const status = document.getElementById('selfPasswordStatus');
    const submit = document.getElementById('selfPasswordSubmit');

    if (p1.length < 8) {
      status.innerHTML = '<span class="error-box" style="display:block">رمز عبور جدید باید حداقل ۸ کاراکتر باشد.</span>';
      return;
    }

    if (p1 !== p2) {
      status.innerHTML = '<span class="error-box" style="display:block">دو رمز عبور جدید یکسان نیستند.</span>';
      return;
    }

    if (current === p1) {
      status.innerHTML = '<span class="error-box" style="display:block">رمز جدید باید با رمز فعلی متفاوت باشد.</span>';
      return;
    }

    submit.disabled = true;
    try {
      await cloud.login(user.email, current);
      await cloud.updatePassword(p1);
      closeModal();
      toast('رمز عبور شما تغییر کرد.');
    } catch (error) {
      status.innerHTML = `<span class="error-box" style="display:block">${selfPasswordError(error)}</span>`;
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  };
}

function ensureSelfPasswordButton() {
  const content = document.getElementById('content');
  if (!content || normalize(document.getElementById('pageTitle')?.textContent) !== 'تنظیمات') return;

  const accountCard = [...content.querySelectorAll('.section.card')]
    .find(card => normalize(card.querySelector('h2')?.textContent) === 'حساب کاربری');

  if (!accountCard || accountCard.querySelector('#selfPasswordBtn')) return;

  const logout = accountCard.querySelector('#logoutBtn');
  if (!logout) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost self-password-btn';
  button.id = 'selfPasswordBtn';
  button.textContent = 'تغییر رمز من';
  button.onclick = () => selfPasswordModal().catch(() => toast('تغییر رمز انجام نشد.'));
  logout.before(button);
}

async function applyRefinements() {
  cleanupTechnicalCopy(document);
  compactDashboardCopy();
  await ensureWorkspaceOptionLabels();
  await ensureOwnerPasswordButtons();
  ensureSelfPasswordButton();
}

function schedule() {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(async () => {
    scheduled = null;
    await applyRefinements();
  }, 100);
}

function install() {
  applyRefinements();
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true
  });

  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-page="settings"]')) {
      accessModel = null;
      accessSignature = '';
      setTimeout(schedule, 150);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}