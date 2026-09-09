import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  UNIT_TOMAN,
  UNIT_RIAL,
  displayToCanonical,
  canonicalToDisplay,
  lineCanonicalAmount,
  formatCanonical,
  formatCanonicalDecimal
} from '../src/core/money/canonical-money.js';
import { calculateVatAmount } from '../src/domains/tax/vat-calculator.js';

assert.deepEqual(displayToCanonical('10٬005', UNIT_TOMAN), { ok: true, value: 10005n, code: null });
assert.deepEqual(displayToCanonical('100٬050', UNIT_RIAL), { ok: true, value: 10005n, code: null });
assert.equal(displayToCanonical('10٬005', UNIT_RIAL).ok, false);
assert.equal(canonicalToDisplay(11006n, UNIT_TOMAN), 11006n);
assert.equal(canonicalToDisplay(11006n, UNIT_RIAL), 110060n);

const tomanLine = lineCanonicalAmount({ quantity: '1', unitPrice: '10005', discount: '0', unit: UNIT_TOMAN });
assert.equal(tomanLine.ok, true);
assert.equal(tomanLine.value, '10005');
const rialLine = lineCanonicalAmount({ quantity: '1', unitPrice: '100050', discount: '0', unit: UNIT_RIAL });
assert.equal(rialLine.ok, true);
assert.equal(rialLine.value, '10005');
const oddRialLine = lineCanonicalAmount({ quantity: '1', unitPrice: '1515', discount: '0', unit: UNIT_RIAL });
assert.equal(oddRialLine.ok, true);
assert.equal(oddRialLine.value, '151.5');
assert.equal(oddRialLine.tenths, 1515n);
const subRialLine = lineCanonicalAmount({ quantity: '1', unitPrice: '1515.5', discount: '0', unit: UNIT_RIAL });
assert.equal(subRialLine.ok, false);
assert.equal(subRialLine.code, 'CANONICAL_TENTH_PRECISION_EXCEEDED');

const vat = calculateVatAmount({ taxableAmount: 10005n, rate: '10' });
assert.equal(vat, 1001n);
assert.equal(formatCanonical(10005n, UNIT_TOMAN), '10٬005 تومان');
assert.equal(formatCanonicalDecimal('151.5', UNIT_RIAL), '1٬515 ریال');

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const invoiceMoney = read('src/ui/money/invoice-money-workspace.js');
const moneyInputs = read('src/ui/money/money-inputs.js');
const moneyOutput = read('src/ui/money/money-output-contract.js');
const settlementV2 = read('src/ui/settlement/settlement-workspace-v2.js');
const finalPolish = read('rc13-final-polish.js');
const sw = read('sw.js');

assert.match(index, /src\/ui\/money\/money-runtime\.js/);
assert.match(index, /src\/ui\/money\/money-inputs\.js/);
assert.match(index, /src\/ui\/money\/invoice-money-workspace\.js/);
assert.match(index, /src\/ui\/settlement\/settlement-workspace-v2\.js/);
assert.doesNotMatch(index, /src="rc11-currency\.js"/);
assert.doesNotMatch(index, /src="rc11-money\.js"/);
assert.doesNotMatch(index, /src="rc11-unit-density\.js"/);
assert.doesNotMatch(index, /src\/ui\/money\/invoice-canonical-input-boundary\.js/);
assert.doesNotMatch(index, /src\/ui\/settlement\/tax-settlement-sync\.js/);
assert.doesNotMatch(index, /rc15-c1-4-invoice-input-stability\.js/);

assert.match(invoiceMoney, /money\.invoice-canonical-payload/);
assert.match(invoiceMoney, /displayDecimalToCanonicalTenth\(line\.unit_price, unit\)/);
assert.match(invoiceMoney, /displayDecimalToCanonicalTenth\(unitPrice\?\.value/,
  'invoice live validation must use the persisted one-Rial precision boundary');
assert.match(invoiceMoney, /CANONICAL_TENTH_PRECISION_EXCEEDED/,
  'sub-Rial / over-precise Toman values must be rejected rather than rounded silently');
assert.match(invoiceMoney, /MoneyRuntime\.formatCanonicalDecimal/);
assert.doesNotMatch(invoiceMoney, /RIAL_NOT_DIVISIBLE_BY_10/);
assert.match(invoiceMoney, /avanCanonicalInvoiceTotalToman/);
assert.match(invoiceMoney, /rc15TaxMetadataReady/);
assert.match(moneyInputs, /INVOICE_DECIMAL_NAMES/);
assert.match(moneyOutput, /stripRepeatedUnitsFromReportTables/);
assert.match(moneyOutput, /inlineUnit: isPreparedReports/);
assert.match(moneyOutput, /repairTrialBalanceSummary/);

assert.match(settlementV2, /form\.dataset\.v60Settlement = '1'/);
assert.match(settlementV2, /type="hidden" name="v60_amount"/);
assert.match(settlementV2, /MoneyRuntime\.parseInput/);
assert.match(finalPolish, /AvanMoneyOutput/);
assert.match(sw, /avan-staging-rc1-v77-money-architecture-gate/);
assert.match(sw, /src\/core\/money\/canonical-money\.js/);
assert.match(sw, /src\/ui\/money\/invoice-money-workspace\.js/);
assert.doesNotMatch(sw, /invoice-canonical-input-boundary\.js/);

console.log('c2-money-contract-v2.spec.mjs: PASS (unified runtime compatibility)');
