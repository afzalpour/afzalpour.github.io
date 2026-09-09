import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineCanonicalAmount, UNIT_RIAL } from '../src/core/money/canonical-money.js';
import { calculateVatAmount } from '../src/domains/tax/vat-calculator.js';
import { validateSettlementPlanTotal } from '../src/domains/settlement/settlement-plan-contract.js';
import { normalizeElectronicInvoice } from '../src/domains/einvoice/einvoice-contract.js';
import { prevalidateElectronicInvoice } from '../src/domains/einvoice/prevalidation.js';
import { ProviderNeutralAdapter } from '../src/domains/einvoice/adapter-contract.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const sw = read('sw.js');
const packageJson = JSON.parse(read('package.json'));
const productionConfig = fs.readFileSync(new URL('../../config.js', import.meta.url), 'utf8');
const stagingConfig = read('config.js');

// Shell / PWA / mobile / print boundaries.
assert.match(index, /<html lang="fa" dir="rtl">/);
assert.match(index, /viewport-fit=cover/);
assert.match(index, /rel="manifest" href="manifest\.webmanifest"/);
assert.match(index, /rc12-print-export\.css/);
assert.match(index, /src="rc12-print-export\.js"/);
assert.match(index, /src="rc12-mobile-navigation\.js"/);
assert.match(index, /src="rc13-session-security\.js"/);

// Accounting / inventory / invoice runtime must remain present in Staging.
for (const asset of [
  'rc14-inventory-foundation.js',
  'rc14-inventory-operations.js',
  'rc14-inventory-form-stability.js',
  'rc14-invoice-inventory-ui.js',
  'rc14-invoice-live-refinements.js',
  'rc14-purchase-receipt-and-inventory-polish.js',
  'rc14-account-four-level.js'
]) {
  assert.match(index, new RegExp(`src="${asset.replaceAll('.', '\\.')}"`), `${asset} must remain loaded`);
}

// Active money/tax/settlement/report/e-invoice ownership.
for (const asset of [
  'src/ui/money/money-runtime.js',
  'src/ui/money/money-inputs.js',
  'src/ui/money/money-output-contract.js',
  'src/ui/money/invoice-money-workspace.js',
  'src/ui/settlement/settlement-save-boundary-v3.js',
  'src/ui/settlement/settlement-workspace-v2.js',
  'rc15-tax-ux-v3.js',
  'src/ui/reports/reconciliation-workspace.js',
  'src/ui/einvoice/einvoice-preflight-ui.js'
]) {
  assert.match(index, new RegExp(asset.replaceAll('/', '\\/').replaceAll('.', '\\.')), `${asset} must remain loaded`);
}
assert.ok(
  index.indexOf('src/ui/settlement/settlement-save-boundary-v3.js') < index.indexOf('rc14-catalog-settlement-v61.js'),
  'exact settlement save owner must register before the v61 compatibility shell'
);

// Superseded C2 compatibility modules must not return to the active runtime.
for (const retired of [
  'src/ui/money/invoice-canonical-input-boundary.js',
  'src/ui/settlement/tax-settlement-sync.js',
  'rc15-c1-4-invoice-input-stability.js'
]) {
  assert.doesNotMatch(index, new RegExp(retired.replaceAll('/', '\\/').replaceAll('.', '\\.')), `${retired} is retired`);
}

// Deterministic one-Rial invoice -> VAT -> settlement -> e-Invoice chain.
const line = lineCanonicalAmount({ quantity: '1', unitPrice: '1515', discount: '0', unit: UNIT_RIAL });
assert.equal(line.ok, true);
assert.equal(line.tenths, 1515n);
assert.equal(line.value, '151.5');
const taxTenths = calculateVatAmount({ taxableAmount: line.tenths, rate: '10' });
assert.equal(taxTenths, 152n);
const finalTenths = line.tenths + taxTenths;
assert.equal(finalTenths, 1667n);
assert.equal(validateSettlementPlanTotal('166.7', [
  { amount: '55.6' }, { amount: '55.6' }, { amount: '55.5' }
]).ok, true);
assert.equal(validateSettlementPlanTotal('166.7', [{ amount: '166.6' }]).ok, false);

