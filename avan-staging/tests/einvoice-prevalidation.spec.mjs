import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeElectronicInvoice } from '../src/domains/einvoice/einvoice-contract.js';
import { prevalidateElectronicInvoice } from '../src/domains/einvoice/prevalidation.js';
import { ProviderNeutralAdapter, ADAPTER_SUBMISSION_DISABLED } from '../src/domains/einvoice/adapter-contract.js';

const base = {
  company: { id: 'w1', name: 'شرکت آزمون' },
  taxSettings: {
    tax_enabled: true,
    e_invoice_enabled: true,
    taxpayer_type: 'legal_entity',
    tax_identifier: 'tax-1',
    economic_code: 'eco-1',
    taxpayer_memory_id: 'mem-1'
  },
  invoice: {
    id: 'i1', invoice_no: 15, invoice_type: 'sale', invoice_date: '2026-09-09', due_date: null,
    party_id: 'p1', description: 'فروش', subtotal_amount: '151.5', tax_total: '15.2', total_amount: '166.7',
    status: 'posted', journal_entry_id: 'j1'
  },
  party: { id: 'p1', name: 'خریدار', national_id: '1234567890', economic_code: null, postal_code: '1234567890' },
  lines: [{
    id: 'l1', line_no: 1, item_id: 'item1', description: 'خدمت آزمون', quantity: '1',
    unit_price: '151.5', discount: '0', line_total: '151.5',
    tax_profile_id: 'tp1', tax_rule_version_id: 'tr1', tax_rate: '10', taxable_amount: '151.5', tax_amount: '15.2',
    tax_treatment: 'standard', tax_profile_code: 'VAT10', tax_profile_name_fa: 'استاندارد'
  }],
  itemsById: new Map([['item1', { id: 'item1', sku: 'S1', name: 'خدمت آزمون', official_goods_service_id: '1234567890123' }]])
};

const validModel = normalizeElectronicInvoice(base);
const valid = prevalidateElectronicInvoice(validModel);
assert.equal(valid.ready, true, JSON.stringify(valid.findings));
assert.equal(valid.summary.errors, 0);
assert.equal(validModel.invoice.total_amount, '166.7', 'one-Rial precision must remain canonical');
assert.equal(validModel.lines[0].official_goods_service_id, '1234567890123');

const purchase = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base, invoice: { ...base.invoice, invoice_type: 'purchase' }
}));
assert.equal(purchase.ready, false);
assert.equal(purchase.findings.some(item => item.code === 'OUTGOING_SALE_ONLY'), true);

const sellerMissing = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base, taxSettings: { ...base.taxSettings, taxpayer_memory_id: null, tax_identifier: null }
}));
assert.equal(sellerMissing.ready, false);
assert.equal(sellerMissing.findings.some(item => item.code === 'SELLER_MEMORY_ID_MISSING'), true);
assert.equal(sellerMissing.findings.some(item => item.code === 'SELLER_TAX_IDENTIFIER_MISSING'), true);

const itemMissing = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base, itemsById: new Map()
}));
assert.equal(itemMissing.ready, false);
assert.equal(itemMissing.findings.some(item => item.code === 'GOODS_SERVICE_ID_MISSING'), true);

const badTotals = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base, invoice: { ...base.invoice, subtotal_amount: '151.4', total_amount: '166.6' }
}));
assert.equal(badTotals.ready, false);
assert.equal(badTotals.findings.some(item => item.code === 'INVOICE_SUBTOTAL_MISMATCH'), true);

const subRial = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base,
  invoice: { ...base.invoice, total_amount: '166.75' }
}));
assert.equal(subRial.ready, false);
assert.equal(subRial.findings.some(item => item.code === 'INVOICE_MONEY_PRECISION_INVALID'), true);

const buyerIncomplete = prevalidateElectronicInvoice(normalizeElectronicInvoice({
  ...base, party: { ...base.party, national_id: null, economic_code: null }
}));
assert.equal(buyerIncomplete.ready, true, 'provider-dependent buyer identity must warn, not hard-code a volatile block');
assert.equal(buyerIncomplete.findings.some(item => item.code === 'BUYER_IDENTITY_INCOMPLETE' && item.severity === 'warning'), true);

assert.equal(ProviderNeutralAdapter.supports_submission, false);
await assert.rejects(
  () => ProviderNeutralAdapter.submit(validModel),
  error => error?.code === ADAPTER_SUBMISSION_DISABLED
);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const adapter = read('src/domains/einvoice/adapter-contract.js');
const service = read('src/application/einvoice/einvoice-service.js');
const ui = read('src/ui/einvoice/einvoice-preflight-ui.js');
const prevalidation = read('src/domains/einvoice/prevalidation.js');

for (const source of [adapter, service, ui]) {
  assert.doesNotMatch(source, /service_role|secret[_-]?key|private[_-]?key/i, 'browser e-invoice boundary must contain no secrets');
  assert.doesNotMatch(source, /post_journal_entry|C\.insert\(['"]journal/i, 'preflight must not mutate the ledger');
}
assert.doesNotMatch(adapter, /fetch\s*\(/, 'provider-neutral adapter must perform no network submission');
assert.doesNotMatch(service, /fetch\s*\(/, 'preflight service must perform no external network submission');
assert.match(ui, /هیچ صورتحسابی .* ارسال نشده است/);
assert.match(prevalidation, /GOODS_SERVICE_ID/);
assert.match(prevalidation, /LINE_TAX_SNAPSHOT_MISSING/);
assert.match(prevalidation, /INVOICE_FINAL_TOTAL_MISMATCH/);

console.log('einvoice-prevalidation.spec.mjs: PASS');
