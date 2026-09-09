import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const company = read('rc13-company-context.js');
const lifecycle = read('rc13-company-lifecycle.js');
const auth = read('src/ui/auth/auth-view.js');
const risk = read('src/ui/intelligence/risk-audit-view.js');
const css = read('rc15-final-web-pwa.css');

assert.match(company, /companies\.length\s*===\s*0/,'zero-company accounts must be handled explicitly');
assert.match(company, /firstCompanyRequired/);
assert.match(company, /appVisible\(\)/);
assert.match(company, /resolved\s*=\s*true/,'zero-company state must only be trusted after an authoritative context response');
assert.match(company, /if\s*\(loading\s*\|\|\s*!resolved\)\s*return/,'required onboarding must not open from the initial empty client state');
assert.match(company, /openPortfolio\(\{ required: false, refreshState: true \}\)/,'manual Company Portfolio open must refresh authoritative memberships');
assert.match(company, /window\.addEventListener\('focus'/,'a zero/unknown company state must re-check membership when the app regains focus');
assert.match(company, /در حال خواندن شرکت‌های شما/);
assert.match(company, /تلاش مجدد/);
assert.match(company, /اولین شرکت خود را ایجاد کنید/);
assert.match(lifecycle, /avanCreateCompanyButton/);
assert.match(lifecycle, /create_avan_company/);

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

console.log('zero-company-auth-ux.spec.mjs: PASS');
