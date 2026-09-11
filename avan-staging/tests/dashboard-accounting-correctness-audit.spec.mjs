import assert from 'node:assert/strict';

import { buildPartyAging } from '../src/reports/party-aging.js';
import {
  buildFinancialCopilotSnapshot,
  answerBusinessQuestion
} from '../src/ai/business-copilot.js';
import { buildCollectionCloseSnapshot } from '../src/ai/collection-close.js';
import { buildRiskAuditSnapshot } from '../src/ai/risk-audit.js';
import { computeExactDashboardMetrics } from '../src/ui/intelligence/dashboard-accounting-correctness-hotfix.js';

const asOf = '2026-09-11';
const roles = { receivable: 'ar', payable: 'ap' };
const parties = [
  { id: 'p1', name: 'مشتری یک', created_at: '2026-01-01' },
  { id: 'p2', name: 'مشتری دو', created_at: '2026-01-01' }
];
const accounts = [
  { id: 'ar', name: 'دریافتنی', category: 'asset' },
  { id: 'ap', name: 'پرداختنی', category: 'liability' },
  { id: 'expense-1', name: 'هزینه آزمایشی', category: 'expense' }
];
const entries = [
  { id: 'e1', journal_no: 1, entry_date: '2026-05-01', status: 'posted', source_type: 'invoice', source_id: 'inv1' },
  { id: 'e2', journal_no: 2, entry_date: '2026-06-01', status: 'posted', source_type: 'receipt' },
  { id: 'e3', journal_no: 3, entry_date: '2026-05-05', status: 'posted', source_type: 'invoice', source_id: 'inv2' },
  { id: 'e4', journal_no: 4, entry_date: '2026-06-05', status: 'posted', source_type: 'payment' },
  { id: 'e5', journal_no: 5, entry_date: '2026-07-01', status: 'posted', source_type: 'manual' },
  { id: 'draft', journal_no: null, entry_date: '2026-07-02', status: 'draft', source_type: 'manual' }
];
const lines = [
  { id: 'ar1', journal_entry_id: 'e1', account_id: 'ar', party_id: 'p1', debit: '500.1', credit: '0' },
  { id: 'ar2', journal_entry_id: 'e2', account_id: 'ar', party_id: 'p1', debit: '0', credit: '100' },
  { id: 'ar-p2-credit', journal_entry_id: 'e2', account_id: 'ar', party_id: 'p2', debit: '0', credit: '50.1' },
  { id: 'ap1', journal_entry_id: 'e3', account_id: 'ap', party_id: 'p2', debit: '0', credit: '300.2' },
  { id: 'ap2', journal_entry_id: 'e4', account_id: 'ap', party_id: 'p2', debit: '100.1', credit: '0' },
  { id: 'exp', journal_entry_id: 'e5', account_id: 'expense-1', debit: '115.1', credit: '0' },
  { id: 'draft-exp', journal_entry_id: 'draft', account_id: 'expense-1', debit: '999.9', credit: '0' }
];
const invoices = [
  { id: 'inv1', invoice_no: 1, invoice_type: 'sale', invoice_date: '2026-05-01', due_date: '2026-05-10', party_id: 'p1', status: 'posted', journal_entry_id: 'e1', total_amount: '500.1' },
  { id: 'inv2', invoice_no: 2, invoice_type: 'purchase', invoice_date: '2026-05-05', due_date: '2026-05-15', party_id: 'p2', status: 'posted', journal_entry_id: 'e3', total_amount: '300.2' }
];

const aging = buildPartyAging({ roles, parties, entries, lines, invoices, asOf });
assert.equal(aging.contracts.oneRialExact, true);
assert.equal(aging.receivables.total, '400.1', 'one-Rial AR must survive FIFO reduction');
assert.equal(aging.payables.total, '200.1', 'one-Rial AP must survive FIFO reduction');
assert.equal(aging.receivables.parties.length, 1, 'credit balance of another party must not offset p1 receivable');
assert.equal(aging.receivables.parties[0].partyId, 'p1');
assert.equal(aging.receivables.parties[0].openItems[0].dueDate, '2026-05-10', 'invoice journal linkage must provide due date');
assert.equal(aging.receivables.parties[0].openItems[0].remaining, '400.1');
assert.equal(aging.receivables.aging['90_plus'], '400.1');

