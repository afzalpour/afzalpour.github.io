import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSupabaseAuth } from '../src/infrastructure/supabase/supabase-auth.js';
import { createAuthController } from '../src/application/auth/auth-controller.js';
import { createCompanyContext } from '../src/application/company/company-context.js';

const expired = {
  access_token: 'old-access',
  refresh_token: 'refresh-1',
  expires_at: Math.floor(Date.now() / 1000) - 5,
  user: { id: 'user-1', email: 'u@example.test' }
};
let authSession = expired;
let refreshCalls = 0;
const auth = createSupabaseAuth({
  transport: {
    raw: async path => {
      assert.match(path, /grant_type=refresh_token/);
      refreshCalls += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        access_token: 'new-access',
        refresh_token: 'refresh-2',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: expired.user
      };
    }
  },
  sessionStore: {
    session: () => authSession,
    saveSession: value => { authSession = value; }
  }
});

const tokens = await Promise.all([
  auth.token(),
  auth.token(),
  auth.token(),
  auth.token()
]);
assert.deepEqual(tokens, ['new-access', 'new-access', 'new-access', 'new-access']);
assert.equal(refreshCalls, 1, 'concurrent token consumers must share one refresh request');

let remoteUserCalls = 0;
const controller = createAuthController({
  session: () => ({ user: { id: 'user-1', email: 'cached@example.test' } }),
  user: async () => { remoteUserCalls += 1; return { id: 'user-1' }; },
  login: async () => {}, signup: async () => ({}), logout: async () => {},
  requestPasswordReset: async () => {}, updatePassword: async () => {},
  consumeAuthCallback: () => null,
  cfg: {}
});
assert.equal((await controller.user()).email, 'cached@example.test');
assert.equal(remoteUserCalls, 0, 'normal context hydration must use the authenticated session identity');
await controller.user({ force: true });
assert.equal(remoteUserCalls, 1, 'explicit force still verifies the remote auth user');

const storage = new Map();
const globalObject = {
  sessionStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key)
  },
  dispatchEvent: () => {}
};
let companyUserCalls = 0;
const companyClient = {
  session: () => ({ user: { id: 'user-1' } }),
  user: async () => { companyUserCalls += 1; return { id: 'user-1' }; },
  rpc: async () => null
};
const companyContext = createCompanyContext({
  client: companyClient,
  globalObject,
  listWorkspaces: async () => [{
    id: 'company-1',
    name: 'شرکت تست',
    role: 'owner',
    display_name: 'شرکت تست',
    access_allowed: true
  }]
});
await companyContext.ensure();
await companyContext.ensure();
assert.equal(companyUserCalls, 0, 'ready CompanyContext must not repeat /auth/v1/user when session identity is hydrated');
assert.equal(companyContext.snapshot().active_company_id, 'company-1');

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const hot = read('src/ui/invoices/invoice-save-hot-refresh.js');
const settlement = read('src/ui/settlement/settlement-save-boundary-v3.js');
const migration = read('APPLIED_RC1_5_INVOICE_SAVE_HOT_REFRESH.sql');
const index = read('index.html');

assert.match(hot, /avan_invoice_save_refresh_snapshot/,
  'invoice hot refresh must use the one-roundtrip authoritative snapshot RPC');
assert.match(hot, /table === 'workspaces'/,
  'the hot snapshot must activate only at loadContext workspace refresh, after all invoice writes complete');
assert.match(hot, /performance\.invoice-save-hot-refresh/,
  'hot refresh must be a named Operation Pipeline middleware');
assert.doesNotMatch(hot, /location\.reload\s*\(/,
  'the latency fix must not reintroduce full-page reload');
assert.doesNotMatch(settlement, /select=total_amount/,
  'Settlement must not re-read invoice total after save when backend exact-total validation is authoritative');
assert.match(settlement, /avanCanonicalInvoiceTotalToman/,
  'Settlement must use the already-computed exact canonical invoice total');
assert.match(migration, /security invoker/i,
  'the refresh snapshot must retain caller RLS rather than create a privileged read boundary');
assert.match(migration, /revoke all on function public\.avan_invoice_save_refresh_snapshot\(uuid\) from anon/i,
  'anonymous execution must remain closed');
assert.match(migration, /grant execute on function public\.avan_invoice_save_refresh_snapshot\(uuid\) to authenticated/i,
  'authenticated clients may call the RLS-governed snapshot');
assert.match(index, /src\/ui\/invoices\/invoice-save-hot-refresh\.js/,
  'the hot refresh module must be loaded in active staging runtime');

console.log('invoice-save-latency.spec.mjs: PASS');
