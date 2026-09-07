import assert from 'node:assert/strict';
import {
  parseIntegerMoney,
  parseQuantityMicros,
  parseRateUnits,
  calculateTaxableAmount,
  calculateVatAmount,
  calculateVatLine,
  aggregateVatLines
} from '../src/domains/tax/vat-calculator.js';

assert.equal(parseIntegerMoney('۱٬۲۳۴٬۵۶۷'), 1234567n);
assert.equal(parseQuantityMicros('۱٫۵'), 1500000n);
assert.equal(parseRateUnits('۱۰'), 100000n);
assert.equal(calculateTaxableAmount({ quantity: '2', unitPrice: '1,000', discount: '100' }), 1900n);
assert.equal(calculateVatAmount({ taxableAmount: 10005n, rate: '10' }), 1001n);

const standard = calculateVatLine({ quantity: '1', unitPrice: '10005', discount: '0', rate: '10' });
assert.deepEqual(standard, {
  taxableAmount: 10005n,
  taxAmount: 1001n,
  totalAmount: 11006n
});

const exempt = calculateVatLine({ quantity: '3.25', unitPrice: '2000', discount: '500', rate: '0' });
assert.deepEqual(exempt, {
  taxableAmount: 6000n,
  taxAmount: 0n,
  totalAmount: 6000n
});

assert.deepEqual(aggregateVatLines([standard, exempt]), {
  taxableAmount: 16005n,
  taxAmount: 1001n,
  totalAmount: 17006n
});

console.log('vat-calculator.spec.mjs: PASS');
