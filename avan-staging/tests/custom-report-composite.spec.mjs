import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const builder = read('src/ui/reports/custom-report-builder.js');
const sql = read('APPLIED_RC1_5_CUSTOM_REPORT_COMPOSITE_V2.sql');
const sw = read('sw.js');
const bootstrap = read('rc15-c1-bootstrap.js');

assert.match(bootstrap, /custom-report-builder\.js/,
  'custom report builder must remain active through the C1 bootstrap');

assert.match(builder, /composite_events/);
assert.match(builder, /گزارش ترکیبی — همه متغیرها/);
for (const variable of [
  'event_date','event_domain','party_name','invoice_total','journal_debit','journal_credit',
  'transaction_amount','item_name','warehouse_name','inventory_value','settlement_amount',
  'check_number','smart_document_amount'
]) assert.equal(builder.includes(variable), true, `composite variable ${variable} must be exposed`);

for (const source of [
  'invoices','invoice_lines','journals','journal_lines','transactions','settlements','checks',
  'inventory_items','inventory_stock','inventory_movements','inventory_documents','accounts',
  'financial_accounts','parties','smart_documents'
]) assert.equal(builder.includes(`${source}:`), true, `source ${source} must be available in builder`);

assert.match(builder, /جستجوی متغیر/);
assert.match(builder, /selectAllReportVariables/);
assert.match(builder, /clearReportVariables/);
assert.match(builder, /MoneyRuntime\.formatCanonicalDecimal/,
  'custom report money cells must use shared money runtime');
assert.doesNotMatch(builder, /\$\{number\.toLocaleString[^\n]*\} تومان/,
  'custom reports must not hard-code Toman beside every amount');
assert.match(builder, /data-avan-money-unit/,
  'custom report monetary headings must carry the active unit');
assert.match(builder, /AvanPrintExport\?\.printElement/,
  'custom report result must print through the shared print contract');
assert.match(builder, /font-family:'Vazirmatn',Tahoma,Arial,sans-serif/);
assert.match(builder, /direction:rtl/);
assert.match(builder, /text-align:center!important/);

assert.match(sql, /custom_reports_source_key_check/);
assert.match(sql, /composite_events/);
assert.match(sql, /security invoker/i);
assert.doesNotMatch(sql, /security definer/i);
assert.match(sql, /has_workspace_access\(wid\)/);
assert.match(sql, /revoke all on function public\.run_custom_report\(uuid,text,date,date,integer\) from public, anon/i);
assert.match(sql, /grant execute on function public\.run_custom_report\(uuid,text,date,date,integer\) to authenticated/i);
for (const domain of [
  'invoices','invoice_lines','journal_entries','journal_lines','financial_transactions',
  'invoice_settlement_schedule','financial_checks','inventory_movements','inventory_documents','documents'
]) assert.equal(sql.includes(domain), true, `composite backend must cover ${domain}`);

assert.match(sw, /avan-staging-rc1-v80-report-live-composite-gate/);
assert.match(sw, /src\/ui\/reports\/custom-report-builder\.js/);

console.log('custom-report-composite.spec.mjs: PASS');