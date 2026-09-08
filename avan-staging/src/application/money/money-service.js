'use strict';

import {
  UNIT_TOMAN,
  normalizeUnitOrNull,
  displayToCanonical,
  canonicalToDisplay,
  formatCanonical,
  formatDisplay,
  displayAmountInWords,
  canonicalAmountInWords,
  groupInteger,
  unitLabel
} from '../../core/money/canonical-money.js';

export function createMoneyService({
  companyContext,
  readPreference,
  writePreference
}) {
  if (!companyContext?.ensure || typeof readPreference !== 'function' || typeof writePreference !== 'function') {
    throw new Error('MONEY_SERVICE_DEPENDENCY_REQUIRED');
  }

  let state = Object.freeze({
    ready: false,
    loading: false,
    workspaceId: null,
    unit: null,
    revision: 0
  });
  let pending = null;
  let token = 0;
  const listeners = new Set();

  const snapshot = () => state;

  function publish(next) {
    const previous = state;
    state = Object.freeze({ ...next });
    if (
      previous.ready !== state.ready ||
      previous.loading !== state.loading ||
      previous.workspaceId !== state.workspaceId ||
      previous.unit !== state.unit ||
      previous.revision !== state.revision
    ) {
      listeners.forEach(listener => {
        try { listener(state, previous); } catch (error) { console.warn('[Money service listener]', error); }
      });
    }
    return state;
  }

  async function ensure({ force = false } = {}) {
    const context = await companyContext.ensure();
    if (context?.selection_required) throw new Error('COMPANY_SELECTION_REQUIRED');
    const workspaceId = context?.active_company?.id || null;
    if (!workspaceId) throw new Error('COMPANY_REQUIRED');

    if (!force && state.ready && state.workspaceId === workspaceId && state.unit) return state;
    if (!force && pending && state.loading && state.workspaceId === workspaceId) return pending;

    const ownToken = ++token;
    publish({
      ready: false,
      loading: true,
      workspaceId,
      unit: null,
      revision: state.revision
    });

    pending = (async () => {
      let raw;
      try {
        raw = await readPreference(workspaceId);
      } catch (error) {
        if (ownToken === token) {
          publish({
            ready: false,
            loading: false,
            workspaceId,
            unit: null,
            revision: state.revision
          });
        }
        throw error;
      }

      if (ownToken !== token) return state;
      const unit = normalizeUnitOrNull(raw) || UNIT_TOMAN;
      return publish({
        ready: true,
        loading: false,
        workspaceId,
        unit,
        revision: state.revision + 1
      });
    })();

    try { return await pending; }
    finally { if (ownToken === token) pending = null; }
  }

  function requireReady() {
    if (!state.ready || !state.unit || !state.workspaceId) throw new Error('MONEY_UNIT_NOT_READY');
    return state;
  }

  async function setUnit(nextUnit) {
    const current = await ensure();
    const normalized = normalizeUnitOrNull(nextUnit);
    if (!normalized) throw new Error('INVALID_MONEY_UNIT');
    if (normalized === current.unit) return current;
    const saved = normalizeUnitOrNull(await writePreference(current.workspaceId, normalized));
    if (!saved) throw new Error('INVALID_MONEY_UNIT_RESPONSE');
    return publish({
      ready: true,
      loading: false,
      workspaceId: current.workspaceId,
      unit: saved,
      revision: state.revision + 1
    });
  }

  function parseInput(value) {
    const current = requireReady();
    return displayToCanonical(value, current.unit);
  }

  function inputFromCanonical(value) {
    const current = requireReady();
    const displayed = canonicalToDisplay(value, current.unit);
    return displayed === null ? '' : groupInteger(displayed);
  }

  function format(value, options) {
    const current = requireReady();
    return formatCanonical(value, current.unit, options);
  }

  function formatInput(value, options) {
    const current = requireReady();
    return formatDisplay(value, current.unit, options);
  }

  function inputWords(value) {
    const current = requireReady();
    return displayAmountInWords(value, current.unit);
  }

  function canonicalWords(value) {
    const current = requireReady();
    return canonicalAmountInWords(value, current.unit);
  }

  function label() {
    const current = requireReady();
    return unitLabel(current.unit);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function invalidate() {
    token += 1;
    pending = null;
    publish({
      ready: false,
      loading: false,
      workspaceId: null,
      unit: null,
      revision: state.revision + 1
    });
  }

  return Object.freeze({
    snapshot,
    ensure,
    setUnit,
    parseInput,
    inputFromCanonical,
    format,
    formatInput,
    inputWords,
    canonicalWords,
    label,
    subscribe,
    invalidate
  });
}
