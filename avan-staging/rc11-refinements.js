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
      'select=id,created_at&order=created_at.asc'
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

async function applyRefinements() {
  cleanupTechnicalCopy(document);
  await ensureWorkspaceOptionLabels();
  await ensureOwnerPasswordButtons();
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
