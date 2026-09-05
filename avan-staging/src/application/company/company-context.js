'use strict';

const DEFAULT_ACTIVE_KEY = 'avan.active_workspace_id';

function cloneCompany(company) {
  return company ? { ...company } : null;
}

function cloneState(state) {
  return Object.freeze({
    ready: state.ready,
    loading: state.loading,
    user_id: state.userId,
    active_company_id: state.activeId,
    selection_required: state.selectionRequired,
    companies: state.companies.map(cloneCompany),
    active_company: cloneCompany(
      state.companies.find(company => company.id === state.activeId) || null
    )
  });
}

export function createCompanyContext({
  client,
  listWorkspaces,
  globalObject = window,
  activeKey = DEFAULT_ACTIVE_KEY
} = {}) {
  if (!client?.user || !client?.rpc || typeof listWorkspaces !== 'function') {
    throw new Error('COMPANY_CONTEXT_DEPENDENCY_MISSING');
  }

  const state = {
    ready: false,
    loading: false,
    userId: null,
    activeId: null,
    selectionRequired: false,
    companies: []
  };

  let refreshPromise = null;

  function sessionStore() {
    try {
      return globalObject.sessionStorage || null;
    } catch {
      return null;
    }
  }

  function storedId() {
    try {
      return sessionStore()?.getItem(activeKey) || null;
    } catch {
      return null;
    }
  }

  function persistId(id) {
    try {
      if (id) sessionStore()?.setItem(activeKey, id);
      else sessionStore()?.removeItem(activeKey);
    } catch {
      // Session preference is optional and never contains accounting data.
    }
  }

  function normalizeRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.filter(row => row?.id);
  }

  function resolveActiveId(rows) {
    const items = normalizeRows(rows);
    const preferred = storedId();

    if (preferred && items.some(item => item.id === preferred)) {
      return preferred;
    }

    if (preferred) persistId(null);

    if (items.length === 1) {
      persistId(items[0].id);
      return items[0].id;
    }

    return null;
  }

  function orderWorkspaces(rows) {
    const items = normalizeRows(rows);
    const activeId = resolveActiveId(items);

    state.activeId = activeId;
    state.selectionRequired = items.length > 1 && !activeId;

    if (!activeId) return items;

    const index = items.findIndex(item => item.id === activeId);
    if (index <= 0) return items;

    return [
      items[index],
      ...items.slice(0, index),
      ...items.slice(index + 1)
    ];
  }

  async function enrich(workspace) {
    let role = '';
    let profile = null;

    try {
      role = await client.rpc('workspace_role', { wid: workspace.id }) || '';
    } catch (error) {
      console.warn('[Avan CompanyContext] role unavailable', error);
    }

    try {
      profile = await client.rpc(
        'get_workspace_print_profile',
        { wid: workspace.id }
      );
    } catch {
      // Company profile is optional for context resolution.
    }

    return Object.freeze({
      ...workspace,
      role,
      display_name: String(
        profile?.display_name || workspace.name || 'شرکت بدون نام'
      ).trim(),
      legal_name: String(profile?.legal_name || '').trim()
    });
  }

  async function refresh({ force = false } = {}) {
    if (refreshPromise && !force) return refreshPromise;

    refreshPromise = (async () => {
      state.loading = true;

      try {
        const user = await client.user();
        if (!user?.id) {
          state.ready = true;
          state.userId = null;
          state.activeId = null;
          state.selectionRequired = false;
          state.companies = [];
          return cloneState(state);
        }

        const rawRows = normalizeRows(await listWorkspaces());
        const orderedRows = orderWorkspaces(rawRows);
        const companies = await Promise.all(orderedRows.map(enrich));

        state.userId = user.id;
        state.companies = companies;
        state.activeId = resolveActiveId(companies);
        state.selectionRequired = companies.length > 1 && !state.activeId;
        state.ready = true;

        return cloneState(state);
      } finally {
        state.loading = false;
      }
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  }

  function active() {
    return cloneCompany(
      state.companies.find(company => company.id === state.activeId) || null
    );
  }

  function list() {
    return state.companies.map(cloneCompany);
  }

  function snapshot() {
    return cloneState(state);
  }

  async function ensure() {
    if (!state.ready) await refresh();
    return snapshot();
  }

  async function selectCompany(companyId, { emit = true } = {}) {
    const id = String(companyId || '').trim();
    if (!id) throw new Error('COMPANY_REQUIRED');

    if (!state.ready || !state.companies.length) {
      await refresh({ force: true });
    }

    const target = state.companies.find(company => company.id === id);
    if (!target) {
      persistId(null);
      state.activeId = null;
      state.selectionRequired = state.companies.length > 1;
      throw new Error('COMPANY_ACCESS_REQUIRED');
    }

    persistId(id);
    state.activeId = id;
    state.selectionRequired = false;
    state.companies = [
      target,
      ...state.companies.filter(company => company.id !== id)
    ];

    if (emit) {
      const detail = {
        company: cloneCompany(target),
        company_id: id
      };
      globalObject.dispatchEvent(
        new CustomEvent('avan:company-context-changed', { detail })
      );
      // Transitional compatibility for legacy UI modules.
      globalObject.dispatchEvent(
        new CustomEvent('avan:workspace-changed', { detail: { workspace_id: id } })
      );
    }

    return cloneCompany(target);
  }

  function clearSelection({ emit = true } = {}) {
    persistId(null);
    state.activeId = null;
    state.selectionRequired = state.companies.length > 1;

    if (emit) {
      globalObject.dispatchEvent(
        new CustomEvent('avan:company-context-cleared')
      );
    }
  }

  return Object.freeze({
    activeKey,
    orderWorkspaces,
    refresh,
    ensure,
    snapshot,
    active,
    list,
    selectCompany,
    clearSelection,
    needsSelection: () => Boolean(state.selectionRequired),
    hasSelection: () => Boolean(state.activeId)
  });
}
