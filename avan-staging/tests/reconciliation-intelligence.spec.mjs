import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTransactionJournalSuggestion } from '../src/core/reconciliation/transaction-journal-suggestion.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const output = read('src/ui/money/money-output-contract.js');
const settings = read('src/ui/settings/settings-layout-v2.js');
const health = read('src/ui/health/core-health-drilldown.js');
const reconciliation = read('src/ui/reports/reconciliation-workspace.js');
const sql = read('APPLIED_RC1_5_RECONCILIATION_INTELLIGENCE.sql');
const adr = fs.readFileSync(new URL('../../docs/adr/0020-human-controlled-reconciliation-intelligence.md', import.meta.url), 'utf8');

for (const required of [
  'src/ui/settings/settings-layout-v2.js',
  'src/ui/health/core-health-drilldown.js',
  'src/ui/reports/reconciliation-workspace.js'
]) assert.equal(index.includes(`src="${required}"`), true, `${required} must be active in staging`);

assert.equal(output.includes('centerPreparedReportTitles'), true);
assert.equal(output.includes("'#reportOut h2, #reportOut h3'"), true,
  'prepared report visible titles must be centered, not only table headers');

assert.equal(settings.includes("'حساب کاربری'"), true);
assert.equal(settings.includes('#currencySettingsCard'), true);
assert.equal(settings.includes('#rc15TaxSettingsCard'), true);
assert.equal(settings.includes('[data-rc11-access-card]'), true);
assert.equal(settings.includes('accessCard.before(taxCard)'), true,
  'tax settings must be projected immediately before users/access');

for (const code of ['orphan_journal_line', 'posted_invoice_missing_journal', 'invoice_total_mismatch']) {
  assert.equal(health.includes(code), true, `health drilldown must expose ${code}`);
}
assert.equal(health.includes("C.rpc('avan_reconciliation_findings'"), true);
assert.equal(health.includes('جزئیات سلامت هسته'), true);

assert.equal(reconciliation.includes('مغایرت‌یابی هوشمند'), true);
assert.equal(reconciliation.includes("C.rpc('avan_reconciliation_findings'"), true);
assert.equal(reconciliation.includes('پیشنهاد سند اصلاحی — ثبت نشده'), true);
assert.equal(reconciliation.includes('هیچ سندی خودکار ایجاد یا Post نمی‌شود'), true);
assert.equal(reconciliation.includes('post_journal_entry'), false,
  'reconciliation UI must never auto-post journal entries');
assert.equal(reconciliation.includes("C.insert('journal"), false,
  'reconciliation UI must not write journal entries');

assert.match(sql, /security invoker/gi);
assert.doesNotMatch(sql, /security definer/gi);
assert.match(sql, /has_workspace_access\(wid\)/);
assert.match(sql, /revoke all on function public\.avan_reconciliation_findings\(uuid\) from public, anon/i);
assert.match(sql, /grant execute on function public\.avan_reconciliation_findings\(uuid\) to authenticated/i);
for (const domain of [
  'journal_entries', 'journal_lines', 'invoices', 'invoice_lines', 'inventory_documents',
  'inventory_movements', 'invoice_settlement_schedule', 'financial_transactions', 'financial_checks', 'documents'
]) assert.equal(sql.includes(domain), true, `reconciliation SQL must cover ${domain}`);
assert.equal(sql.includes('subtotal_amount'), true);
assert.equal(sql.includes('tax_total'), true, 'invoice integrity must be VAT-aware');

assert.equal(adr.includes('Human-Controlled Reconciliation Intelligence'), true);
assert.equal(adr.includes('هیچ DML مالی انجام نمی‌دهد'), true);

const receipt = buildTransactionJournalSuggestion({
  suggestion_type: 'journal_from_transaction', event_date: '2026-09-09', entity_id: 'tx1', amount: '151.5',
  metadata: { tx_type: 'receipt', to_account_id: 'bank', counterpart_account_id: 'receivable' }
});
assert.deepEqual(receipt.lines, [
  { account_id: 'bank', debit: '151.5', credit: '0' },
  { account_id: 'receivable', debit: '0', credit: '151.5' }
]);

const payment = buildTransactionJournalSuggestion({
  suggestion_type: 'journal_from_transaction', amount: '900',
  metadata: { tx_type: 'payment', from_account_id: 'cash', counterpart_account_id: 'payable' }
});
assert.deepEqual(payment.lines, [
  { account_id: 'payable', debit: '900', credit: '0' },
  { account_id: 'cash', debit: '0', credit: '900' }
]);

const transfer = buildTransactionJournalSuggestion({
  suggestion_type: 'journal_from_transaction', amount: '2500',
  metadata: { tx_type: 'transfer', from_account_id: 'cash', to_account_id: 'bank' }
});
assert.deepEqual(transfer.lines, [
  { account_id: 'bank', debit: '2500', credit: '0' },
  { account_id: 'cash', debit: '0', credit: '2500' }
]);

assert.equal(buildTransactionJournalSuggestion({
  suggestion_type: 'journal_from_transaction', amount: '10', metadata: { tx_type: 'receipt', to_account_id: 'bank' }
}), null, 'ambiguous/missing account mappings must never generate a journal proposal');

console.log('reconciliation-intelligence.spec.mjs: PASS');
