'use strict';

import { installAvanCloud } from '../../infrastructure/supabase/avan-cloud-bootstrap.js';

const C = installAvanCloud();

const TABLE_KEYS = new Set([
  'workspaces',
  'fiscal_years',
  'accounts',
  'account_roles',
  'parties',
  'journal_entries',
  'journal_lines',
  'financial_accounts',
  'fiscal_periods',
  'financial_transactions',
  'invoices',
  'invoice_lines',
  'documents'
]);

const RPC_KEYS = Object.freeze({
  avan_workspace_health: 'health',
  avan_core_integrity: 'integrity',
  workspace_role: 'workspace_role',
  invoice_integrity: 'invoice_integrity'
});

const state = {
  armed: false,
  serving: false,
  workspaceId: null,
  expiresAt: 0,
  snapshot: null,
  snapshotPromise: null
};

function clear() {
  state.armed = false;
  state.serving = false;
  state.workspaceId = null;
  state.expiresAt = 0;
  state.snapshot = null;
  state.snapshotPromise = null;
}

function arm(workspaceId) {
  const wid = String(workspaceId || state.workspaceId || '').trim();
  if (!wid) return;
  state.armed = true;
  state.serving = false;
  state.workspaceId = wid;
  state.expiresAt = Date.now() + 15000;
  state.snapshot = null;
  state.snapshotPromise = null;
}

function active() {
  if (!state.armed || !state.workspaceId) return false;
  if (Date.now() <= state.expiresAt) return true;
  clear();
  return false;
}

async function snapshot() {
  if (!active() || !state.serving) return null;
  if (state.snapshot) return state.snapshot;
  if (!state.snapshotPromise) {
    state.snapshotPromise = C.rpc('avan_invoice_save_refresh_snapshot', {
      wid: state.workspaceId
    }).then(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('INVOICE_HOT_REFRESH_INVALID_SNAPSHOT');
      }
      state.snapshot = value;
      return value;
    }).finally(() => {
      state.snapshotPromise = null;
    });
  }
  return state.snapshotPromise;
}

if (!C.operations.has('rpc', 'performance.invoice-save-hot-refresh')) {
  C.operations.use('rpc', 'performance.invoice-save-hot-refresh', async ({ args, next }) => {
    const [name, payload = {}, ...rest] = args;
    const snapshotKey = RPC_KEYS[name];

    if (snapshotKey && active() && state.serving) {
      try {
        const value = await snapshot();
        if (value && Object.prototype.hasOwnProperty.call(value, snapshotKey)) {
          return value[snapshotKey];
        }
      } catch (error) {
        console.warn('[Avan invoice hot refresh] snapshot RPC fallback', error);
        clear();
      }
    }

    const result = await next(name, payload, ...rest);

    if (name === 'save_draft_invoice') {
      arm(payload?.p_workspace_id);
    } else if (name === 'post_invoice' && state.workspaceId) {
      // Posting changes Ledger/transactions after the draft save. Re-arm so the
      // single snapshot is always taken only after the final write completes.
      arm(state.workspaceId);
    }

    return result;
  }, { priority: 50 });
}

if (!C.operations.has('select', 'performance.invoice-save-hot-refresh')) {
  C.operations.use('select', 'performance.invoice-save-hot-refresh', async ({ args, next }) => {
    const [table, query = '', ...rest] = args;

    if (!active() || !TABLE_KEYS.has(table)) {
      return next(table, query, ...rest);
    }

    if (table === 'workspaces') {
      // loadContext() starts its post-save refresh with the active workspace.
      // This is the activation boundary: earlier document-linking or settlement
      // work cannot accidentally consume a pre-post snapshot.
      state.serving = true;
    }

    if (!state.serving) {
      return next(table, query, ...rest);
    }

    try {
      const value = await snapshot();
      const rows = value?.[table];
      if (Array.isArray(rows)) {
        if (table === 'documents') {
          queueMicrotask(clear);
        }
        return rows;
      }
    } catch (error) {
      console.warn('[Avan invoice hot refresh] table fallback', error);
      clear();
    }

    return next(table, query, ...rest);
  }, { priority: 50 });
}

window.addEventListener('avan:company-context-changed', clear);
window.addEventListener('avan:company-context-cleared', clear);

export const InvoiceSaveHotRefresh = Object.freeze({
  architecture: 'invoice-save-hot-refresh-v1',
  state: () => Object.freeze({
    armed: state.armed,
    serving: state.serving,
    workspace_id: state.workspaceId
  })
});
