import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildContinuousCloseAuditFoundation } from '../src/intelligence/continuous-close-audit-foundation.js';
import { createContinuousCloseAuditService } from '../src/application/intelligence/continuous-close-audit-service.js';
import { buildRiskAuditSnapshot } from '../src/ai/risk-audit.js';

const tower = Object.freeze({
  architecture: 'avan-control-tower-foundation-v1',
  metrics: Object.freeze({
    cash: Object.freeze({ id: 'cash_position', value: '1000.1', evidence: [] }),
    bank: Object.freeze({ id: 'unresolved_bank_reconciliation', count: 1, evidence: [{ type: 'bank_statement_line', id: 'b1' }] }),
    inventory: Object.freeze({ id: 'inventory_control_risks', count: 0, evidence: [] })
  }),
  closeReadiness: Object.freeze({ status: 'attention', blockers: Object.freeze(['bank_reconciliation_open']) }),
  actions: Object.freeze([]),
  contracts: Object.freeze({ deterministic: true, moneyPrecision: '0.1-toman-one-rial', mutation: 'none' })
});

const entries = [
  { id: 'e1', journal_no: 1, entry_date: '2026-09-01', status: 'posted', source_type: 'manual' },
  { id: 'e2', journal_no: 2, entry_date: '2026-09-01', status: 'posted', source_type: 'manual' },
  { id: 'e3', journal_no: null, entry_date: '2026-09-02', status: 'draft', source_type: 'manual' }
];
const lines = [
  { id: 'l1', journal_entry_id: 'e1', line_no: 1, account_id: 'cash', debit: '100.1', credit: '0' },
  { id: 'l2', journal_entry_id: 'e1', line_no: 2, account_id: 'income', debit: '0', credit: '100.1' },
  { id: 'l3', journal_entry_id: 'e2', line_no: 1, account_id: 'cash', debit: '100.1', credit: '0' },
  { id: 'l4', journal_entry_id: 'e2', line_no: 2, account_id: 'income', debit: '0', credit: '100.1' },
  { id: 'l5', journal_entry_id: 'e3', line_no: 1, account_id: 'cash', debit: '1', credit: '0' },
  { id: 'l6', journal_entry_id: 'e3', line_no: 2, account_id: 'income', debit: '0', credit: '1' }
];
const invoices = [
  { id: 'i1', invoice_no: 1, invoice_type: 'sale', invoice_date: '2026-09-03', party_id: 'p1', total_amount: '50.1', status: 'posted' },
  { id: 'i2', invoice_no: 2, invoice_type: 'sale', invoice_date: '2026-09-03', party_id: 'p1', total_amount: '50.1', status: 'posted' }
];
const documents = [
  { id: 'd1', status: 'reviewed', file_hash: 'same-hash', linked_journal_entry_id: null },
  { id: 'd2', status: 'reviewed', file_hash: 'same-hash', linked_journal_entry_id: 'e1' }
];
const transactions = Array.from({ length: 8 }, (_, index) => ({
  id: `t${index + 1}`,
  tx_date: `2026-09-${String(index + 1).padStart(2, '0')}`,
  tx_type: 'receipt',
  party_id: 'p1',
  amount: index === 7 ? '400.4' : '100.1',
  from_account_id: 'bank'
}));

const snapshot = buildContinuousCloseAuditFoundation({
  asOf: '2026-09-10',
  controlTower: tower,
  entries,
  lines,
  invoices,
  transactions,
  documents,
  parties: [{ id: 'p1', name: 'مشتری', created_at: '2026-01-01' }],
  periods: [],
  integrity: { unbalanced_journals: 0, orphan_lines: 0 },
  invoiceIntegrity: { posted_without_journal: 0, total_mismatch: 0 }
});

