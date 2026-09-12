import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildIranComplianceRadar, IRAN_COMPLIANCE_RADAR_ARCHITECTURE } from '../src/intelligence/iran-compliance-radar-foundation.js';

const root = resolve(process.cwd());
const read = path => readFileSync(join(root, path), 'utf8');

assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.methodology, 'deterministic-controls-no-arbitrary-score');
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.writeOperations, 0);
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.actualLedgerMutation, false);
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.submissionSupported, false);
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.fabricatedDeadlines, false);
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.coverage.payroll, false);
assert.equal(IRAN_COMPLIANCE_RADAR_ARCHITECTURE.coverage.insurance, false);

const base = {
  asOf: '2026-09-12',
  periodFrom: '2026-03-21',
  taxSettings: {
    tax_enabled: true,
    taxpayer_type: 'legal',
    tax_identifier: 'TAX-ID',
    taxpayer_memory_id: 'MEMORY-ID',
    e_invoice_enabled: true,
    default_rule_version_id: 'rule-1'
  },
  taxRules: [{
    id: 'rule-1', name_fa: 'قاعده فعال', effective_from: '2026-03-21', effective_to: '2027-03-20',
    standard_vat_rate: '10.0000', status: 'active', source_title: 'منبع نسخه‌دار', source_reference: 'REF-1'
  }],
  taxProfiles: [{ id: 'profile-1', code: 'STD', name_fa: 'استاندارد', rule_version_id: 'rule-1', is_active: true }],
  inventoryItems: [{ id: 'item-1', sku: 'A-1', name: 'خدمت نمونه', tax_profile_id: 'profile-1', official_goods_service_id: '1234567890123', is_active: true }],
  fiscalPeriods: [{ id: 'period-1', name: 'شهریور', date_from: '2026-08-23', date_to: '2026-09-22', status: 'open' }],
  invoices: [
    { id: 'inv-1', invoice_no: 1, invoice_type: 'sale', invoice_date: '2026-09-01', status: 'posted', journal_entry_id: 'j-1', tax_total: '151.5' },
    { id: 'inv-2', invoice_no: 2, invoice_type: 'sale', invoice_date: '2026-09-02', status: 'posted', journal_entry_id: 'j-2', tax_total: '0.1' }
  ],
  invoiceLines: [
    { id: 'line-1', invoice_id: 'inv-1', line_no: 1, item_id: 'item-1', tax_profile_id: 'profile-1', tax_rule_version_id: 'rule-1', tax_treatment: 'standard' },
    { id: 'line-2', invoice_id: 'inv-2', line_no: 1, item_id: 'item-1', tax_profile_id: 'profile-1', tax_rule_version_id: 'rule-1', tax_treatment: 'standard' }
  ]
};

const ready = buildIranComplianceRadar(base);
assert.equal(ready.readiness, 'ready');
assert.equal(ready.summary.outputTaxCanonical, '151.6', 'Output tax sum must preserve one-Rial precision.');
assert.equal(ready.summary.critical, 0);
assert.ok(ready.calendar.every(row => row.legalDeadline === false), 'Foundation calendar must not fabricate legal deadlines.');
assert.ok(ready.notices.some(text => text.includes('حدس زده نمی‌شود')));

const blocked = buildIranComplianceRadar({
  ...base,
  invoiceLines: [{ id: 'line-x', invoice_id: 'inv-1', line_no: 1, item_id: 'item-1', tax_profile_id: null, tax_rule_version_id: null, tax_treatment: null }]
});
assert.equal(blocked.readiness, 'blocked');
assert.ok(blocked.findings.some(row => row.id === 'invoice-tax-snapshot-gap' && row.severity === 'critical'));

const missingRule = buildIranComplianceRadar({ ...base, taxRules: [] });
assert.equal(missingRule.readiness, 'blocked');
assert.ok(missingRule.findings.some(row => row.id === 'rule-missing'));

const service = read('src/application/intelligence/iran-compliance-radar-service.js');
for (const table of ['workspace_tax_settings', 'tax_profiles', 'inventory_items', 'fiscal_years', 'fiscal_periods', 'invoices', 'invoice_lines']) {
  assert.ok(service.includes(`'${table}'`), `Service must read ${table}.`);
}
assert.ok(service.includes('&workspace_id=eq.${wid}'), 'Every company-owned table query must carry explicit workspace_id filter.');
assert.ok(!service.includes('.insert('));
assert.ok(!service.includes('.update('));
assert.ok(!service.includes('.delete('));
assert.ok(!service.includes('cloud.rpc('), 'Compliance Radar foundation must stay read-only without mutation RPCs.');

const ui = read('src/ui/intelligence/iran-compliance-radar-workspace.js');
assert.ok(ui.includes('رادار انطباق مالی ایران'));
assert.ok(ui.includes('فهرست اقدام‌های انطباق'));
assert.ok(ui.includes('تغییرات قواعد ثبت‌شده در آوان'));
assert.ok(ui.includes('موعد قانونی نیست'));
assert.ok(ui.includes('جایگزین نظر حرفه‌ای مالیاتی، حقوقی یا بیمه‌ای نیست'));
assert.ok(ui.includes('اطلاعات مالیاتی ثبت‌شده برای برخی ردیف‌های فروش ناقص است'));
assert.ok(ui.includes('بر پایه قواعد نسخه‌دار و اطلاعات مالیاتی ثبت‌شده'));
assert.ok(ui.includes('در نسخه فعلی پوشش داده نمی‌شود'));
assert.ok(ui.includes('مرجع معتبر داده‌های حقوق و دستمزد'));
assert.ok(ui.includes('مرجع معتبر داده‌های بیمه'));
assert.ok(ui.includes("import { safeDatabaseFacingFa } from '../localization/user-facing-fa.js';"));
assert.ok(ui.includes("active: 'فعال'"));
assert.ok(ui.includes("open: 'باز'"));
assert.ok(!ui.includes('در Foundation فعلی پوشش داده نمی‌شود'));
assert.ok(!ui.includes('بر پایه قواعد نسخه‌دار و Snapshot مالیاتی'));
assert.ok(!ui.includes('تا اضافه‌شدن Source of Truth حقوق'));
assert.ok(ui.includes("import './intelligence-print-export.js';"));
assert.ok(ui.includes('data-compliance-evidence'));
assert.ok(!ui.includes('${ref.id}'), 'Raw evidence IDs must not be rendered to users.');

const print = read('src/ui/intelligence/intelligence-print-export.js');
assert.ok(print.includes("'رادار انطباق مالی ایران'"));
assert.ok(print.includes('.avan-compliance-date-form'));

const index = read('index.html');
assert.ok(index.includes('module5-iran-compliance-radar.css'));
assert.ok(index.includes('src/ui/intelligence/iran-compliance-radar-workspace.js'));

const sw = read('sw.js');
assert.ok(sw.includes('avan-staging-rc1-v118-persian-user-facing-contract'));

console.log('Iran Compliance Radar foundation PASS');
