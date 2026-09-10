'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';
import { toast } from '../feedback/toast.js';

const ROLE_LABEL = Object.freeze({
  owner: 'مالک',
  manager: 'مدیر (Admin)',
  financial_manager: 'مدیر (Admin)',
  accountant: 'حسابدار',
  viewer: 'مشاهده‌گر'
});
const ADMIN_ROLES = new Set(['owner', 'manager', 'financial_manager']);

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const normalizeRole = role => role === 'financial_manager' ? 'manager' : role;
const roleLabel = role => ROLE_LABEL[role] || esc(role || '—');

function errorText(error) {
  const text = String(error?.message || error || '');
  if (text.includes('SELF_ACCESS_CHANGE_FORBIDDEN')) return 'دسترسی یا نقش خودتان را از این بخش نمی‌توانید تغییر دهید.';
  if (text.includes('LAST_OWNER_PROTECTED')) return 'حداقل یک مالک فعال باید در شرکت باقی بماند.';
  if (text.includes('EMAIL_INVALID')) return 'ایمیل واردشده معتبر نیست.';
  if (text.includes('ROLE_INVALID')) return 'نقش انتخاب‌شده معتبر نیست.';
  if (text.includes('MEMBER_NOT_FOUND')) return 'این عضو دیگر در شرکت وجود ندارد.';
  if (text.includes('INVITATION_NOT_FOUND')) return 'این دعوت دیگر در انتظار نیست.';
  if (text.includes('FORBIDDEN')) return 'برای این تغییر دسترسی کافی ندارید.';
  if (error?.status === 404 || /list_workspace_access|invite_workspace_member|manage_workspace_member/.test(text)) {
    return 'زیرساخت مدیریت کاربران در دسترس نیست.';
  }
  return 'عملیات مدیریت دسترسی انجام نشد.';
}