assert.equal(snapshot.architecture, 'avan-continuous-close-audit-foundation-v1');
assert.equal(snapshot.close.status, 'attention');
assert.equal(snapshot.close.methodology, 'deterministic-controls-no-arbitrary-score');
assert.equal(snapshot.contracts.noArbitraryScore, true);
assert.equal(snapshot.contracts.oneRialExact, true);
assert.equal(snapshot.contracts.actualLedgerMutation, false);
assert.equal(snapshot.contracts.writeOperations, 0);
assert.ok(snapshot.close.controls.some(item => item.id === 'bank_reconciliation_open'));
assert.ok(snapshot.close.controls.some(item => item.id === 'draft_journals'));
assert.ok(snapshot.close.controls.some(item => item.id === 'reviewed_unlinked'));
assert.ok(snapshot.audit.exceptions.some(item => item.id.startsWith('audit_duplicate_journal_')));
assert.ok(snapshot.audit.exceptions.some(item => item.id === 'audit_duplicate_document_0'));
assert.ok(snapshot.audit.exceptions.some(item => item.id === 'audit_duplicate_invoice_0'));
const duplicateJournal = snapshot.audit.exceptions.find(item => item.id.startsWith('audit_duplicate_journal_'));
assert.deepEqual(duplicateJournal.evidence.map(ref => ref.id), ['e1', 'e2']);
assert.ok(snapshot.audit.exceptions.every((item, index, rows) => index === 0 || ({ critical: 1, high: 2, medium: 3, low: 4 }[rows[index - 1].severity] <= { critical: 1, high: 2, medium: 3, low: 4 }[item.severity])), 'exceptions must be deterministically severity ordered');

assert.throws(() => buildContinuousCloseAuditFoundation({
  asOf: '2026-09-10', controlTower: tower,
  entries: [{ id: 'e', entry_date: '2026-09-01', status: 'posted' }],
  lines: [
    { journal_entry_id: 'e', account_id: 'a', debit: '1.05', credit: '0' },
    { journal_entry_id: 'e', account_id: 'b', debit: '0', credit: '1.05' }
  ]
}), /CONTINUOUS_CLOSE_AUDIT_INVALID_MONEY/, 'sub-Rial canonical values must be rejected, never rounded');

const risk = buildRiskAuditSnapshot({
  asOf: '2026-09-10',
  documents,
  invoices,
  transactions,
  integrity: { unbalanced_journals: 1, orphan_lines: 0 },
  invoiceIntegrity: { posted_without_journal: 0, total_mismatch: 0 }
});
const documentDuplicate = risk.auditFindings.find(item => item.id === 'duplicate_document_0');
assert.equal(documentDuplicate.evidence.length, 2);
assert.equal(documentDuplicate.evidence[0].type, 'document');
const unusual = risk.auditFindings.find(item => item.id === 'unusual_transaction_0');
assert.equal(unusual?.evidence?.[0]?.type, 'financial_transaction');

const selectCalls = [];
const rpcCalls = [];
const cloud = {
  companyContext: { ensure: async () => ({ active_company: { id: 'w1', name: 'شرکت تست' } }) },
  select: async (table, query) => { selectCalls.push({ table, query }); return []; },
  rpc: async (name, args) => { rpcCalls.push({ name, args }); return {}; },
  insert: async () => { throw new Error('WRITE_NOT_ALLOWED'); },
  update: async () => { throw new Error('WRITE_NOT_ALLOWED'); },
  delete: async () => { throw new Error('WRITE_NOT_ALLOWED'); }
};
const createTowerService = () => ({
  activeWorkspace: async () => Object.freeze({ id: 'w1', name: 'شرکت تست', role: 'owner' }),
  load: async () => Object.freeze({ workspace: { id: 'w1' }, snapshot: tower })
});
const service = createContinuousCloseAuditService({
  cloud,
  createTowerService,
  buildSnapshot: args => Object.freeze({ architecture: 'test', asOf: args.asOf, contracts: { writeOperations: 0 } })
});
const serviceResult = await service.load({ asOf: '2026-09-10' });
assert.equal(serviceResult.contracts.explicitWorkspaceFilter, true);
assert.equal(serviceResult.contracts.writeOperations, 0);
assert.ok(selectCalls.length >= 7);
assert.ok(selectCalls.every(call => call.query.includes('workspace_id=eq.w1')), 'every table read must explicitly scope workspace_id');
assert.deepEqual(rpcCalls.map(call => call.name).sort(), ['avan_core_integrity', 'invoice_integrity'].sort());
assert.ok(rpcCalls.every(call => call.args.wid === 'w1'));

const uiSource = fs.readFileSync(new URL('../src/ui/intelligence/continuous-close-audit-workspace.js', import.meta.url), 'utf8');
assert.ok(uiSource.includes('بستن و حسابرسی پیوسته'));
assert.ok(uiSource.includes('فهرست موارد نیازمند بررسی'));
assert.ok(uiSource.includes('workspace_id=eq.${wid}'), 'evidence drill-down reads must remain workspace scoped');
assert.ok(!uiSource.includes('<code>${'), 'raw provenance IDs must never be rendered as code');
assert.ok(uiSource.includes('تصمیم درباره اصلاح ثبت یا بستن دوره با کاربر و حسابدار است'));

console.log('continuous-close-audit.spec.mjs: PASS');
