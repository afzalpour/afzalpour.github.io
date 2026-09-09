import assert from 'node:assert/strict';
import {
  UNIT_RIAL,
  UNIT_TOMAN,
  displayToCanonical,
  canonicalToDisplay,
  displayDecimalToCanonical,
  canonicalDecimalToDisplay,
  formatCanonical,
  formatCanonicalDecimal,
  lineCanonicalAmount,
  sumCanonicalDecimals
} from '../src/core/money/canonical-money.js';

assert.equal(displayToCanonical('10005', UNIT_RIAL).ok, false);
assert.equal(displayToCanonical('10005', UNIT_RIAL).code, 'RIAL_NOT_DIVISIBLE_BY_10');
assert.equal(displayToCanonical('100050', UNIT_RIAL).value, 10005n);
assert.equal(canonicalToDisplay(10005n, UNIT_RIAL), 100050n);
assert.equal(canonicalToDisplay(10005n, UNIT_TOMAN), 10005n);

const decimalRial = displayDecimalToCanonical('10005', UNIT_RIAL);
assert.equal(decimalRial.ok, true);
assert.equal(decimalRial.value, '1000.5');
assert.equal(canonicalDecimalToDisplay('1000.5', UNIT_RIAL), '10005');
assert.equal(sumCanonicalDecimals(['0.1', '0.2', '1000.5']), '1000.8');

assert.equal(formatCanonical(10005n, UNIT_RIAL), '100٬050 ریال');
assert.equal(formatCanonical(10005n, UNIT_TOMAN), '10٬005 تومان');
assert.equal(formatCanonicalDecimal('1000.5', UNIT_RIAL), '10٬005 ریال');
assert.equal(formatCanonicalDecimal('1000.5', UNIT_TOMAN), '1٬000٫5 تومان');

const invoiceLine = lineCanonicalAmount({
  quantity: '1',
  unitPrice: '100050',
  discount: '0',
  unit: UNIT_RIAL
});
assert.equal(invoiceLine.ok, true);
assert.equal(invoiceLine.value, 10005n);

console.log('money-core-v3: PASS');