export function installWorkspaceAccessSettings({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanWorkspaceAccessSettings?.installed) return globalObject.AvanWorkspaceAccessSettings;

  const C = installAvanCloud({ globalObject });
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  const state = {
    userId: null,
    companies: [],
    company: null,
    role: null,
    accessModel: null,
    accessError: null,
    loadingContext: false,
    loadingAccess: false,
    contextPromise: null,
    accessPromise: null
  };

  const isSettings = () => documentObject.getElementById('pageTitle')?.textContent?.trim() === 'تنظیمات';
  const settingsHost = () => isSettings() ? documentObject.getElementById('content') : null;
  const canManage = () => ADMIN_ROLES.has(state.role);
  const companyName = company => String(company?.display_name || company?.name || 'شرکت').trim();

  function accessMount() {
    const host = settingsHost();
    return host ? (host.querySelector('[data-avan-access-slot]') || host) : null;
  }

  function removePlaceholder(mount) {
    mount?.querySelector?.(':scope > [data-avan-settings-placeholder="access"]')?.remove();
  }

  function ensureAccessShell() {
    const mount = accessMount();
    if (!mount || !canManage()) return null;
    mount.hidden = false;
    let card = documentObject.getElementById('workspaceAccessCard');
    if (!card) {
      card = documentObject.createElement('section');
      card.id = 'workspaceAccessCard';
      card.className = 'section card access-card avan-access-stable-shell';
      card.dataset.avanSettingsMounted = 'access';
      card.innerHTML = `
        <div class="section-head access-card-head">
          <div>
            <h2>کاربران و دسترسی‌ها</h2>
            <span class="muted" data-avan-access-company>در حال خواندن شرکت فعال…</span>
          </div>
          <span class="badge" data-avan-access-count>در حال بارگذاری</span>
        </div>
        <div class="avan-access-stable-body" data-avan-access-body>
          <div class="loading">در حال خواندن کاربران و دسترسی‌ها…</div>
        </div>`;
      mount.append(card);
    } else if (card.parentElement !== mount) {
      mount.append(card);
    }
    removePlaceholder(mount);
    return card;
  }

  function hideAccessSlot() {
    documentObject.getElementById('workspaceAccessCard')?.remove();
    const mount = accessMount();
    if (mount) {
      removePlaceholder(mount);
      mount.hidden = true;
    }
  }

  async function refreshContext(force = false) {
    if (state.contextPromise && !force) return state.contextPromise;
    state.contextPromise = (async () => {
      state.loadingContext = true;
      try {
        const snapshot = force
          ? await C.companyContext.refresh({ force: true })
          : await C.companyContext.ensure();
        const previousId = state.company?.id || null;
        state.userId = snapshot?.user_id || null;
        state.companies = Array.isArray(snapshot?.companies) ? snapshot.companies : [];
        state.company = snapshot?.active_company || null;
        state.role = state.company?.role || null;
        if (previousId !== (state.company?.id || null)) {
          state.accessModel = null;
          state.accessError = null;
        }
        return snapshot;
      } finally {
        state.loadingContext = false;
      }
    })();
    try { return await state.contextPromise; }
    finally { state.contextPromise = null; }
  }

  function workspaceSwitcherSignature() {
    return JSON.stringify({
      active: state.company?.id || null,
      companies: state.companies.map(company => [company.id, companyName(company)])
    });
  }

  function ensureWorkspaceSwitcher() {
    const topbar = documentObject.querySelector('.topbar');
    const shell = documentObject.getElementById('appShell');
    if (!topbar || shell?.hidden) return;
    let host = documentObject.getElementById('avanWorkspaceSwitcherHost');
    if (state.companies.length <= 1 || !state.company) {
      host?.remove();
      return;
    }
    if (!host) {
      host = documentObject.createElement('div');
      host.id = 'avanWorkspaceSwitcherHost';
      host.className = 'workspace-switcher';
      topbar.append(host);
    }
    const signature = workspaceSwitcherSignature();
    if (host.dataset.signature === signature) return;
    host.dataset.signature = signature;
    host.innerHTML = `
      <label class="workspace-switcher-label" for="avanWorkspaceSwitcher">فضای کاری</label>
      <select id="avanWorkspaceSwitcher" class="workspace-switcher-select">
        ${state.companies.map(company => `<option value="${esc(company.id)}" ${company.id === state.company.id ? 'selected' : ''}>${esc(companyName(company))}</option>`).join('')}
      </select>`;
    const select = host.querySelector('#avanWorkspaceSwitcher');
    if (select) select.onchange = async () => {
      const nextId = select.value;
      if (!nextId || nextId === state.company?.id) return;
      select.disabled = true;
      try {
        await C.companyContext.selectCompany(nextId, { emit: false });
        globalObject.location?.reload?.();
      } catch (error) {
        select.disabled = false;
        toast(errorText(error));
      }
    };
  }

  async function loadAccessModel(force = false) {
    if (!state.company || !canManage()) return null;
    if (state.accessModel && !force) return state.accessModel;
    if (state.accessPromise && !force) return state.accessPromise;
    state.accessPromise = (async () => {
      state.loadingAccess = true;
      state.accessError = null;
      try {
        state.accessModel = await C.rpc('list_workspace_access', { wid: state.company.id });
        return state.accessModel;
      } catch (error) {
        state.accessModel = null;
        state.accessError = errorText(error);
        return null;
      } finally {
        state.loadingAccess = false;
      }
    })();
    try { return await state.accessPromise; }
    finally { state.accessPromise = null; }
  }

  function inviteRoleOptions(actorRole) {
    return normalizeRole(actorRole) === 'owner'
      ? '<option value="accountant">حسابدار</option><option value="manager">مدیر (Admin)</option><option value="owner">مالک</option>'
      : '<option value="accountant">حسابدار</option>';
  }

  function memberRoleOptions(member, actorRole) {
    const current = normalizeRole(member.role);
    const actor = normalizeRole(actorRole);
    const disabled = member.is_current || (actor !== 'owner' && current !== 'accountant');
    const allowed = actor === 'owner' ? ['owner', 'manager', 'accountant'] : ['accountant'];
    const options = [];
    if (!allowed.includes(current)) options.push(`<option value="${esc(member.role)}" selected>${roleLabel(member.role)}</option>`);
    allowed.forEach(role => options.push(`<option value="${role}" ${current === role ? 'selected' : ''}>${roleLabel(role)}</option>`));
    return `<select class="access-role-select" data-member-role="${esc(member.user_id)}" ${disabled ? 'disabled' : ''}>${options.join('')}</select>`;
  }

  function canActOnMember(member, actorRole) {
    if (member.is_current) return false;
    return normalizeRole(actorRole) === 'owner' || normalizeRole(member.role) === 'accountant';
  }

  function memberRowHtml(member, actorRole) {
    const active = Boolean(member.is_active);
    return `<div class="access-member-row" data-member-id="${esc(member.user_id)}">
      <div class="access-member-identity"><strong>${esc(member.email || 'بدون ایمیل')}</strong>${member.is_current ? '<span class="access-you">شما</span>' : ''}</div>
      <div>${memberRoleOptions(member, actorRole)}</div>
      <div><span class="badge ${active ? 'posted' : 'reversed'}">${active ? 'فعال' : 'غیرفعال'}</span></div>
      <div class="access-member-actions"><button type="button" class="${active ? 'ghost' : 'good-btn'} small" data-member-active="${esc(member.user_id)}" data-next-active="${active ? 'false' : 'true'}" ${canActOnMember(member, actorRole) ? '' : 'disabled'}>${active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button></div>
    </div>`;
  }

  function invitationRowHtml(invitation, actorRole) {
    const canCancel = normalizeRole(actorRole) === 'owner' || normalizeRole(invitation.role) === 'accountant';
    return `<div class="access-invite-row">
      <div><strong>${esc(invitation.email)}</strong><small>در انتظار پذیرش</small></div>
      <span class="badge draft">${roleLabel(invitation.role)}</span>
      <button type="button" class="ghost small" data-cancel-invite="${esc(invitation.id)}" ${canCancel ? '' : 'disabled'}>لغو دعوت</button>
    </div>`;
  }

  function renderAccessModel() {
    if (!isSettings()) return;
    if (!canManage()) {
      hideAccessSlot();
      return;
    }
    const card = ensureAccessShell();
    if (!card) return;
    const companyNode = card.querySelector('[data-avan-access-company]');
    if (companyNode) companyNode.textContent = companyName(state.company);
    const body = card.querySelector('[data-avan-access-body]');
    const count = card.querySelector('[data-avan-access-count]');
    if (state.accessError) {
      if (count) count.textContent = 'خطا';
      if (body && body.dataset.signature !== `error:${state.accessError}`) {
        body.dataset.signature = `error:${state.accessError}`;
        body.innerHTML = `<div class="error-box">${esc(state.accessError)}</div>`;
      }
      return;
    }
    if (!state.accessModel) return;
    const model = state.accessModel || {};
    const members = Array.isArray(model.members) ? model.members : [];
    const invitations = Array.isArray(model.invitations) ? model.invitations : [];
    const actorRole = model.actor_role || state.role;
    if (count) count.textContent = `${members.filter(member => member.is_active).length.toLocaleString('fa-IR')} عضو فعال`;
    const signature = JSON.stringify({ company: state.company?.id, role: actorRole, members, invitations });
    if (!body || body.dataset.signature === signature) return;
    body.dataset.signature = signature;
    body.innerHTML = `
      <form id="workspaceInviteForm" class="access-invite-form">
        <div class="field access-email-field"><label>ایمیل کاربر</label><input type="email" name="email" autocomplete="email" placeholder="name@example.com" required></div>
        <div class="field access-role-field"><label>نقش</label><select name="role">${inviteRoleOptions(actorRole)}</select></div>
        <button class="primary" type="submit">دعوت / افزودن</button>
      </form>
      <div class="access-list">
        <div class="access-list-head"><span>کاربر</span><span>نقش</span><span>وضعیت</span><span>اقدام</span></div>
        ${members.length ? members.map(member => memberRowHtml(member, actorRole)).join('') : '<div class="empty">عضوی ثبت نشده است.</div>'}
      </div>
      ${invitations.length ? `<div class="access-pending"><h3>دعوت‌های در انتظار</h3>${invitations.map(invitation => invitationRowHtml(invitation, actorRole)).join('')}</div>` : ''}`;
    bindAccessCard();
  }

  async function refreshAccess(force = false) {
    await loadAccessModel(force);
    renderAccessModel();
  }

  async function inviteMember(form) {
    if (!state.company) return;
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const result = await C.rpc('invite_workspace_member', {
        wid: state.company.id,
        p_email: String(data.get('email') || '').trim(),
        p_role: String(data.get('role') || 'accountant')
      });
      const status = result?.status || '';
      toast(status === 'member_added' ? 'کاربر به شرکت اضافه شد.' : status === 'member_reactivated' ? 'دسترسی کاربر دوباره فعال شد.' : status === 'already_member' ? 'این کاربر از قبل عضو شرکت است.' : status === 'invitation_pending' ? 'دعوت ثبت شد؛ پس از ساخت و تأیید حساب فعال می‌شود.' : 'دسترسی کاربر ثبت شد.');
      form.reset();
      await refreshAccess(true);
    } catch (error) {
      toast(errorText(error));
    } finally {
      if (submit?.isConnected) submit.disabled = false;
    }
  }

  async function changeMemberRole(select) {
    const member = state.accessModel?.members?.find(item => item.user_id === select.dataset.memberRole);
    if (!member || !state.company) return;
    const nextRole = select.value;
    const previousRole = member.role;
    if (normalizeRole(previousRole) === nextRole) return;
    if (!globalObject.confirm(`نقش ${member.email || 'این کاربر'} به «${roleLabel(nextRole)}» تغییر کند؟`)) {
      select.value = normalizeRole(previousRole);
      return;
    }
    select.disabled = true;
    try {
      await C.rpc('manage_workspace_member', { wid: state.company.id, p_user_id: member.user_id, p_role: nextRole, p_active: Boolean(member.is_active) });
      toast('نقش کاربر تغییر کرد.');
    } catch (error) {
      toast(errorText(error));
    }
    await refreshAccess(true);
  }

  async function toggleMemberActive(button) {
    const member = state.accessModel?.members?.find(item => item.user_id === button.dataset.memberActive);
    if (!member || !state.company) return;
    const nextActive = button.dataset.nextActive === 'true';
    if (!globalObject.confirm(`دسترسی ${member.email || 'این کاربر'} ${nextActive ? 'فعال' : 'غیرفعال'} شود؟`)) return;
    button.disabled = true;
    try {
      await C.rpc('manage_workspace_member', { wid: state.company.id, p_user_id: member.user_id, p_role: member.role, p_active: nextActive });
      toast(nextActive ? 'دسترسی کاربر فعال شد.' : 'دسترسی کاربر غیرفعال شد.');
    } catch (error) {
      toast(errorText(error));
    }
    await refreshAccess(true);
  }

  async function cancelInvitation(button) {
    if (!state.company || !globalObject.confirm('این دعوت لغو شود؟')) return;
    button.disabled = true;
    try {
      await C.rpc('cancel_workspace_invitation', { wid: state.company.id, p_invitation_id: button.dataset.cancelInvite });
      toast('دعوت لغو شد.');
    } catch (error) {
      toast(errorText(error));
    }
    await refreshAccess(true);
  }

  function bindAccessCard() {
    const card = documentObject.getElementById('workspaceAccessCard');
    if (!card) return;
    const form = card.querySelector('#workspaceInviteForm');
    if (form) form.onsubmit = event => { event.preventDefault(); void inviteMember(form); };
    card.querySelectorAll('[data-member-role]').forEach(select => { select.onchange = () => void changeMemberRole(select); });
    card.querySelectorAll('[data-member-active]').forEach(button => { button.onclick = () => void toggleMemberActive(button); });
    card.querySelectorAll('[data-cancel-invite]').forEach(button => { button.onclick = () => void cancelInvitation(button); });
  }

  async function sync({ forceContext = false, forceAccess = false, prefetch = true } = {}) {
    await refreshContext(forceContext);
    ensureWorkspaceSwitcher();
    if (canManage() && prefetch) await loadAccessModel(forceAccess);
    if (isSettings()) renderAccessModel();
  }

  function onPageRendered() {
    globalObject.queueMicrotask?.(() => {
      if (isSettings()) ensureAccessShell();
      void sync({ prefetch: true });
    });
  }

  Lifecycle.use('settings:workspace-access-shell', () => {
    if (isSettings()) {
      if (canManage()) ensureAccessShell();
      renderAccessModel();
    }
  }, { priority: 30 });

  globalObject.addEventListener('avan:page-rendered', onPageRendered);
  globalObject.addEventListener('avan:company-context-changed', () => {
    state.accessModel = null;
    state.accessError = null;
    void sync({ forceContext: true, forceAccess: true, prefetch: true });
  });
  globalObject.addEventListener('avan:company-context-cleared', () => {
    state.company = null;
    state.companies = [];
    state.role = null;
    state.accessModel = null;
    state.accessError = null;
    documentObject.getElementById('workspaceAccessCard')?.remove();
    documentObject.getElementById('avanWorkspaceSwitcherHost')?.remove();
  });

  const api = Object.freeze({
    installed: true,
    architecture: 'stable-settings-shell-v1',
    sync,
    refresh: () => refreshAccess(true),
    snapshot: () => Object.freeze({
      company_id: state.company?.id || null,
      role: state.role,
      loading_access: state.loadingAccess,
      has_access_model: Boolean(state.accessModel)
    })
  });
  globalObject.AvanWorkspaceAccessSettings = api;
  void sync({ prefetch: true });
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installWorkspaceAccessSettings();
