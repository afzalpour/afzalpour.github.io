import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UNIT_TOMAN,
  UNIT_RIAL,
  displayToCanonical,
  canonicalToDisplay,
  lineCanonicalAmount,
  formatCanonical
} from '../src/core/money/canonical-money.js';
import { calculateVatAmount } from '../src/domains/tax/vat-calculator.js';

// Canonical invariant: Ledger/business amounts are integer Toman.
assert.deepEqual(displayToCanonical('10٬005', UNIT_TOMAN), { ok: true, value: 10005n, code: null });
assert.deepEqual(displayToCanonical('100٬050', UNIT_RIAL), { ok: true, value: 10005n, code: null });
assert.equal(displayToCanonical('10٬005', UNIT_RIAL).ok, false, 'non-divisible Rial must not be silently treated as Toman');
assert.equal(canonicalToDisplay(11006n, UNIT_TOMAN), 11006n);
assert.equal(canonicalToDisplay(11006n, UNIT_RIAL), 110060n);
assert.notEqual(canonicalToDisplay(11006n, UNIT_RIAL), 1100600n, 'Rial conversion must happen exactly once');

const tomanLine = lineCanonicalAmount({ quantity: '1', unitPrice: '10005', discount: '0', unit: UNIT_TOMAN });
assert.equal(tomanLine.ok, true);
assert.equal(tomanLine.value, 10005n);
const rialLine = lineCanonicalAmount({ quantity: '1', unitPrice: '100050', discount: '0', unit: UNIT_RIAL });
assert.equal(rialLine.ok, true);
assert.equal(rialLine.value, 10005n);

const vat = calculateVatAmount({ taxableAmount: 10005n, rate: '10' });
assert.equal(vat, 1001n);
assert.equal(formatCanonical(10005n, UNIT_TOMAN), '10٬005 تومان');
assert.equal(formatCanonical(11006n, UNIT_TOMAN), '11٬006 تومان');
assert.equal(formatCanonical(10005n, UNIT_RIAL), '100٬050 ریال');
assert.equal(formatCanonical(1001n, UNIT_RIAL), '10٬010 ریال');
assert.equal(formatCanonical(11006n, UNIT_RIAL), '110٬060 ریال');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const currency = fs.readFileSync(new URL('../rc11-currency.js', import.meta.url), 'utf8');
const density = fs.readFileSync(new URL('../rc11-unit-density.js', import.meta.url), 'utf8');
const invoiceMoney = fs.readFileSync(new URL('../src/ui/money/invoice-money-workspace.js', import.meta.url), 'utf8');
const settlementV2 = fs.readFileSync(new URL('../src/ui/settlement/settlement-workspace-v2.js', import.meta.url), 'utf8');
const finalPolish = fs.readFileSync(new URL('../rc13-final-polish.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

assert.match(index, /src\/ui\/money\/invoice-money-workspace\.js/);
assert.match(index, /src\/ui\/settlement\/settlement-workspace-v2\.js/);
assert.doesNotMatch(index, /src\/ui\/money\/invoice-canonical-input-boundary\.js/,
  'temporary DOM canonicalization must not run in the invoice form');
assert.doesNotMatch(index, /src\/ui\/settlement\/tax-settlement-sync\.js/,
  'legacy settlement display synchronizer must not remain a second owner');
assert.doesNotMatch(index, /rc15-c1-4-invoice-input-stability\.js/,
  'legacy event-order workaround must not be loaded after v2 ownership');

assert.doesNotMatch(currency, /walkText\(/, 'currency runtime must not rewrite rendered money text');
assert.match(currency, /activeCompanyId\(/, 'currency preference must resolve from active company');
assert.match(density, /#invoiceForm/, 'legacy density projector must skip invoice money DOM');
assert.doesNotMatch(density, /WORD_UNIT_PATTERN/, 'money-in-words must keep its selected unit');

assert.match(invoiceMoney, /money\.invoice-canonical-payload/);
assert.match(invoiceMoney, /input\.dataset\.money = 'false'/,
  'invoice inputs must remain display-unit values until RPC boundary');
assert.match(invoiceMoney, /avanCanonicalInvoiceTotalToman/);
assert.match(invoiceMoney, /RIAL_NOT_DIVISIBLE_BY_10/);
assert.match(invoiceMoney, /data-rc15-tax-profile/);

assert.match(settlementV2, /form\.dataset\.v60Settlement = '1'/,
  'v2 must claim the legacy settlement UI compatibility flag before v61');
assert.match(settlementV2, /type="hidden" name="v60_amount"/,
  'installment rows must keep canonical Toman hidden for the legacy save contract');
assert.match(settlementV2, /option value="check">چکی/);
assert.match(settlementV2, /option value="installment">اقساطی/);
assert.match(settlementV2, /settlement-page-rendered-v2/,
  'Web invoice-list render must explicitly wake the settlement/check dashboard');

assert.match(finalPolish, /th\.dataset\.avanMoneyUnit=unitFa\(\)/,
  'table unit is metadata, not appended text');
assert.match(finalPolish, /pageTitle==='فاکتورها'/,
  'invoice page must not create the competing output-unit chip');

assert.match(sw, /avan-staging-rc1-v75-c2-money-contract-v2/);
assert.match(sw, /src\/core\/money\/canonical-money\.js/);
assert.match(sw, /src\/ui\/money\/invoice-money-workspace\.js/);
assert.match(sw, /src\/ui\/settlement\/settlement-workspace-v2\.js/);
assert.doesNotMatch(sw, /invoice-canonical-input-boundary\.js/);
assert.doesNotMatch(sw, /tax-settlement-sync\.js/);
assert.doesNotMatch(sw, /rc15-c1-4-invoice-input-stability\.js/);

console.log('c2-money-contract-v2.spec.mjs: PASS');
