import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTransactionJournalSuggestion } from '../src/core/reconciliation/transaction-journal-suggestion.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const core = read('app.js');
const output = read('src/ui/money/money-output-contract.js');
const moneySettings = read('src/ui/money/money-settings-card.js');
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

assert.equal(core.includes('data-report="journal"'), true, 'core prepared reports use data-report tabs');
assert.equal(core.includes("querySelectorAll('[data-report]')"), true, 'core report binding must remain explicit');
assert.equal(output.includes('[data-report]'), true, 'report presentation must follow the native report selector');
assert.equal(output.includes('data-avan-report-surface'), true);
assert.equal(output.includes("setProperty('text-align', 'center', 'important')"), true,
  'web report presentation must beat legacy right-aligned CSS, not only print CSS');
assert.equal(output.includes('centerReportNumericCells'), true,
  'prepared report numeric body/footer cells must be centered explicitly');
assert.equal(output.includes('data-avan-report-number-cell'), true,
  'numeric report cells must carry a stable presentation marker');
assert.equal(output.includes('avanReportPresentationContractStyle'), true);
assert.equal(output.includes('[data-r]'), false, 'obsolete report selector must not drive report presentation');

assert.equal(settings.includes("'حساب کاربری'"), true);
assert.equal(settings.includes('#currencySettingsCard'), true);
assert.equal(settings.includes('#rc15TaxSettingsCard'), true);
assert.equal(settings.includes('#workspaceAccessCard'), true);
assert.equal(settings.includes('data-avan-account-money-slot'), true,
  'currency must mount into a stable account-card slot');
assert.equal(settings.includes('data-avan-tax-slot'), true);
assert.equal(settings.includes('data-avan-access-slot'), true);
assert.equal(settings.includes('avan-settings-slot-placeholder'), true,
  'async settings extensions must reserve their final layout before data arrives');
assert.equal(settings.includes('position:absolute!important'), true,
  'transient async cards must be removed from layout before final mounting');
assert.equal(settings.includes('accountCard.after(stack)'), true,
  'async settings stack must extend below the stable account card instead of pushing core sections');
assert.equal(settings.includes('installStyle(documentObject);\n  const Lifecycle'), true,
  'anti-jump CSS must install eagerly before async settings cards can flash in temporary locations');
assert.equal(settings.includes("priority: 5"), true,
  'final settings slots must be prepared before async money/tax/access producers run');
assert.equal(settings.includes('#content > #currencySettingsCard'), true,
  'only transient root-level cards should be hidden; replacements inside final slots must stay visible');
assert.equal(moneySettings.includes('[data-avan-account-money-slot]'), true,
  'money settings producer must use the final account slot directly when available');
assert.doesNotMatch(settings, /addEventListener\('avan:ui-changed'.*Lifecycle\.schedule/s,
  'settings layout must not feed lifecycle output back into lifecycle scheduling');
assert.doesNotMatch(moneySettings, /addEventListener\('avan:ui-changed'.*Lifecycle\.schedule/s,
  'money settings must not create a ui-changed scheduling loop');
assert.equal(settings.includes('[0, 120, 420, 1000, 2400]'), false,
  'settings layout must not repeatedly move cards on delayed timers');

for (const code of ['orphan_journal_line', 'posted_invoice_missing_journal', 'invoice_total_mismatch']) {
  assert.equal(health.includes(code), true, `health drilldown must expose ${code}`);
}
assert.equal(health.includes("C.rpc('avan_reconciliation_findings'"), true);
assert.equal(health.includes('جزئیات سلامت هسته'), true);

assert.equal(reconciliation.includes('مغایرت‌یابی هوشمند'), true);
assert.equal(reconciliation.includes("C.rpc('avan_reconciliation_findings'"), true);
assert.equal(reconciliation.includes('پیشنهاد سند اصلاحی — ثبت نشده'), true);
assert.equal(reconciliation.includes('data-avan-reconciliation-card'), true,
  'reconciliation must be a persistent visible card on the reports page');
assert.equal(reconciliation.includes('avan-recon-icon'), true,
  'reconciliation card must expose a visible icon');
assert.equal(reconciliation.includes('[data-report]'), true,
  'reconciliation lifecycle must follow native report tab changes');
assert.equal(reconciliation.includes("getElementById('reportOut')"), false,
  'reconciliation must not depend on the nonexistent legacy reportOut host');
assert.equal(reconciliation.includes('[data-r]'), false,
  'reconciliation must not depend on the obsolete data-r selector');
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
