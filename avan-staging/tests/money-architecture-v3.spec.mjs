import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const canonical = read('src/core/money/canonical-money.js');
assert.equal(canonical.includes('CANONICAL_TENTH_SCALE'), true);
assert.equal(canonical.includes('displayDecimalToCanonicalTenth'), true);
assert.equal(canonical.includes('canonicalDecimalToTenths'), true);
assert.equal(canonical.includes('CANONICAL_TENTH_PRECISION_EXCEEDED'), true);

const moneyRuntime = read('src/ui/money/money-runtime.js');
assert.equal(moneyRuntime.includes('carriesCanonicalFraction'), true);
assert.equal(moneyRuntime.includes('formatCanonicalDecimal'), true);
assert.equal(moneyRuntime.includes('decimalInputFromCanonical'), true);

const invoice = read('src/ui/money/invoice-money-workspace.js');
assert.equal(invoice.includes("money.invoice-canonical-payload"), true);
assert.equal(invoice.includes('displayDecimalToCanonicalTenth'), true);
assert.equal(invoice.includes('RIAL_NOT_DIVISIBLE_BY_10'), false);
assert.equal(invoice.includes('CANONICAL_TENTH_PRECISION_EXCEEDED'), true);

const inputs = read('src/ui/money/money-inputs.js');
assert.equal(inputs.includes('INVOICE_DECIMAL_NAMES'), true);

const output = read('src/ui/money/money-output-contract.js');
assert.equal(output.includes('stripRepeatedUnitsFromReportTables'), true);
assert.equal(output.includes('repairTrialBalanceSummary'), true);
assert.equal(output.includes('centerReportHeaders'), true);
assert.equal(output.includes("[data-r]"), true);

const settlement = read('src/ui/settlement/settlement-workspace-v2.js');
assert.equal(settlement.includes('canonicalDecimalToTenths'), true);
assert.equal(settlement.includes('displayDecimalToCanonicalTenth'), true);
assert.equal(settlement.includes('BigInt(form.dataset.avanCanonicalInvoiceTotalToman'), false);

const settlementSave = read('src/ui/settlement/settlement-save-boundary-v3.js');
assert.equal(settlementSave.includes('canonicalDecimalToTenths'), true);
assert.equal(settlementSave.includes('persisted?.[0]?.total_amount'), true);
assert.equal(settlementSave.includes('integerBig'), false);

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

const sw = read('sw.js');
assert.equal(sw.includes('avan-staging-rc1-v79-reconciliation-intelligence-gate'), true);
assert.equal(sw.includes('src/ui/settlement/settlement-save-boundary-v3.js'), true);

console.log('money-architecture-v3: PASS');
