'use strict';

import {
  toast
} from './src/ui/feedback/toast.js';

const ROLE_LABEL = {
  owner: 'مالک',
  manager: 'مدیر (Admin)',
  financial_manager: 'مدیر (Admin)',
  accountant: 'حسابدار',
  viewer: 'مشاهده‌گر'
};

const ADMIN_ROLES = new Set([
  'owner',
  'manager',
  'financial_manager'
]);

const state = {
  userId: null,
  workspaces: [],
  workspace: null,
  role: null,
  accessModel: null,
  loadingWorkspace: false,
  loadingAccess: false,
  accessError: null,
  refreshedAt: 0
};

const esc = value => String(value ?? '')
  .replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

function cloud() {
  return window.AvanCloud || null;
}

function normalizeRole(role) {
  return role === 'financial_manager'
    ? 'manager'
    : role;
}

function roleLabel(role) {
  return ROLE_LABEL[role] || esc(role || '—');
}

function errorText(error) {
  const text = String(
    error?.message || error || ''
  );

  if (text.includes('SELF_ACCESS_CHANGE_FORBIDDEN')) {
    return 'دسترسی یا نقش خودتان را از این بخش نمی‌توانید تغییر دهید.';
  }
  if (text.includes('LAST_OWNER_PROTECTED')) {
    return 'حداقل یک مالک فعال باید در Workspace باقی بماند.';
  }
  if (text.includes('EMAIL_INVALID')) {
    return 'ایمیل واردشده معتبر نیست.';
  }
  if (text.includes('ROLE_INVALID')) {
    return 'نقش انتخاب‌شده معتبر نیست.';
  }
  if (text.includes('MEMBER_NOT_FOUND')) {
    return 'این عضو دیگر در Workspace وجود ندارد.';
  }
  if (text.includes('INVITATION_NOT_FOUND')) {
    return 'این دعوت دیگر در انتظار نیست.';
  }
  if (text.includes('FORBIDDEN')) {
    return 'برای این تغییر دسترسی کافی ندارید.';
  }
  if (
    error?.status === 404 ||
    text.includes('list_workspace_access') ||
    text.includes('invite_workspace_member') ||
    text.includes('manage_workspace_member')
  ) {
    return 'Patch مدیریت کاربران هنوز روی دیتابیس نصب نشده است.';
  }

  return 'عملیات مدیریت دسترسی انجام نشد.';
}

function sessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function activeWorkspaceKey() {
  return cloud()?.ACTIVE_WORKSPACE_KEY ||
    'avan.active_workspace_id';
}

function settingsHost() {
  const title = document.getElementById('pageTitle');
  if (title?.textContent?.trim() !== 'تنظیمات') {
    return null;
  }
  return document.getElementById('content');
}

function appIsVisible() {
  const shell = document.getElementById('appShell');
  return Boolean(shell && !shell.hidden);
}

async function refreshWorkspaceState(force = false) {
  const C = cloud();
  if (!C?.user || !C?.select || !C?.rpc) return;
  if (state.loadingWorkspace) return;

  const freshEnough =
    !force &&
    state.workspace &&
    Date.now() - state.refreshedAt < 15000;

  if (freshEnough) return;

  state.loadingWorkspace = true;

  try {
    const user = await C.user();
    if (!user?.id) {
      state.userId = null;
      state.workspaces = [];
      state.workspace = null;
      state.role = null;
      state.accessModel = null;
      return;
    }

    state.userId = user.id;

    const workspaces = await C.select(
      'workspaces',
      'select=id,name,mode,base_currency,created_at&order=created_at.asc'
    );

    const previousWorkspaceId = state.workspace?.id || null;

    state.workspaces = Array.isArray(workspaces)
      ? workspaces
      : [];
    state.workspace = state.workspaces[0] || null;

    if (previousWorkspaceId !== state.workspace?.id) {
      state.accessModel = null;
      state.accessError = null;
    }

    state.role = state.workspace
      ? await C.rpc(
          'workspace_role',
          { wid: state.workspace.id }
        )
      : null;

    state.refreshedAt = Date.now();
  } catch (error) {
    console.warn(
      '[Avan access] workspace state unavailable',
      error
    );
  } finally {
    state.loadingWorkspace = false;
  }
}

