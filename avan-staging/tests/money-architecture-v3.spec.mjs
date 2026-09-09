import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const index = read('index.html');
for (const retired of ['rc11-money.js', 'rc11-currency.js', 'rc11-unit-density.js']) {
  assert.equal(index.includes(`src="${retired}"`), false, `${retired} must stay retired from index`);
}
for (const required of [
  'src/ui/money/money-runtime.js',
  'src/ui/money/money-inputs.js',
  'src/ui/money/money-output-contract.js',
  'src/ui/money/invoice-money-workspace.js',
  'src/ui/settlement/settlement-workspace-v2.js'
]) {
  assert.equal(index.includes(`src="${required}"`), true, `${required} must be active`);
}

const taxDate = read('src/ui/tax/tax-date-aware.js');
assert.equal(taxDate.includes('calculateVatAmount'), false);
assert.equal(taxDate.includes('calculateTaxableAmount'), false);
assert.equal(taxDate.includes('rc15-invoice-totals'), false);
assert.equal(taxDate.includes('data-rc15-invoice-tax-summary'), false);
assert.equal(taxDate.includes("setDataset(option, 'taxRate'"), true);
assert.equal(taxDate.includes("setDataset(option, 'taxRuleId'"), true);
assert.equal(taxDate.includes("setDataset(option, 'taxRuleName'"), true);
assert.equal(taxDate.includes('rc15TaxMetadataReady'), true);

const invoice = read('src/ui/money/invoice-money-workspace.js');
assert.equal(invoice.includes("architecture: 'invoice-money-single-writer-v3'"), true);
assert.equal(invoice.includes('rc15TaxMetadataReady'), true);
assert.equal(invoice.includes('MoneyRuntime.formatCanonical(subtotal)'), true);
assert.equal(invoice.includes('MoneyRuntime.formatCanonical(tax)'), true);

const inputs = read('src/ui/money/money-inputs.js');
assert.equal(inputs.includes("const DECIMAL_NAMES = new Set(['cost', 'unit_cost'])"), true);
assert.equal(inputs.includes("input.dataset.avanMoneyInputMode = mode"), true);

const inventory = read('rc14-inventory-operations.js');
assert.equal(inventory.includes('MoneyRuntime.parseDecimalInput'), true);
assert.equal(inventory.includes('MoneyRuntime.formatCanonicalDecimal'), true);
assert.equal(inventory.includes('formatCanonical(Math.round'), false);

const print = read('rc12-print-export.js');
assert.equal(print.includes('avan-print-money-unit'), true);
assert.equal(print.includes("csvCell('واحد مبالغ')"), true);
assert.equal(print.includes("th[data-avan-money-unit]"), true);

console.log('money-architecture-v3: PASS');
