'use strict';

function installUserPreferenceRpc() {
  const C = window.AvanCloud;
  if (!C?.rpc || !C?.operations) return false;
  if (C.__avanUserPreferenceRpcInstalled) return true;

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

  async function withFallback(raw, primary, primaryArgs, fallback, fallbackArgs) {
    try {
      return await raw(primary, primaryArgs);
    } catch (error) {
      const text = String(error?.message || error || '');
      const missing = error?.status === 404 || text.includes(primary);
      if (!missing) throw error;
      return raw(fallback, fallbackArgs);
    }
  }

  if (!C.operations.has('rpc', 'preferences.money-display-unit')) {
    C.operations.use('rpc', 'preferences.money-display-unit', async ({ args, next, raw }) => {
      const [name, payload = {}] = args;

      if (name === 'get_money_display_unit') {
        const wid = await effectiveCompanyId(payload?.wid || null);
        if (!wid) throw new Error('COMPANY_REQUIRED');
        return withFallback(
          raw,
          'get_my_money_display_unit',
          { wid },
          'get_money_display_unit',
          { ...payload, wid }
        );
      }

      if (name === 'set_money_display_unit') {
        const wid = await effectiveCompanyId(payload?.wid || null);
        if (!wid) throw new Error('COMPANY_REQUIRED');
        return withFallback(
          raw,
          'set_my_money_display_unit',
          { wid, p_unit: payload?.p_unit },
          'set_money_display_unit',
          { ...payload, wid }
        );
      }

      return next(name, payload);
    }, { priority: 50 });
  }

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
