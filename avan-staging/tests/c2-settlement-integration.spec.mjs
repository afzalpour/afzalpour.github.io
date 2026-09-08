import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const settlement = fs.readFileSync(new URL('../rc14-catalog-settlement-v61.js', import.meta.url), 'utf8');
const c14 = fs.readFileSync(new URL('../rc15-c1-4-invoice-input-stability.js', import.meta.url), 'utf8');

assert.match(index, /src="rc14-catalog-settlement-v61\.js"/,
  'staging must load Settlement v61');
assert.doesNotMatch(index, /src="rc14-catalog-settlement-v60\.js"/,
  'legacy Settlement v60 runtime must not be loaded');
assert.match(index, /src="src\/ui\/settlement\/tax-settlement-sync\.js"/,
  'VAT-aware settlement sync must be loaded');
assert.match(sw, /rc14-catalog-settlement-v61\.js/,
  'PWA cache must include Settlement v61');
assert.match(sw, /src\/ui\/settlement\/tax-settlement-sync\.js/,
  'PWA cache must include VAT-aware settlement sync');

assert.doesNotMatch(settlement, /\bC\.rpc\s*=/,
  'Settlement v61 must not monkey-patch C.rpc');
assert.match(settlement, /C\.operations\.use\('rpc','settlement:invoice-plan'/,
  'Settlement v61 must use the operation pipeline');
assert.match(settlement, /select=total_amount/,
  'Settlement v61 must read persisted canonical invoice total');
assert.match(settlement, /gatherPlan\(form,canonicalTotal\)/,
  'Settlement plan must be validated against persisted canonical total');
assert.doesNotMatch(settlement, /new\s+MutationObserver\s*\(/,
  'Settlement v61 must not restore a body-wide observer');
assert.match(c14, /window\.AvanTaxSettlementSync\?\.sync/,
  'C1.4 freeze guard must delegate display refresh to VAT-aware sync');

console.log('c2-settlement-integration.spec.mjs: PASS');
