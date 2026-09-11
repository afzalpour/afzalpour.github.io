import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canonicalDecimalToDisplay,
  UNIT_RIAL
} from '../src/core/money/canonical-money.js';
import {
  reportMoneyTenths,
  reportMoneyDecimal
} from '../src/reports/report-money-exact.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const live = read('src/ui/reports/report-exact-live-v2.js');
const index = read('index.html');

// Exact Live values reported by the user: no extra ×10 is allowed.
const profitCanonical = reportMoneyDecimal(reportMoneyTenths('165582622.6'));
assert.equal(profitCanonical, '165582622.6');
assert.equal(canonicalDecimalToDisplay(profitCanonical, UNIT_RIAL), '1655826226');

const assetsCanonical = reportMoneyDecimal(reportMoneyTenths('74082141.5'));
assert.equal(assetsCanonical, '74082141.5');
assert.equal(canonicalDecimalToDisplay(assetsCanonical, UNIT_RIAL), '740821415');

// The authoritative runtime must format canonical decimals, never integerized tenths.
assert.match(live, /MoneyRuntime\.formatCanonicalDecimal\(canonical\)/);
assert.doesNotMatch(live, /cleanAmount|function\s+bi\s*\(|BigInt\(\s*String/);
assert.match(live, /report_profit_loss/);
assert.match(live, /report_balance_sheet/);
assert.match(live, /report_cash_bank_balances/);
assert.match(live, /data-nl-why-number/);
assert.match(live, /button\.dataset\.nlWhyAmount = canonical/);
assert.match(live, /oneRialExact:\s*true/);
assert.match(live, /readOnly:\s*true/);
assert.doesNotMatch(live, /\.insert\(|\.update\(|\.delete\(|service_role/i);

// Direct, cache-busted wiring: do not rely on transitive import side effects.
assert.match(index, /report-exact-live-v2\.js\?rc17-report-live=2/);

console.log('exact-report-live-v2.spec.mjs: PASS');