assert.throws(
  () => buildPartyAging({
    roles,
    parties,
    entries: [{ id: 'bad', entry_date: '2026-01-01', status: 'posted' }],
    lines: [{ journal_entry_id: 'bad', account_id: 'ar', party_id: 'p1', debit: '1.05', credit: '0' }],
    invoices: [],
    asOf
  }),
  /PARTY_AGING_INVALID_MONEY/,
  'sub-Rial aging input must be rejected rather than rounded or zeroed'
);

const exactMetrics = computeExactDashboardMetrics({
  balance: [
    { category: 'asset', amount: '74082141.5' },
    { category: 'liability', amount: '-96000481.1' }
  ],
  profitLoss: [
    { category: 'income', amount: '177178123.1' },
    { category: 'expense', amount: '11595500.5' }
  ],
  cash: [{ amount: '-102329664.8' }]
});
assert.equal(exactMetrics.profit, '165582622.6');
assert.equal(exactMetrics.profitTenths, 1655826226n);
assert.equal(exactMetrics.cash, '-102329664.8');

const copilot = buildFinancialCopilotSnapshot({
  asOf,
  fiscalFrom: '2026-03-21',
  assets: exactMetrics.assets,
  liabilities: exactMetrics.liabilities,
  profit: exactMetrics.profit,
  cash: exactMetrics.cash,
  aging,
  accounts,
  entries,
  lines,
  documents: [],
  invoices,
  integrity: { unbalanced_journals: 0 }
});
assert.equal(copilot.contracts.oneRialExact, true);
assert.equal(copilot.metrics.profit, '165582622.6');
assert.equal(copilot.metrics.receivables, '400.1');
assert.equal(copilot.metrics.payables, '200.1');
assert.equal(copilot.topExpenseAccounts[0].amount, '115.1', 'top expense must preserve one Rial');
assert.equal(answerBusinessQuestion({ query: 'سود من چقدر است؟', snapshot: copilot }).evidenceAmount, '165582622.6');

const collection = buildCollectionCloseSnapshot({
  asOf,
  aging,
  entries,
  invoices,
  documents: [],
  periods: [],
  integrity: { unbalanced_journals: 0, orphan_lines: 0 },
  invoiceIntegrity: { posted_without_journal: 0, total_mismatch: 0 }
});
assert.equal(collection.contracts.oneRialExact, true);
assert.equal(collection.collection.total, '400.1');
assert.equal(collection.collection.overdue, '400.1');
assert.equal(collection.collection.top3CashOpportunity, '400.1');
assert.equal(collection.collection.priorities[0].total, '400.1');

const tx = Array.from({ length: 8 }, (_, index) => ({
  id: `tx${index}`,
  tx_date: `2026-08-${String(index + 1).padStart(2, '0')}`,
  tx_type: 'receipt',
  party_id: 'p1',
  amount: index === 7 ? '400.4' : '100.1',
  from_account_id: null,
  to_account_id: 'bank',
  counterpart_account_id: 'ar'
}));
const risk = buildRiskAuditSnapshot({
  asOf,
  cash: '50.1',
  aging,
  parties,
  invoices: [
    ...invoices,
    { ...invoices[0], id: 'inv1-copy', invoice_no: 3 }
  ],
  transactions: tx,
  documents: [],
  integrity: { unbalanced_journals: 0, orphan_lines: 0 },
  invoiceIntegrity: { posted_without_journal: 0, total_mismatch: 0 }
});
assert.equal(risk.contracts.oneRialExact, true);
assert.equal(risk.stats.overdueReceivables, '400.1');
assert.ok(risk.factors.some(item => item.id === 'aged_receivables' && item.value === '400.1'));
assert.ok(risk.auditFindings.some(item => item.id.startsWith('duplicate_invoice_') && item.value === '500.1'));
assert.ok(risk.auditFindings.some(item => item.id.startsWith('unusual_transaction_') && item.value === '400.4'));

assert.throws(
  () => buildRiskAuditSnapshot({ asOf, cash: '1.05', aging, parties, invoices: [], transactions: [] }),
  /RISK_AUDIT_INVALID_MONEY:cash/
);

console.log('dashboard-accounting-correctness-audit.spec.mjs: PASS');
