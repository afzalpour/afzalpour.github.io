import assert from 'node:assert/strict';
import {
  integerFromText,
  finalInvoiceTotal,
  groupInteger
} from '../src/ui/settlement/tax-settlement-sync.js';

assert.equal(integerFromText('۱۱٬۰۰۶ تومان'), 11006n);
assert.equal(integerFromText('10,005 تومان'), 10005n);
assert.equal(groupInteger(11006n), '11٬006');

const nodes = new Map([
  ['[data-rc15-invoice-tax-summary] .rc15-grand b', { textContent: '۱۱٬۰۰۶ تومان' }],
  ['.invoice-grand-total', { textContent: '۱۰٬۰۰۵ تومان' }]
]);
const form = {
  dataset: { avanInvoiceTotal: '10005' },
  querySelector(selector) { return nodes.get(selector) || null; }
};

assert.equal(
  finalInvoiceTotal(form),
  11006n,
  'VAT-inclusive tax grand total must win over stale/pre-tax totals'
);

nodes.delete('[data-rc15-invoice-tax-summary] .rc15-grand b');
assert.equal(finalInvoiceTotal(form), 10005n);

console.log('tax-settlement-sync.spec.mjs: PASS');
