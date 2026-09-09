import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const company = read('rc13-company-context.js');
const lifecycle = read('rc13-company-lifecycle.js');
const auth = read('src/ui/auth/auth-view.js');

assert.match(company, /companies\.length===0/,
  'zero-company accounts must be handled explicitly');
assert.match(company, /firstCompanyRequired/,
  'zero-company state must open required onboarding instead of leaving the user stranded');
assert.match(company, /appVisible\(\)/,
  'zero-company onboarding must only open after the authenticated app shell is visible');
assert.match(company, /اولین شرکت خود را ایجاد کنید/,
  'zero-company portfolio must explain the next action in Persian');
assert.match(lifecycle, /avanCreateCompanyButton/,
  'company portfolio must expose the create-company action');
assert.match(lifecycle, /create_avan_company/,
  'company onboarding must keep using the authoritative company creation RPC');

assert.match(auth, /data\.authPasswordToggle|dataset\.authPasswordToggle/,
  'login password must expose a stable visibility-toggle marker');
assert.match(auth, /textContent = '👁'/,
  'password visibility control must show an eye affordance');
assert.match(auth, /input\.type = showing \? 'password' : 'text'/,
  'eye control must toggle between masked and visible password input');
assert.match(auth, /aria-pressed/,
  'password toggle must expose accessible pressed state');
assert.match(auth, /نمایش رمز عبور/);
assert.match(auth, /مخفی کردن رمز عبور/);

console.log('zero-company-auth-ux.spec.mjs: PASS');
