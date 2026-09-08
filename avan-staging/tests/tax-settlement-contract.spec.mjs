import assert from 'node:assert/strict';
import { calculateInvoicePayableTotals } from '../src/ui/invoices/invoice-payable-total.js';

const profiles = [
  { id: 'standard', rate: 10 },
  { id: 'exempt', rate: 0 }
];

const taxable = calculateInvoicePayableTotals([
  { used: true, quantity: '1', unitPrice: '10005', discount: '0', taxProfileId: 'standard' }
], profiles, true);
assert.equal(taxable.subtotal, 10005n);
assert.equal(taxable.tax, 1001n);
assert.equal(taxable.total, 11006n);

const taxOff = calculateInvoicePayableTotals([
  { used: true, quantity: '1', unitPrice: '10005', discount: '0', taxProfileId: 'standard' }
], profiles, false);
assert.equal(taxOff.subtotal, 10005n);
assert.equal(taxOff.tax, 0n);
assert.equal(taxOff.total, 10005n);

const mixed = calculateInvoicePayableTotals([
  { used: true, quantity: '1', unitPrice: '10005', discount: '0', taxProfileId: 'standard' },
  { used: true, quantity: '1', unitPrice: '20000', discount: '0', taxProfileId: 'exempt' },
  { used: false, quantity: '1', unitPrice: '99999', discount: '0', taxProfileId: 'standard' }
], profiles, true);
assert.equal(mixed.subtotal, 30005n);
assert.equal(mixed.tax, 1001n);
assert.equal(mixed.total, 31006n);

console.log('tax-settlement-contract.spec.mjs: PASS');