const einvoice = normalizeElectronicInvoice({
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
    id: 'i1', invoice_no: 1, invoice_type: 'sale', invoice_date: '2026-09-09',
    party_id: 'p1', description: 'فروش', subtotal_amount: '151.5', tax_total: '15.2', total_amount: '166.7',
    status: 'posted', journal_entry_id: 'j1'
  },
  party: { id: 'p1', name: 'خریدار', national_id: '1234567890', postal_code: '1234567890' },
  lines: [{
    id: 'l1', line_no: 1, item_id: 'item1', description: 'خدمت آزمون', quantity: '1', unit_price: '151.5',
    discount: '0', line_total: '151.5', tax_profile_id: 'tp1', tax_rule_version_id: 'tr1', tax_rate: '10',
    taxable_amount: '151.5', tax_amount: '15.2', tax_treatment: 'standard',
    tax_profile_code: 'VAT10', tax_profile_name_fa: 'استاندارد'
  }],
  itemsById: new Map([['item1', { id: 'item1', sku: 'S1', name: 'خدمت آزمون', official_goods_service_id: '1234567890123' }]])
});
const preflight = prevalidateElectronicInvoice(einvoice);
assert.equal(preflight.ready, true, JSON.stringify(preflight.findings));
assert.equal(ProviderNeutralAdapter.supports_submission, false, 'external e-Invoice submission must remain disabled');

// PWA cache must carry every active extracted contract needed by the above chain.
assert.match(sw, /const CACHE='avan-staging-rc1-v\d+-[^']+'/);
for (const asset of [
  'src/core/money/canonical-money.js',
  'src/domains/tax/vat-calculator.js',
  'src/domains/settlement/settlement-plan-contract.js',
  'src/ui/settlement/settlement-save-boundary-v3.js',
  'src/ui/settlement/settlement-workspace-v2.js',
  'src/domains/einvoice/einvoice-contract.js',
  'src/domains/einvoice/prevalidation.js',
  'src/domains/einvoice/adapter-contract.js',
  'src/ui/einvoice/einvoice-preflight-ui.js'
]) {
  assert.match(sw, new RegExp(asset.replaceAll('/', '\\/').replaceAll('.', '\\.')), `PWA cache missing ${asset}`);
}

// Quality command must include the release regression and current active integration suites.
const qualityTests = packageJson.scripts['test:architecture'];
for (const test of [
  'c2-money-contract-v2.spec.mjs',
  'money-core-v3.spec.mjs',
  'money-architecture-v3.spec.mjs',
  'tax-settlement-integration.spec.mjs',
  'reconciliation-intelligence.spec.mjs',
  'custom-report-composite.spec.mjs',
  'einvoice-prevalidation.spec.mjs',
  'rc15-release-regression.spec.mjs'
]) {
  assert.match(qualityTests, new RegExp(test.replaceAll('.', '\\.')), `${test} must be in the active quality gate`);
}
for (const retired of [
  'c2-1-live-display.spec.mjs',
  'c2-2-rial-header-contract.spec.mjs',
  'c2-settlement-integration.spec.mjs',
  'invoice-input-stability.spec.mjs'
]) {
  assert.doesNotMatch(qualityTests, new RegExp(retired.replaceAll('.', '\\.')), `${retired} must remain retired`);
}

// Release-environment separation: this gate must never silently promote Staging runtime.
assert.match(stagingConfig, /environment:\s*'staging-rc1'/);
assert.match(stagingConfig, /https:\/\/afzalpour\.github\.io\/avan-staging\//);
assert.match(productionConfig, /environment:\s*'production'/);
assert.match(productionConfig, /authRedirectUrl:\s*'https:\/\/afzalpour\.github\.io\/'/);
assert.doesNotMatch(productionConfig, /avan-staging/);

console.log('rc15-release-regression: PASS');
