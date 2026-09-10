import assert from 'node:assert/strict';
import { buildWorkingCapitalFoundation } from '../src/intelligence/working-capital-foundation.js';
import { createWorkingCapitalService } from '../src/application/intelligence/working-capital-service.js';

const wid = '11111111-1111-1111-1111-111111111111';
const roles = { receivable: 'ar', payable: 'ap' };
const parties = [
  { id: 'pa', name: 'مشتری الف' },
  { id: 'pb', name: 'مشتری ب' },
  { id: 'pv', name: 'تأمین‌کننده' }
];
const invoices = [
  { id: 'i1', journal_entry_id: 'e1', invoice_no: 1, invoice_date: '2026-05-01', due_date: '2026-05-15' },
  { id: 'i2', journal_entry_id: 'e3', invoice_no: 2, invoice_date: '2026-09-05', due_date: '2026-10-01' },
  { id: 'p1', journal_entry_id: 'e4', invoice_no: 3, invoice_date: '2026-08-01', due_date: '2026-09-01' }
];
const entries = [
  { id: 'e0', journal_no: 1, entry_date: '2026-01-01', status: 'posted' },
  { id: 'e1', journal_no: 2, entry_date: '2026-05-01', status: 'posted', source_id: 'i1' },
  { id: 'e2', journal_no: 3, entry_date: '2026-06-01', status: 'posted' },
  { id: 'e3', journal_no: 4, entry_date: '2026-09-05', status: 'posted', source_id: 'i2' },
  { id: 'e4', journal_no: 5, entry_date: '2026-08-01', status: 'posted', source_id: 'p1' },
  { id: 'e5', journal_no: 6, entry_date: '2026-09-05', status: 'posted' },
  { id: 'e6', journal_no: 7, entry_date: '2026-02-01', status: 'posted' }
];
const lines = [
  { id: 'l0', journal_entry_id: 'e0', account_id: 'cash-ledger', debit: '5000.1', credit: '0' },
  { id: 'l6', journal_entry_id: 'e6', account_id: 'cash-ledger', debit: '0', credit: '1000' },
  { id: 'l1', journal_entry_id: 'e1', account_id: 'ar', party_id: 'pa', debit: '1000.1', credit: '0' },
  { id: 'l2', journal_entry_id: 'e2', account_id: 'ar', party_id: 'pa', debit: '0', credit: '400' },
  { id: 'l3', journal_entry_id: 'e3', account_id: 'ar', party_id: 'pa', debit: '200.2', credit: '0' },
  { id: 'l3b', journal_entry_id: 'e3', account_id: 'ar', party_id: 'pb', debit: '0', credit: '900' },
  { id: 'l4', journal_entry_id: 'e4', account_id: 'ap', party_id: 'pv', debit: '0', credit: '500.1' },
  { id: 'l5', journal_entry_id: 'e5', account_id: 'ap', party_id: 'pv', debit: '100', credit: '0' }
];
const financialAccounts = [{ id: 'fa1', ledger_account_id: 'cash-ledger', is_active: true }];

const result = buildWorkingCapitalFoundation({
  asOf: '2026-09-11', roles, parties, invoices, entries, lines, financialAccounts
});

assert.equal(result.cash.value, '4000.1', 'cash must preserve one-Rial exactness');
assert.equal(result.metrics.grossReceivables, '800.3');
assert.equal(result.metrics.overdueReceivables, '600.1');
assert.equal(result.metrics.grossPayables, '400.1');
assert.equal(result.metrics.overduePayables, '400.1');
assert.equal(result.metrics.cashLessOverdueAnd30DayPayables, '3600');
assert.equal(result.collectionPriorities[0].partyId, 'pa');
assert.equal(result.collectionPriorities[0].priority.tier, 'critical');
assert.equal(result.collectionPriorities.some(row => row.partyId === 'pb'), false,
  'a credit balance for another party must not offset a different party receivable');
assert.equal(result.paymentCalendar[0].remaining, '400.1');
assert.equal(result.paymentCalendar[0].paymentPriority.tier, 'overdue');
assert.ok(result.evidenceGraph.nodes.some(node => node.type === 'invoice' && node.id === 'i1'));
assert.ok(result.evidenceGraph.edges.length > 0);
assert.equal(result.contracts.crossPartyNetting, false);
assert.equal(result.contracts.actualLedgerMutation, false);
assert.equal(result.contracts.autonomousCollection, false);
assert.equal(result.contracts.autonomousPayment, false);

const calls = [];
const fakeCloud = {
  companyContext: { ensure: async () => ({ active_company: { id: wid, display_name: 'شرکت تست' } }) },
  select: async (table, query) => {
    calls.push({ table, query });
    if (table === 'account_roles') return [{ role_key: 'receivable', account_id: 'ar' }, { role_key: 'payable', account_id: 'ap' }];
    if (table === 'parties') return parties;
    if (table === 'invoices') return invoices;
    if (table === 'journal_entries') return entries;
    if (table === 'journal_lines') return lines;
    if (table === 'financial_accounts') return financialAccounts;
    throw new Error(`unexpected table ${table}`);
  }
};

const service = createWorkingCapitalService({ cloud: fakeCloud });
const loaded = await service.load({ asOf: '2026-09-11' });
assert.equal(loaded.workspace.id, wid);
assert.equal(loaded.snapshot.metrics.grossReceivables, '800.3');
assert.equal(loaded.contracts.writeOperations, 0);
assert.equal(calls.length, 6);
assert.ok(calls.every(call => call.query.includes(`workspace_id=eq.${wid}`)),
  'every Data API source query must carry explicit workspace_id scope');

console.log('working-capital-foundation.spec.mjs: PASS');