function workspaceSwitcherHtml() {
  if (state.workspaces.length <= 1 || !state.workspace) {
    return '';
  }

  return `
    <label class="workspace-switcher-label" for="avanWorkspaceSwitcher">
      فضای کاری
    </label>
    <select id="avanWorkspaceSwitcher" class="workspace-switcher-select">
      ${state.workspaces.map(workspace => `
        <option
          value="${esc(workspace.id)}"
          ${workspace.id === state.workspace.id ? 'selected' : ''}
        >${esc(workspace.name || 'Workspace')}</option>
      `).join('')}
    </select>
  `;
}

function workspaceSignature() {
  return [
    state.workspace?.id || '',
    ...state.workspaces.map(
      workspace => `${workspace.id}:${workspace.name || ''}`
    )
  ].join('|');
}

function ensureWorkspaceSwitcher() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || !appIsVisible()) return;

  let host = document.getElementById('avanWorkspaceSwitcherHost');

  if (state.workspaces.length <= 1) {
    host?.remove();
    return;
  }

  if (!host) {
    host = document.createElement('div');
    host.id = 'avanWorkspaceSwitcherHost';
    host.className = 'workspace-switcher';
    topbar.append(host);
  }

  const signature = workspaceSignature();
  if (host.dataset.signature === signature) return;

  host.dataset.signature = signature;
  host.innerHTML = workspaceSwitcherHtml();

  const select = document.getElementById('avanWorkspaceSwitcher');
  if (!select) return;

  select.onchange = () => {
    const nextId = select.value;
    if (!nextId || nextId === state.workspace?.id) return;

    try {
      sessionStore()?.setItem(
        activeWorkspaceKey(),
        nextId
      );
    } catch {
      // Session preference is optional and never stores accounting data.
    }

    location.reload();
  };
}

function currentActorCanManage() {
  return ADMIN_ROLES.has(state.role);
}

async function loadAccessModel(force = false) {
  const C = cloud();
  if (!C?.rpc || !state.workspace || !currentActorCanManage()) {
    state.accessModel = null;
    state.accessError = null;
    return;
  }
  if (state.loadingAccess) return;
  if (state.accessModel && !force) return;

  state.loadingAccess = true;
  state.accessError = null;

  try {
    state.accessModel = await C.rpc(
      'list_workspace_access',
      { wid: state.workspace.id }
    );
  } catch (error) {
    state.accessModel = null;
    state.accessError = errorText(error);
  } finally {
    state.loadingAccess = false;
  }
}

function inviteRoleOptions(actorRole) {
  if (normalizeRole(actorRole) === 'owner') {
    return `
      <option value="accountant">حسابدار</option>
      <option value="manager">مدیر (Admin)</option>
      <option value="owner">مالک</option>
    `;
  }

  return '<option value="accountant">حسابدار</option>';
}

function memberRoleOptions(member, actorRole) {
  const current = normalizeRole(member.role);
  const actor = normalizeRole(actorRole);
  const disabled =
    member.is_current ||
    (actor !== 'owner' && current !== 'accountant');

  const allowed = actor === 'owner'
    ? ['owner','manager','accountant']
    : ['accountant'];

  const options = [];

  if (!allowed.includes(current)) {
    options.push(
      `<option value="${esc(member.role)}" selected>${roleLabel(member.role)}</option>`
    );
  }

  allowed.forEach(role => {
    options.push(
      `<option value="${role}" ${current === role ? 'selected' : ''}>${roleLabel(role)}</option>`
    );
  });

  return `
    <select
      class="access-role-select"
      data-member-role="${esc(member.user_id)}"
      ${disabled ? 'disabled' : ''}
    >${options.join('')}</select>
  `;
}

