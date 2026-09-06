'use strict';

function installUserPreferenceRpc(){
  const C = window.AvanCloud;
  if (!C?.rpc) return false;
  if (C.__avanUserPreferenceRpcInstalled) return true;

  const baseRpc = C.rpc.bind(C);

  async function effectiveCompanyId(fallback = null) {
    const context = C.companyContext;

    if (context?.active()?.id) {
      return context.active().id;
    }

    if (context?.ensure) {
      try {
        const state = await context.ensure();
        if (state?.active_company?.id) return state.active_company.id;
      } catch {
        // Preserve explicit caller fallback below.
      }
    }

    // MT-A: never invent a tenant by reading the first workspace here.
    // If no Company is active, only an explicit caller-provided id may proceed.
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
      const wid = await effectiveCompanyId(args?.wid || null);
      if (!wid) throw new Error('COMPANY_REQUIRED');
      return withFallback(
        'get_my_money_display_unit',
        { wid },
        'get_money_display_unit',
        { ...args, wid }
      );
    }

    if (name === 'set_money_display_unit') {
      const wid = await effectiveCompanyId(args?.wid || null);
      if (!wid) throw new Error('COMPANY_REQUIRED');
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
