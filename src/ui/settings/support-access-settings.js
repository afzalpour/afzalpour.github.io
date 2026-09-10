'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { installUiLifecycle } from '../runtime/lifecycle.js';

const ADMIN_ROLES = new Set(['owner', 'manager', 'financial_manager']);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

function faDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

export function installSupportAccessSettings({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanSupportAccessSettings?.installed) return globalObject.AvanSupportAccessSettings;

  const C = installAvanCloud({ globalObject });
  const Lifecycle = installUiLifecycle({ globalObject, documentObject });
  const state = {
    company: null,
    rows: null,
    loading: false,
    loadPromise: null,
    signature: null
  };

  const isSettings = () => documentObject.getElementById('pageTitle')?.textContent?.trim() === 'تنظیمات';
  const canSee = () => ADMIN_ROLES.has(state.company?.role);

  function supportMount() {
    if (!isSettings()) return null;
    const root = documentObject.getElementById('content');
    return root ? (root.querySelector('[data-avan-support-slot]') || root) : null;
  }

  function removePlaceholder(mount) {
    mount?.querySelector?.(':scope > [data-avan-settings-placeholder="support"]')?.remove();
  }

  function ensureShell() {
    const mount = supportMount();
    if (!mount || !canSee()) return null;
    mount.hidden = false;
    let card = documentObject.getElementById('avanSupportAccessCard');
    if (!card) {
      card = documentObject.createElement('section');
      card.id = 'avanSupportAccessCard';
      card.className = 'section card avan-support-access-card avan-support-stable-shell';
      card.dataset.avanSettingsMounted = 'support';
      card.innerHTML = `
        <div class="support-card-head">
          <div>
            <h2>دسترسی پشتیبانی آوان</h2>
            <p class="muted">Platform Admin فقط با Session موقت و فقط‌خواندنی می‌تواند داده محدود پشتیبانی را ببیند. این دسترسی عضویت شرکت ایجاد نمی‌کند.</p>
          </div>
        </div>
        <div class="support-session-list" data-avan-support-list>
          <div class="loading">در حال خواندن وضعیت دسترسی پشتیبانی…</div>
        </div>`;
      mount.append(card);
    } else if (card.parentElement !== mount) {
      mount.append(card);
    }
    removePlaceholder(mount);
    return card;
  }

  function hideSlot() {
    documentObject.getElementById('avanSupportAccessCard')?.remove();
    const mount = supportMount();
    if (mount) {
      removePlaceholder(mount);
      mount.hidden = true;
    }
  }

  function rowsSignature(rows) {
    return JSON.stringify((Array.isArray(rows) ? rows : []).map(row => ({
      id: row.session_id,
      active: Boolean(row.active),
      reason: row.reason || '',
      created_at: row.created_at || '',
      expires_at: row.expires_at || '',
      last_accessed_at: row.last_accessed_at || ''
    })));
  }

  function renderRows() {
    if (!isSettings()) return;
    if (!canSee()) {
      hideSlot();
      return;
    }
    const card = ensureShell();
    const listNode = card?.querySelector('[data-avan-support-list]');
    if (!listNode || !Array.isArray(state.rows)) return;
    const signature = rowsSignature(state.rows);
    if (state.signature === signature && listNode.dataset.signature === signature) return;
    state.signature = signature;
    listNode.dataset.signature = signature;
    listNode.innerHTML = state.rows.length
      ? state.rows.map(row => `<article class="support-session-row ${row.active ? 'active' : ''}">
          <div>
            <strong>${row.active ? 'فعال' : 'پایان‌یافته'} · فقط‌خواندنی</strong>
            <span>دلیل: ${esc(row.reason || '—')}</span>
            <small>شروع ${esc(faDate(row.created_at))} · انقضا ${esc(faDate(row.expires_at))}${row.last_accessed_at ? ` · آخرین مشاهده ${esc(faDate(row.last_accessed_at))}` : ''}</small>
          </div>
          ${row.active ? `<button class="ghost danger" data-revoke-support="${esc(row.session_id)}">لغو فوری دسترسی</button>` : ''}
        </article>`).join('')
      : '<div class="empty">هیچ Support Session ثبت نشده است.</div>';
    listNode.querySelectorAll('[data-revoke-support]').forEach(button => {
      button.onclick = () => void revoke(button.dataset.revokeSupport, button);
    });
  }

  async function readCompany(force = false) {
    const snapshot = force
      ? await C.companyContext.refresh({ force: true })
      : await C.companyContext.ensure();
    const next = snapshot?.active_company || null;
    if ((state.company?.id || null) !== (next?.id || null)) {
      state.rows = null;
      state.signature = null;
    }
    state.company = next;
    return next;
  }

  async function load(force = false) {
    await readCompany(force);
    if (!state.company || !canSee()) {
      if (isSettings()) hideSlot();
      return null;
    }
    if (state.rows && !force) {
      renderRows();
      return state.rows;
    }
    if (state.loadPromise && !force) return state.loadPromise;
    state.loadPromise = (async () => {
      state.loading = true;
      try {
        const rows = await C.rpc('company_support_sessions', { wid: state.company.id });
        state.rows = Array.isArray(rows) ? rows : [];
        renderRows();
        return state.rows;
      } catch (error) {
        console.warn('[Avan support access] load failed', error);
        return null;
      } finally {
        state.loading = false;
      }
    })();
    try { return await state.loadPromise; }
    finally { state.loadPromise = null; }
  }

  async function revoke(sessionId, button) {
    if (!state.company || !sessionId) return;
    const reason = globalObject.prompt('دلیل لغو دسترسی پشتیبانی را وارد کنید:', 'لغو دسترسی توسط مدیر شرکت');
    if (!reason || reason.trim().length < 5) return;
    button.disabled = true;
    try {
      await C.rpc('company_revoke_support_session', {
        wid: state.company.id,
        p_session_id: sessionId,
        p_reason: reason.trim()
      });
      await load(true);
    } catch (error) {
      console.error(error);
      globalObject.alert('لغو دسترسی پشتیبانی انجام نشد.');
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }

  function onPageRendered() {
    globalObject.queueMicrotask?.(() => {
      if (isSettings() && canSee()) ensureShell();
      void load(false);
    });
  }

  Lifecycle.use('settings:support-access-shell', () => {
    if (!isSettings()) return;
    if (canSee()) {
      ensureShell();
      renderRows();
    }
  }, { priority: 35 });

  globalObject.addEventListener('avan:page-rendered', onPageRendered);
  globalObject.addEventListener('avan:company-context-changed', () => {
    state.rows = null;
    state.signature = null;
    void load(true);
  });
  globalObject.addEventListener('avan:company-context-cleared', () => {
    state.company = null;
    state.rows = null;
    state.signature = null;
    documentObject.getElementById('avanSupportAccessCard')?.remove();
  });

  const api = Object.freeze({
    installed: true,
    architecture: 'stable-settings-shell-v1',
    refresh: () => load(true),
    snapshot: () => Object.freeze({
      company_id: state.company?.id || null,
      loading: state.loading,
      row_count: Array.isArray(state.rows) ? state.rows.length : null
    })
  });
  globalObject.AvanSupportAccessSettings = api;
  void load(false);
  return api;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') installSupportAccessSettings();
