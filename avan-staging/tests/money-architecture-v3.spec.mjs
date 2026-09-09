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
assert.equal(invoice.includes('displayDecimalToCanonicalTenth'), true);
assert.equal(invoice.includes('canonicalTenthsToDecimal'), true);
assert.equal(invoice.includes('MoneyRuntime.formatCanonicalDecimal(total)'), true);
assert.equal(invoice.includes("CANONICAL_TENTH_PRECISION_EXCEEDED"), true);
assert.equal(invoice.includes('RIAL_NOT_DIVISIBLE_BY_10'), false);

const core = read('src/core/money/canonical-money.js');
assert.equal(core.includes('CANONICAL_TENTH_SCALE'), true);
assert.equal(core.includes('CANONICAL_TENTH_PRECISION_EXCEEDED'), true);
assert.equal(core.includes('parsed.micros % CANONICAL_TENTH_SCALE !== 0n'), true);

const inputs = read('src/ui/money/money-inputs.js');
assert.equal(inputs.includes("const DECIMAL_NAMES = new Set(['cost', 'unit_cost'])"), true);
assert.equal(inputs.includes("const INVOICE_DECIMAL_NAMES = new Set(['unit_price', 'discount'])"), true);
assert.equal(inputs.includes("input.closest?.('#invoiceForm') && INVOICE_DECIMAL_NAMES.has"), true);
assert.equal(inputs.includes("input.dataset.avanMoneyInputMode = mode"), true);

const output = read('src/ui/money/money-output-contract.js');
assert.equal(output.includes('stripRepeatedUnitsFromReportTables'), true);
assert.equal(output.includes('inlineUnit: isPreparedReports'), true);
assert.equal(output.includes('repairTrialBalanceSummary'), true);
assert.equal(output.includes('VALUE_UNIT_SUFFIX'), true);

const runtime = read('src/ui/money/money-runtime.js');
assert.equal(runtime.includes('carriesCanonicalFraction'), true);
assert.equal(runtime.includes('service.formatDecimal(value, options)'), true);
assert.equal(runtime.includes('service.decimalInputFromCanonical(value)'), true);

const inventory = read('rc14-inventory-operations.js');
assert.equal(inventory.includes('MoneyRuntime.parseDecimalInput'), true);
assert.equal(inventory.includes('MoneyRuntime.formatCanonicalDecimal'), true);
assert.equal(inventory.includes('formatCanonical(Math.round'), false);

const print = read('rc12-print-export.js');
assert.equal(print.includes('avan-print-money-unit'), true);
assert.equal(print.includes("csvCell('واحد مبالغ')"), true);
assert.equal(print.includes("th[data-avan-money-unit]"), true);

console.log('money-architecture-v3: PASS');