function canActOnMember(member, actorRole) {
  if (member.is_current) return false;
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(member.role);
  return actor === 'owner' || target === 'accountant';
}

function memberRowHtml(member, actorRole) {
  const canAct = canActOnMember(member, actorRole);
  const active = Boolean(member.is_active);

  return `
    <div class="access-member-row" data-member-id="${esc(member.user_id)}">
      <div class="access-member-identity">
        <strong>${esc(member.email || 'بدون ایمیل')}</strong>
        ${member.is_current ? '<span class="access-you">شما</span>' : ''}
      </div>
      <div>${memberRoleOptions(member, actorRole)}</div>
      <div>
        <span class="badge ${active ? 'posted' : 'reversed'}">
          ${active ? 'فعال' : 'غیرفعال'}
        </span>
      </div>
      <div class="access-member-actions">
        <button
          type="button"
          class="${active ? 'ghost' : 'good-btn'} small"
          data-member-active="${esc(member.user_id)}"
          data-next-active="${active ? 'false' : 'true'}"
          ${canAct ? '' : 'disabled'}
        >${active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
      </div>
    </div>
  `;
}

function invitationRowHtml(invitation, actorRole) {
  const actor = normalizeRole(actorRole);
  const canCancel =
    actor === 'owner' ||
    normalizeRole(invitation.role) === 'accountant';

  return `
    <div class="access-invite-row">
      <div>
        <strong>${esc(invitation.email)}</strong>
        <small>در انتظار پذیرش</small>
      </div>
      <span class="badge draft">${roleLabel(invitation.role)}</span>
      <button
        type="button"
        class="ghost small"
        data-cancel-invite="${esc(invitation.id)}"
        ${canCancel ? '' : 'disabled'}
      >لغو دعوت</button>
    </div>
  `;
}

