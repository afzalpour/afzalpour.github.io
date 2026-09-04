'use strict';

function installUserPreferenceRpc(){
  const C = window.AvanCloud;
  if (!C?.rpc) return false;
  if (C.__avanUserPreferenceRpcInstalled) return true;

  const baseRpc = C.rpc.bind(C);
  const key = C.ACTIVE_WORKSPACE_KEY || 'avan.active_workspace_id';

  function preferredWorkspaceId() {
    try {
      return window.sessionStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }

  async function effectiveWorkspaceId(fallback = null) {
    const preferred = preferredWorkspaceId();
    if (preferred) return preferred;

    if (C?.select) {
      try {
        const rows = await C.select(
          'workspaces',
          'select=id,name,mode,base_currency,created_at&order=created_at.asc'
        );
        if (rows?.[0]?.id) return rows[0].id;
      } catch {
        // Keep compatibility fallback below.
      }
    }

    return fallback;
  }

  async function withFallback(primary, primaryArgs, fallback, fallbackArgs) {
    try {
      return await baseRpc(primary, primaryArgs);
    } catch (error) {
      const text = String(error?.message || error || '');
      const missing = error?.status === 404 || text.includes(primary);
      if (!missing) throw error;
      return baseRpc(fallback, fallbackArgs);
    }
  }

  C.rpc = async (name, args = {}) => {
    if (name === 'get_money_display_unit') {
      const wid = await effectiveWorkspaceId(args?.wid || null);
      return withFallback(
        'get_my_money_display_unit',
        { wid },
        'get_money_display_unit',
        { ...args, wid }
      );
    }

    if (name === 'set_money_display_unit') {
      const wid = await effectiveWorkspaceId(args?.wid || null);
      return withFallback(
        'set_my_money_display_unit',
        { wid, p_unit: args?.p_unit },
        'set_money_display_unit',
        { ...args, wid }
      );
    }

    return baseRpc(name, args);
  };

  C.__avanUserPreferenceRpcInstalled = true;
  return true;
}

if (!installUserPreferenceRpc()) {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installUserPreferenceRpc() || attempts >= 100) {
      window.clearInterval(timer);
    }
  }, 20);
}