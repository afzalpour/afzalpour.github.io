'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';
import { createMoneyService } from '../../application/money/money-service.js';
import {
  UNIT_TOMAN,
  UNIT_RIAL,
  normalizeUnitOrNull,
  integerFromText,
  groupInteger
} from '../../core/money/canonical-money.js';

export function installMoneyRuntime({ globalObject = window, documentObject = document } = {}) {
  if (globalObject.AvanMoney?.architecture === 'unified-money-runtime-v1') return globalObject.AvanMoney;

  const C = installAvanCloud({ globalObject });
  const service = createMoneyService({
    companyContext: C.companyContext,
    readPreference: workspaceId => C.rpc('get_money_display_unit', { wid: workspaceId }),
    writePreference: (workspaceId, unit) => C.rpc('set_money_display_unit', {
      wid: workspaceId,
      p_unit: unit
    })
  });

  let readyPromise = null;

  function reflect(state) {
    const root = documentObject?.documentElement;
    if (!root) return;
    root.dataset.avanMoneyReady = state.ready ? '1' : '0';
    if (state.unit) root.dataset.avanMoneyUnit = state.unit;
    else delete root.dataset.avanMoneyUnit;
  }

  service.subscribe(reflect);
  reflect(service.snapshot());

  async function ready({ force = false } = {}) {
    if (!force && service.snapshot().ready) return service.snapshot();
    if (!force && readyPromise) return readyPromise;
    readyPromise = service.ensure({ force });
    try { return await readyPromise; }
    finally { readyPromise = null; }
  }

  async function setUnit(unit, { reload = true } = {}) {
    const normalized = normalizeUnitOrNull(unit);
    if (!normalized) throw new Error('INVALID_MONEY_UNIT');
    const next = await service.setUnit(normalized);
    if (reload && globalObject.location?.reload) globalObject.location.reload();
    return next;
  }

  function carriesCanonicalFraction(value) {
    if (typeof value === 'number') return !Number.isInteger(value);
    if (typeof value === 'bigint') return false;
    return /[.٫]/.test(String(value ?? ''));
  }

  function safeFormatCanonical(value, options) {
    try {
      return carriesCanonicalFraction(value)
        ? service.formatDecimal(value, options)
        : service.format(value, options);
    } catch { return '—'; }
  }

  function safeFormatCanonicalDecimal(value, options) {
    try { return service.formatDecimal(value, options); }
    catch { return '—'; }
  }

  function safeInputFromCanonical(value) {
    try {
      return carriesCanonicalFraction(value)
        ? service.decimalInputFromCanonical(value)
        : service.inputFromCanonical(value);
    } catch { return ''; }
  }

  function safeDecimalInputFromCanonical(value) {
    try { return service.decimalInputFromCanonical(value); }
    catch { return ''; }
  }

  function safeParseInput(value) {
    try { return service.parseInput(value); }
    catch { return { ok: false, value: null, code: 'MONEY_UNIT_NOT_READY' }; }
  }

  function safeParseDecimalInput(value) {
    try { return service.parseDecimalInput(value); }
    catch { return { ok: false, value: null, micros: null, code: 'MONEY_UNIT_NOT_READY' }; }
  }

  function safeUnitLabel() {
    try { return service.label(); }
    catch { return ''; }
  }

  function formatLooseDisplay(value) {
    const amount = integerFromText(value);
    return amount === null ? '' : groupInteger(amount);
  }

  globalObject.addEventListener?.('avan:company-context-changed', () => {
    service.invalidate();
    ready({ force: true }).catch(error => console.warn('[Money runtime] company reload failed', error));
  });
  globalObject.addEventListener?.('avan:company-context-cleared', () => service.invalidate());

  const api = Object.freeze({
    architecture: 'unified-money-runtime-v1',
    ready,
    snapshot: service.snapshot,
    unit: () => service.snapshot().unit,
    isReady: () => service.snapshot().ready,
    setUnit,
    parseInput: safeParseInput,
    parseDecimalInput: safeParseDecimalInput,
    inputFromCanonical: safeInputFromCanonical,
    decimalInputFromCanonical: safeDecimalInputFromCanonical,
    formatCanonical: safeFormatCanonical,
    formatCanonicalDecimal: safeFormatCanonicalDecimal,
    formatInput: value => {
      try { return service.formatInput(value); }
      catch { return formatLooseDisplay(value); }
    },
    inputWords: value => {
      try { return service.inputWords(value); }
      catch { return ''; }
    },
    canonicalWords: value => {
      try { return service.canonicalWords(value); }
      catch { return ''; }
    },
    unitLabel: safeUnitLabel,
    constants: Object.freeze({ TOMAN: UNIT_TOMAN, RIAL: UNIT_RIAL })
  });

  globalObject.AvanMoney = api;
  return api;
}

export const MoneyRuntime = typeof window !== 'undefined'
  ? installMoneyRuntime({ globalObject: window, documentObject: document })
  : null;
