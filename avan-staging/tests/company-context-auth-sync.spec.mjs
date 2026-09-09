import assert from 'node:assert/strict';
import { createCompanyContext } from '../src/application/company/company-context.js';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

function createSessionStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

let currentUser = null;
let currentRows = [];
const events = [];
const globalObject = {
  sessionStorage: createSessionStorage(),
  dispatchEvent(event) {
    events.push(event);
    return true;
  }
};

const client = {
  async user() { return currentUser; },
  async rpc(name, args) {
    if (name === 'workspace_role') {
      return currentRows.find(row => row.id === args?.wid)?.role || '';
    }
    if (name === 'get_workspace_print_profile') {
      const row = currentRows.find(item => item.id === args?.wid);
      return row ? { display_name: row.display_name || row.name } : null;
    }
    throw new Error(`unexpected rpc: ${name}`);
  }
};

const context = createCompanyContext({
  client,
  listWorkspaces: async () => currentRows,
  globalObject
});

// Shell may initialize before authentication. That empty state must not become stale
// after login: ensure() must detect the user change, refresh memberships and publish
// the authoritative snapshot immediately, without a browser refresh.
let state = await context.refresh({ force: true });
assert.equal(state.user_id, null);
assert.equal(state.companies.length, 0);
assert.equal(state.selection_required, false);

currentUser = { id: 'user-1' };
currentRows = [
  {
    id: 'company-a',
    name: 'شرکت الف',
    display_name: 'شرکت الف',
    role: 'owner',
    status: 'active',
    access_allowed: true
  },
  {
    id: 'company-b',
    name: 'شرکت ب',
    display_name: 'شرکت ب',
    role: 'accountant',
    status: 'active',
    access_allowed: true
  }
];

state = await context.ensure();
assert.equal(state.user_id, 'user-1');
assert.equal(state.companies.length, 2);
assert.equal(state.active_company_id, null);
assert.equal(state.selection_required, true);

const refreshed = events.filter(event => event.type === 'avan:company-context-refreshed');
assert.ok(refreshed.length >= 2, 'authoritative refresh must be published after auth changes');
const lastSnapshot = refreshed.at(-1).detail;
assert.equal(lastSnapshot.user_id, 'user-1');
assert.equal(lastSnapshot.companies.length, 2);
assert.equal(lastSnapshot.selection_required, true);

// Selecting a company through the deterministic PR #93 path must persist exactly
// one active company without requiring another membership refresh.
const beforeSelectEvents = events.length;
const selected = await context.selectCompany('company-b', { emit: false });
assert.equal(selected.id, 'company-b');
assert.equal(context.snapshot().active_company_id, 'company-b');
assert.equal(context.snapshot().selection_required, false);
assert.equal(globalObject.sessionStorage.getItem('avan.active_workspace_id'), 'company-b');
assert.equal(events.length, beforeSelectEvents, 'emit:false selection must not create a competing refresh event');

console.log('company-context-auth-sync.spec.mjs: PASS');
