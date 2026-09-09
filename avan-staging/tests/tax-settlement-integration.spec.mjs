import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculateVatAmount } from '../src/domains/tax/vat-calculator.js';
import { canonicalTenthsToDecimal } from '../src/core/money/canonical-money.js';
import {
  canonicalSettlementAmount,
  settlementScheduleTotalTenths,
  validateSettlementPlanTotal
} from '../src/domains/settlement/settlement-plan-contract.js';

const subtotalTenths = 1515n; // 151.5 Toman = 1,515 Rial
const taxTenths = calculateVatAmount({ taxableAmount: subtotalTenths, rate: '10' });
assert.equal(taxTenths, 152n, '10% VAT at one-Rial precision must round to 15.2 Toman');

const totalTenths = subtotalTenths + taxTenths;
assert.equal(totalTenths, 1667n);
const totalCanonical = canonicalTenthsToDecimal(totalTenths);
assert.equal(totalCanonical, '166.7');
assert.deepEqual(canonicalSettlementAmount(totalCanonical), { tenths: 1667n, value: '166.7' });

const simplePlans = [
  [{ amount: '166.7', planned_method: 'open' }],
  [{ amount: '166.7', planned_method: 'cash' }],
  [{ amount: '166.7', planned_method: 'check' }]
];
for (const rows of simplePlans) {
  const result = validateSettlementPlanTotal(totalCanonical, rows);
  assert.equal(result.ok, true);
  assert.equal(result.invoiceTenths, 1667n);
  assert.equal(result.scheduledTenths, 1667n);
}

const installment = [
  { amount: '55.6', planned_method: 'open' },
  { amount: '55.6', planned_method: 'open' },
  { amount: '55.5', planned_method: 'open' }
];
assert.equal(settlementScheduleTotalTenths(installment), 1667n);
assert.equal(validateSettlementPlanTotal(totalCanonical, installment).ok, true);

const mixed = [
  { amount: '100', planned_method: 'bank' },
  { amount: '50', planned_method: 'check' },
  { amount: '16.7', planned_method: 'open' }
];
assert.equal(validateSettlementPlanTotal(totalCanonical, mixed).ok, true);

const mismatch = validateSettlementPlanTotal(totalCanonical, [
  { amount: '100' },
  { amount: '66.6' }
]);
assert.equal(mismatch.ok, false);
assert.equal(mismatch.code, 'SETTLEMENT_TOTAL_MISMATCH');
assert.equal(mismatch.deltaTenths, -1n);

assert.equal(validateSettlementPlanTotal(totalCanonical, [{ amount: '16.75' }]).code, 'INVALID_SETTLEMENT_AMOUNT');
assert.equal(validateSettlementPlanTotal('166.75', [{ amount: '166.7' }]).code, 'INVALID_INVOICE_TOTAL');

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const saveBoundary = read('src/ui/settlement/settlement-save-boundary-v3.js');
const invoiceMoney = read('src/ui/money/invoice-money-workspace.js');

assert.match(invoiceMoney, /calculateVatAmount\(\{ taxableAmount: line\.tenths, rate: taxMeta\.rate \}\)/,
  'VAT preview must calculate in the same one-Rial precision unit as invoice totals');
assert.match(saveBoundary, /validateSettlementPlanTotal\(total\.value, rows\)/,
  'settlement save boundary must validate the persisted VAT-inclusive invoice total');
assert.doesNotMatch(saveBoundary, /scheduledTenths \+=/,
  'settlement total validation must stay centralized in the domain contract');

console.log('tax-settlement-integration: PASS');