function accessCardHtml() {
  const workspaceName = esc(
    state.workspace?.name || 'Workspace'
  );

  if (state.loadingAccess) {
    return `
      <div class="section card access-card" id="workspaceAccessCard">
        <h2>کاربران و دسترسی‌ها</h2>
        <div class="loading">در حال خواندن اعضای ${workspaceName}…</div>
      </div>
    `;
  }

  if (state.accessError) {
    return `
      <div class="section card access-card" id="workspaceAccessCard">
        <h2>کاربران و دسترسی‌ها</h2>
        <div class="error-box">${esc(state.accessError)}</div>
      </div>
    `;
  }

  const model = state.accessModel || {};
  const members = Array.isArray(model.members)
    ? model.members
    : [];
  const invitations = Array.isArray(model.invitations)
    ? model.invitations
    : [];
  const actorRole = model.actor_role || state.role;

  return `
    <div class="section card access-card" id="workspaceAccessCard">
      <div class="section-head access-card-head">
        <div>
          <h2>کاربران و دسترسی‌ها</h2>
          <span class="muted">${workspaceName}</span>
        </div>
        <span class="badge">${members.filter(member => member.is_active).length} عضو فعال</span>
      </div>

      <form id="workspaceInviteForm" class="access-invite-form">
        <div class="field access-email-field">
          <label>ایمیل کاربر</label>
          <input
            type="email"
            name="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
          >
        </div>
        <div class="field access-role-field">
          <label>نقش</label>
          <select name="role">${inviteRoleOptions(actorRole)}</select>
        </div>
        <button class="primary" type="submit">دعوت / افزودن</button>
      </form>

      <div class="access-list">
        <div class="access-list-head">
          <span>کاربر</span><span>نقش</span><span>وضعیت</span><span>اقدام</span>
        </div>
        ${members.length
          ? members.map(member => memberRowHtml(member, actorRole)).join('')
          : '<div class="empty">عضوی ثبت نشده است.</div>'}
      </div>

      ${invitations.length ? `
        <div class="access-pending">
          <h3>دعوت‌های در انتظار</h3>
          ${invitations.map(invitation => invitationRowHtml(invitation, actorRole)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function accessSignature() {
  return JSON.stringify({
    workspace: state.workspace?.id || null,
    role: state.role || null,
    loading: state.loadingAccess,
    error: state.accessError,
    model: state.accessModel
  });
}

function placeAccessCard(force = false) {
  const host = settingsHost();
  if (!host) {
    document.getElementById('workspaceAccessCard')?.remove();
    return;
  }

  if (!currentActorCanManage()) {
    document.getElementById('workspaceAccessCard')?.remove();
    return;
  }

  const signature = accessSignature();
  const existing = document.getElementById('workspaceAccessCard');

  if (!force && existing?.dataset.signature === signature) {
    return;
  }

  const html = accessCardHtml();

  if (existing) {
    existing.outerHTML = html;
  } else {
    const currencyCard = document.getElementById('currencySettingsCard');
    if (currencyCard) {
      currencyCard.insertAdjacentHTML('afterend', html);
    } else {
      host.insertAdjacentHTML('afterbegin', html);
    }
  }

  const card = document.getElementById('workspaceAccessCard');
  if (card) card.dataset.signature = signature;

  bindAccessCard();
}

async function refreshAccessCard(force = false) {
  if (!settingsHost() || !currentActorCanManage()) return;
  if (force) state.accessModel = null;

  if (!state.accessModel && !state.accessError) {
    state.loadingAccess = true;
    placeAccessCard(true);
    state.loadingAccess = false;
  }

  await loadAccessModel(force);
  placeAccessCard(true);
}

async function inviteMember(form) {
  const C = cloud();
  if (!C?.rpc || !state.workspace) return;

  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const role = String(data.get('role') || 'accountant');
  const submit = form.querySelector('button[type="submit"]');

  if (submit) submit.disabled = true;

  try {
    const result = await C.rpc(
      'invite_workspace_member',
      {
        wid: state.workspace.id,
        p_email: email,
        p_role: role
      }
    );

    const status = result?.status || '';

    if (status === 'member_added') {
      toast('کاربر به Workspace اضافه شد.');
    } else if (status === 'member_reactivated') {
      toast('دسترسی کاربر دوباره فعال شد.');
    } else if (status === 'already_member') {
      toast('این کاربر از قبل عضو Workspace است.');
    } else if (status === 'invitation_pending') {
      toast('دعوت ثبت شد؛ پس از ساخت و تأیید حساب با همین ایمیل فعال می‌شود.');
    } else {
      toast('دسترسی کاربر ثبت شد.');
    }

    form.reset();
    await refreshAccessCard(true);
  } catch (error) {
    toast(errorText(error));
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

async function changeMemberRole(select) {
  const memberId = select.dataset.memberRole;
  const member = state.accessModel?.members?.find(
    item => item.user_id === memberId
  );
  if (!member || !state.workspace) return;

  const nextRole = select.value;
  const previousRole = member.role;

  if (normalizeRole(previousRole) === nextRole) return;

  const ok = confirm(
    `نقش ${member.email || 'این کاربر'} به «${roleLabel(nextRole)}» تغییر کند؟`
  );

  if (!ok) {
    select.value = normalizeRole(previousRole);
    return;
  }

  select.disabled = true;

  try {
    await cloud().rpc(
      'manage_workspace_member',
      {
        wid: state.workspace.id,
        p_user_id: memberId,
        p_role: nextRole,
        p_active: Boolean(member.is_active)
      }
    );
    toast('نقش کاربر تغییر کرد.');
    await refreshAccessCard(true);
  } catch (error) {
    toast(errorText(error));
    await refreshAccessCard(true);
  }
}

async function toggleMemberActive(button) {
  const memberId = button.dataset.memberActive;
  const member = state.accessModel?.members?.find(
    item => item.user_id === memberId
  );
  if (!member || !state.workspace) return;

  const nextActive = button.dataset.nextActive === 'true';
  const action = nextActive ? 'فعال' : 'غیرفعال';

  if (!confirm(`دسترسی ${member.email || 'این کاربر'} ${action} شود؟`)) {
    return;
  }

  button.disabled = true;

  try {
    await cloud().rpc(
      'manage_workspace_member',
      {
        wid: state.workspace.id,
        p_user_id: memberId,
        p_role: member.role,
        p_active: nextActive
      }
    );
    toast(nextActive ? 'دسترسی کاربر فعال شد.' : 'دسترسی کاربر غیرفعال شد.');
    await refreshAccessCard(true);
  } catch (error) {
    toast(errorText(error));
    await refreshAccessCard(true);
  }
}

async function cancelInvitation(button) {
  const invitationId = button.dataset.cancelInvite;
  if (!invitationId || !state.workspace) return;
  if (!confirm('این دعوت لغو شود؟')) return;

  button.disabled = true;

  try {
    await cloud().rpc(
      'cancel_workspace_invitation',
      {
        wid: state.workspace.id,
        p_invitation_id: invitationId
      }
    );
    toast('دعوت لغو شد.');
    await refreshAccessCard(true);
  } catch (error) {
    toast(errorText(error));
    await refreshAccessCard(true);
  }
}

function bindAccessCard() {
  const form = document.getElementById('workspaceInviteForm');
  if (form) {
    form.onsubmit = event => {
      event.preventDefault();
      inviteMember(form);
    };
  }

  document
    .querySelectorAll('[data-member-role]')
    .forEach(select => {
      select.onchange = () => changeMemberRole(select);
    });

  document
    .querySelectorAll('[data-member-active]')
    .forEach(button => {
      button.onclick = () => toggleMemberActive(button);
    });

  document
    .querySelectorAll('[data-cancel-invite]')
    .forEach(button => {
      button.onclick = () => cancelInvitation(button);
    });
}

let scheduled = null;

function scheduleUiSync(force = false) {
  if (scheduled) clearTimeout(scheduled);

  scheduled = setTimeout(async () => {
    scheduled = null;
    if (!appIsVisible()) return;

    await refreshWorkspaceState(force);
    ensureWorkspaceSwitcher();

    if (settingsHost() && currentActorCanManage()) {
      const card = document.getElementById('workspaceAccessCard');

      if (!card) {
        placeAccessCard(false);
      }

      if (!state.accessModel && !state.loadingAccess && !state.accessError) {
        await refreshAccessCard(false);
      }
    } else {
      document.getElementById('workspaceAccessCard')?.remove();
    }
  }, 80);
}

function installObserver() {
  const observer = new MutationObserver(mutations => {
    const meaningful = mutations.some(mutation => {
      if (mutation.type === 'attributes') return true;

      return [...mutation.addedNodes, ...mutation.removedNodes]
        .some(node => {
          if (!(node instanceof Element)) return false;
          if (node.id === 'workspaceAccessCard') return false;
          if (node.id === 'avanWorkspaceSwitcherHost') return false;
          if (node.closest?.('#workspaceAccessCard')) return false;
          if (node.closest?.('#avanWorkspaceSwitcherHost')) return false;
          return true;
        });
    });

    if (meaningful) scheduleUiSync(false);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden']
  });
}

function install() {
  installObserver();
  scheduleUiSync(true);

  document.addEventListener('click', event => {
    const settingsButton = event.target.closest?.('[data-page="settings"]');
    if (settingsButton) {
      state.accessModel = null;
      state.accessError = null;
      setTimeout(() => scheduleUiSync(true), 120);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    install,
    { once: true }
  );
} else {
  install();
}
