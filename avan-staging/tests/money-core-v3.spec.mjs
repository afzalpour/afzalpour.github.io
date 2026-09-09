import assert from 'node:assert/strict';
import {
  UNIT_RIAL,
  UNIT_TOMAN,
  displayToCanonical,
  canonicalToDisplay,
  displayDecimalToCanonical,
  displayDecimalToCanonicalTenth,
  canonicalDecimalToDisplay,
  canonicalDecimalToTenths,
  canonicalTenthsToDecimal,
  formatCanonical,
  formatCanonicalDecimal,
  lineCanonicalAmount,
  sumCanonicalDecimals
} from '../src/core/money/canonical-money.js';

// Generic integer-money APIs keep their legacy contract for non-invoice flows.
assert.equal(displayToCanonical('10005', UNIT_RIAL).ok, false);
assert.equal(displayToCanonical('10005', UNIT_RIAL).code, 'RIAL_NOT_DIVISIBLE_BY_10');
assert.equal(displayToCanonical('100050', UNIT_RIAL).value, 10005n);
assert.equal(canonicalToDisplay(10005n, UNIT_RIAL), 100050n);
assert.equal(canonicalToDisplay(10005n, UNIT_TOMAN), 10005n);

// Decimal/canonical invoice boundary preserves one-Rial precision exactly.
const decimalRial = displayDecimalToCanonical('10005', UNIT_RIAL);
assert.equal(decimalRial.ok, true);
assert.equal(decimalRial.value, '1000.5');
assert.equal(canonicalDecimalToDisplay('1000.5', UNIT_RIAL), '10005');
assert.equal(sumCanonicalDecimals(['0.1', '0.2', '1000.5']), '1000.8');

const oneRialPrecision = displayDecimalToCanonicalTenth('1515', UNIT_RIAL);
assert.equal(oneRialPrecision.ok, true);
assert.equal(oneRialPrecision.value, '151.5');
assert.equal(oneRialPrecision.tenths, 1515n);
assert.equal(canonicalDecimalToTenths('151.5'), 1515n);
assert.equal(canonicalTenthsToDecimal(1515n), '151.5');

assert.equal(formatCanonical(10005n, UNIT_RIAL), '100٬050 ریال');
assert.equal(formatCanonical(10005n, UNIT_TOMAN), '10٬005 تومان');
assert.equal(formatCanonicalDecimal('1000.5', UNIT_RIAL), '10٬005 ریال');
assert.equal(formatCanonicalDecimal('1000.5', UNIT_TOMAN), '1٬000٫5 تومان');
assert.equal(formatCanonicalDecimal('151.5', UNIT_RIAL), '1٬515 ریال');
assert.equal(formatCanonicalDecimal('151.5', UNIT_TOMAN), '151٫5 تومان');

const invoiceLine = lineCanonicalAmount({
  quantity: '1',
  unitPrice: '1515',
  discount: '0',
  unit: UNIT_RIAL
});
assert.equal(invoiceLine.ok, true);
assert.equal(invoiceLine.value, '151.5');
assert.equal(invoiceLine.tenths, 1515n);

const fractionalQuantity = lineCanonicalAmount({
  quantity: '2.5',
  unitPrice: '1515',
  discount: '0',
  unit: UNIT_RIAL
});
assert.equal(fractionalQuantity.ok, true);
assert.equal(fractionalQuantity.value, '378.8');
assert.equal(fractionalQuantity.tenths, 3788n);

const rialDiscount = lineCanonicalAmount({
  quantity: '1',
  unitPrice: '1515',
  discount: '5',
  unit: UNIT_RIAL
});
assert.equal(rialDiscount.ok, true);
assert.equal(rialDiscount.value, '151');
assert.equal(rialDiscount.tenths, 1510n);

console.log('money-core-v3: PASS');
