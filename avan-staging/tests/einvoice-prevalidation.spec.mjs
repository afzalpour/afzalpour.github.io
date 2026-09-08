import assert from 'node:assert/strict';
import { validateEInvoiceCandidate } from '../src/domains/einvoice/prevalidation.js';
import manifest from '../src/domains/einvoice/adapters/iran-taxpayer-2026-07.js';

function readyCandidate() {
  return {
    invoice: {
      id: 'inv-1',
      invoice_type: 'sale',
      status: 'posted',
      subtotal_amount: '10005',
      tax_total: '1001',
      total_amount: '11006'
    },
    settings: {
      taxpayer_memory_id: 'MEMORY-1',
      economic_code: 'ECON-1',
      tax_identifier: null,
      e_invoice_enabled: false
    },
    buyer: {
      national_id: '1234567890',
      economic_code: null
    },
    lines: [{
      line_no: 1,
      official_goods_service_id: '2330000000001',
      tax_rule_version_id: 'rule-1',
      tax_profile_code: 'standard',
      tax_treatment: 'standard',
      taxable_amount: '10005',
      tax_amount: '1001'
    }]
  };
}

const ready = validateEInvoiceCandidate(readyCandidate(), manifest, {
  subject: 'original',
  pattern: 'general'
});
assert.equal(ready.ok, true);
assert.equal(ready.errors.length, 0);
assert.ok(ready.warnings.some(row => row.code === 'TRANSPORT_DISABLED'));
assert.ok(ready.warnings.some(row => row.code === 'SPEC_NEEDS_OFFICIAL_RECHECK'));

const missingStuff = readyCandidate();
missingStuff.lines[0].official_goods_service_id = '';
const missingStuffResult = validateEInvoiceCandidate(missingStuff, manifest);
assert.equal(missingStuffResult.ok, false);
assert.ok(missingStuffResult.errors.some(row => row.code === 'GOODS_SERVICE_ID_REQUIRED' && row.line_no === 1));

const missingMemory = readyCandidate();
missingMemory.settings.taxpayer_memory_id = '';
assert.ok(validateEInvoiceCandidate(missingMemory, manifest).errors.some(row => row.code === 'SELLER_MEMORY_ID_REQUIRED'));

const purchase = readyCandidate();
purchase.invoice.invoice_type = 'purchase';
assert.ok(validateEInvoiceCandidate(purchase, manifest).errors.some(row => row.code === 'SALE_ONLY'));

const draft = readyCandidate();
draft.invoice.status = 'draft';
assert.ok(validateEInvoiceCandidate(draft, manifest).errors.some(row => row.code === 'POSTED_ONLY'));

const badTotal = readyCandidate();
badTotal.invoice.total_amount = '11007';
assert.ok(validateEInvoiceCandidate(badTotal, manifest).errors.some(row => row.code === 'TOTAL_INVALID'));

const longNote = validateEInvoiceCandidate(readyCandidate(), manifest, { note1: 'الف'.repeat(31) });
assert.ok(longNote.errors.some(row => row.code === 'NOTE1_TOO_LONG'));

assert.equal(manifest.transport.enabled, false);
assert.equal(manifest.reportedSpecVersion, '7.9');
assert.deepEqual(manifest.supportedSubjects, ['original']);

console.log('einvoice-prevalidation.spec.mjs: PASS');
