import assert from 'node:assert/strict';
import fs from 'node:fs';
import { groupSettlementAmount } from '../src/ui/settlement/settlement-money-presentation.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

assert.equal(groupSettlementAmount('1234567'), '1٬234٬567');
assert.equal(groupSettlementAmount('123456.7'), '123٬456٫7');
assert.equal(groupSettlementAmount('1٬234٬567'), '1٬234٬567');
assert.equal(groupSettlementAmount('0.1'), '0٫1');

const liveRefinements = read('rc14-invoice-live-refinements.js');
const normalizer = read('src/ui/invoices/invoice-base-save-normalizer.js');
const invoiceMoney = read('src/ui/money/invoice-money-workspace.js');
const settlement = read('src/ui/settlement/settlement-money-presentation.js');
const settlementBoundary = read('src/ui/settlement/settlement-save-boundary-v3.js');
const app = read('app.js');
const index = read('index.html');
const sw = read('sw.js');

assert.doesNotMatch(liveRefinements, /addEventListener\(['"]submit['"]/,
  'normal invoice save must no longer have a second capture submit owner');
assert.doesNotMatch(liveRefinements, /location\.reload\(\)/,
  'normal sale/purchase save must not full-page reload through RC1.4 refinements');
assert.match(liveRefinements, /Saving is intentionally left to app\.js/,
  'the compatibility refinement must document app.js as the save owner');
assert.match(app, /closeModal\(\);\s*\n\s*await reloadAndRender\(\);\s*\n\s*toast\(/,
  'the app-owned invoice path must refresh in-app after save');
assert.match(normalizer, /invoice\.base-save-display-money/,
  'base invoice save must restore display money before canonicalization');
assert.match(normalizer, /priority:\s*125/,
  'display-money restoration must run before the canonical money operation');
assert.match(invoiceMoney, /money\.invoice-canonical-payload/);
assert.match(invoiceMoney, /priority:\s*150/,
  'canonical money conversion must remain downstream of display restoration');
assert.match(settlementBoundary, /priority:\s*300/,
  'settlement persistence must remain downstream of money and tax payload enrichment');

assert.match(settlement, /MoneyRuntime\.inputWords\(input\.value\)/,
  'every settlement amount presentation must derive Persian words from the active money unit');
assert.match(settlement, /\[name="v2_amount_display"\],\[data-v60-fixed-amount\]/,
  'both editable installment/mixed amounts and fixed credit/cash/check amounts must be presented');
assert.match(settlement, /به حروف:/,
  'settlement amount words must be visibly labelled in Persian');
assert.match(settlement, /replace\(\/\\B\(\?=\(\\d\{3\}\)\+\(\?!\\d\)\)\/g, '٬'\)/,
  'settlement presenter must apply three-digit grouping');
assert.match(index, /src\/ui\/invoices\/invoice-base-save-normalizer\.js/);
assert.match(index, /src\/ui\/settlement\/settlement-money-presentation\.js/);
assert.match(sw, /avan-staging-rc1-v92-final-live-polish/);
assert.match(sw, /src\/ui\/invoices\/invoice-base-save-normalizer\.js/);
assert.match(sw, /src\/ui\/settlement\/settlement-money-presentation\.js/);

console.log('final-live-invoice-polish: PASS');
