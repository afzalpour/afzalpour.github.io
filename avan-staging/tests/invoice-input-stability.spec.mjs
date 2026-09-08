import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../rc15-c1-4-invoice-input-stability.js', import.meta.url), 'utf8');

assert.match(source, /new Set\(\['quantity', 'unit_price', 'discount'\]\)/,
  'stability binding must be limited to the three invoice amount inputs');
assert.match(source, /event\.stopPropagation\(\)/,
  'invoice monetary input must not bubble into the legacy settlement form listener');
assert.doesNotMatch(source, /stopImmediatePropagation/,
  'target-level formatting and tax listeners must remain active');
assert.match(source, /window\.AvanTaxSettlementSync\?\.sync/,
  'C1.4 compatibility refresh must delegate to the VAT-aware settlement sync when installed');
assert.match(source, /queueMicrotask\(\(\) => refreshAfterInvoiceInput\(form\)\)/,
  'settlement totals must be refreshed after target handlers finish');
assert.match(source, /data-v60-settlement-box/,
  'fallback compatibility refresh must remain scoped to the settlement panel');
assert.match(source, /c1\.4:invoice-input-stability/,
  'binding must use the central UI lifecycle');
assert.match(source, /input\.dataset\.c14InputStable === '1'/,
  'dynamic rows must be bound idempotently');

console.log('invoice-input-stability.spec.mjs: PASS');
