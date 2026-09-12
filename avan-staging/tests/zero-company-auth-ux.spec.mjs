import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCompanyContext } from '../src/application/company/company-context.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const company = read('rc13-company-context.js');
const companyCss = read('rc13-company-context.css');
const companyCore = read('src/application/company/company-context.js');
const lifecycle = read('rc13-company-lifecycle.js');
const auth = read('src/ui/auth/auth-view.js');
const risk = read('src/ui/intelligence/risk-audit-view.js');
const css = read('rc15-final-web-pwa.css');

assert.match(company, /companies\.length\s*===\s*0/,'zero-company accounts must be handled explicitly');
assert.match(company, /firstCompanyRequired/);
assert.match(company, /appVisible\(\)/);
assert.match(company, /if\s*\(!appVisible\(\)\)\s*\{[\s\S]*closePortfolio\(\);[\s\S]*return;/,'required Company Portfolio must close whenever the authenticated app shell is not visible');
assert.match(company, /avanSwitchAccount/,'required Portfolio must provide an explicit account escape path');
assert.match(company, /خروج و ورود با حساب دیگر/);
assert.match(company, /companyContext\.clearSelection\(\{\s*emit:\s*false\s*\}\)/,'switch-account path must clear only the client company selection');
assert.match(company, /await cloud\.logout\(\)/,'switch-account path must sign out the current auth session');
assert.match(company, /resolved\s*=\s*true/,'zero-company state must only be trusted after an authoritative context response');
assert.match(company, /if\s*\(loading\s*\|\|\s*!resolved\)\s*return/,'required onboarding must not open from the initial empty client state');
assert.doesNotMatch(company, /refreshState\s*:/,'opening Company Portfolio must not force a parallel membership refresh');
assert.doesNotMatch(company, /window\.addEventListener\('focus'/,'browser focus must not trigger Company Context refresh loops');
assert.match(company, /selectCompany\(id,\s*\{\s*emit:\s*false\s*\}\)/,'company selection must persist once without emitting a competing refresh before reload');
assert.match(company, /location\.reload\(\)/,'successful company selection must complete with a single controlled reload');
assert.match(company, /if \(resolved\) syncRequiredPortfolio\(\)/,'page render must wait for authoritative company state before required selection UI');
assert.match(company, /avan:company-context-refreshed/,'company shell must consume authoritative core refreshes after auth changes');
assert.match(company, /onAuthoritativeRefresh/,'company shell must hydrate from the core event instead of requiring a browser refresh');
assert.match(companyCore, /avan:company-context-refreshed/,'core company context must publish each settled authoritative refresh');
assert.match(companyCore, /publishRefresh\(settled\)/,'refresh event must be emitted only from settled state');
assert.match(company, /در حال خواندن شرکت‌های شما/);
assert.match(company, /اولین شرکت خود را ایجاد کنید/);
assert.match(lifecycle, /avanCreateCompanyButton/);
assert.match(lifecycle, /create_avan_company/);
assert.match(companyCss, /body\.avan-company-portfolio-open \.modal-backdrop\{z-index:760\}/,'company onboarding modal must render above the required Portfolio overlay');
assert.match(companyCss, /\.avan-company-portfolio-overlay\{[^}]*z-index:700/,'Portfolio overlay layer must remain below the onboarding modal');

assert.match(auth, /data\.authPasswordToggle|dataset\.authPasswordToggle/);
assert.match(auth, /textContent = '👁'/);
assert.match(auth, /input\.type = showing \? 'password' : 'text'/);
assert.match(auth, /aria-pressed/);
assert.match(auth, /نمایش رمز عبور/);
assert.match(auth, /مخفی کردن رمز عبور/);

assert.match(risk, /avan-risk-factor-card/);
assert.match(risk, /avan-risk-factor-copy/);
assert.match(risk, /avan-risk-factor-value/);
assert.ok(risk.indexOf('avan-risk-factor-title') < risk.indexOf('avan-risk-factor-value'),'risk title must appear above its value');
assert.match(css, /\.avan-risk-factor-card\{[\s\S]*overflow:hidden/);
assert.match(css, /\.avan-risk-factor-value\{[\s\S]*width:100%/);
assert.match(css, /\.avan-risk-factor-number\{[\s\S]*max-width:100%/);
assert.match(css, /overflow-wrap:anywhere/,'long risk values/titles must remain inside the card');

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init = {}) { super(type); this.detail = init.detail; }
  };
}

const storage = new Map();
const bus = new EventTarget();
bus.sessionStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
let signedInUser = null;
const fakeClient = {
  user: async () => signedInUser,
  rpc: async () => null
};
const memberships = [
  { id:'company-a', display_name:'شرکت الف', role:'owner', access_allowed:true, status:'active' },
  { id:'company-b', display_name:'شرکت ب', role:'accountant', access_allowed:true, status:'active' }
];
const refreshEvents = [];
bus.addEventListener('avan:company-context-refreshed', event => refreshEvents.push(event.detail));
const context = createCompanyContext({
  client: fakeClient,
  listWorkspaces: async () => memberships,
  globalObject: bus
});

await context.refresh({ force:true });
assert.equal(context.snapshot().companies.length, 0, 'pre-auth context starts empty');
signedInUser = { id:'user-1' };
const afterAuth = await context.ensure();
assert.equal(afterAuth.companies.length, 2, 'auth transition must resolve memberships without browser refresh');
assert.equal(afterAuth.selection_required, true, 'multi-company user must be offered company selection immediately');
assert.equal(refreshEvents.at(-1)?.companies?.length, 2, 'settled auth refresh must push the two-company snapshot to the shell');
assert.equal(refreshEvents.at(-1)?.user_id, 'user-1');
assert.equal(refreshEvents.at(-1)?.loading, false, 'published snapshot must be settled, never a loading intermediate');

console.log('zero-company-auth-ux.spec.mjs: PASS');
