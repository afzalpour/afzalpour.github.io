import assert from 'node:assert/strict';
import { buildControlTowerFoundation } from '../src/intelligence/control-tower-foundation.js';
import { buildFinancialDigitalTwinScenario } from '../src/intelligence/financial-digital-twin.js';

const tower = buildControlTowerFoundation({
  asOf: '2026-09-10',
  roles: { receivable: 'ar', payable: 'ap' },
  financialAccounts: [
    { id: 'fa-bank', ledger_account_id: 'cash', is_active: true }
  ],
  entries: [
    { id: 'e1', entry_date: '2026-09-01', status: 'posted' },
    { id: 'e2', entry_date: '2026-09-05', status: 'posted' },
    { id: 'e3', entry_date: '2026-09-06', status: 'draft' },
    { id: 'e4', entry_date: '2026-09-20', status: 'posted' }
  ],
  lines: [
    { id: 'cash-1', journal_entry_id: 'e1', account_id: 'cash', debit: '1000.1', credit: '0' },
    { id: 'cash-2', journal_entry_id: 'e2', account_id: 'cash', debit: '0', credit: '100' },
    { id: 'cash-draft', journal_entry_id: 'e3', account_id: 'cash', debit: '999.9', credit: '0' },
    { id: 'cash-future', journal_entry_id: 'e4', account_id: 'cash', debit: '999.9', credit: '0' },

    { id: 'ar-1', journal_entry_id: 'e1', account_id: 'ar', party_id: 'p1', debit: '500.1', credit: '0' },
    { id: 'ar-2', journal_entry_id: 'e2', account_id: 'ar', party_id: 'p1', debit: '0', credit: '100' },
    { id: 'ar-credit-balance', journal_entry_id: 'e2', account_id: 'ar', party_id: 'p2', debit: '0', credit: '50' },
    { id: 'ar-missing-party', journal_entry_id: 'e2', account_id: 'ar', debit: '10', credit: '0' },

    { id: 'ap-1', journal_entry_id: 'e1', account_id: 'ap', party_id: 'p1', debit: '0', credit: '300.2' },
    { id: 'ap-2', journal_entry_id: 'e2', account_id: 'ap', party_id: 'p1', debit: '100.1', credit: '0' },
    { id: 'ap-debit-balance', journal_entry_id: 'e2', account_id: 'ap', party_id: 'p2', debit: '40', credit: '0' }
  ],
  bankStatementLines: [
    { id: 'b1', amount: '100.1' },
    { id: 'b2', amount: '200' },
    { id: 'b3', amount: '300', ignored_at: '2026-09-10T10:00:00Z' }
  ],
  bankMatches: [
    { statement_line_id: 'b2', voided_at: null },
    { statement_line_id: 'b1', voided_at: '2026-09-10T11:00:00Z' }
  ],
  inventoryReconciliations: [
    { id: 'ir1', is_reconciled: false },
    { id: 'ir2', is_reconciled: true }
  ]
});

assert.equal(tower.architecture, 'avan-control-tower-foundation-v1');
assert.equal(tower.metrics.cash.value, '900.1', 'cash must preserve one-Rial precision');
assert.equal(tower.metrics.receivables.value, '400.1', 'AR credit balance of another party must not offset another party receivable');
assert.equal(tower.metrics.payables.value, '200.1', 'AP debit balance of another party must not offset another party payable');
assert.equal(tower.metrics.bank.value, '100.1');
assert.equal(tower.metrics.bank.count, 1, 'voided match is not an active resolution and ignored line is excluded');
assert.equal(tower.metrics.inventory.count, 1);
assert.equal(tower.closeReadiness.status, 'attention');
assert.deepEqual([...tower.closeReadiness.blockers].sort(), [
  'bank_reconciliation_open',
  'inventory_reconciliation_open',
  'receivable_lines_without_party'
].sort());
assert.equal(tower.actions.length, 3);
assert.equal(tower.contracts.aiGeneratedAmounts, false);
assert.equal(tower.contracts.crossPartyNetting, false);
assert.equal(tower.contracts.mutation, 'none');
assert.ok(tower.metrics.cash.evidence.some(ref => ref.type === 'journal_entry' && ref.id === 'e1'));
assert.ok(tower.metrics.receivables.evidence.some(ref => ref.type === 'party' && ref.id === 'p1'));

assert.throws(
  () => buildControlTowerFoundation({ asOf: '2026-09-10', entries: [{ id: 'e', entry_date: '2026-09-01', status: 'posted' }], lines: [{ journal_entry_id: 'e', account_id: 'x', debit: '1.05', credit: '0' }], financialAccounts: [{ id: 'f', ledger_account_id: 'x' }] }),
  /CONTROL_TOWER_INVALID_MONEY/,
  'Control Tower must reject sub-Rial canonical values rather than silently round'
);

const baseline = Object.freeze({
  openingCash: '1000.1',
  revenue: '500.1',
  collections: '200',
  operatingCosts: '300.1',
  payments: '100'
});

const twin = buildFinancialDigitalTwinScenario({
  horizon: { from: '2026-09-11', to: '2026-10-10' },
  baseline,
  assumptions: {
    revenueChangeBps: 1000,
    collectionChangeBps: -5000,
    operatingCostChangeBps: 500,
    paymentChangeBps: 0,
    oneOffCashImpact: '-50.1'
  },
  provenance: {
    openingCash: [{ type: 'control_tower_metric', id: 'cash_position' }],
    revenue: [{ type: 'report', id: 'profit_loss' }]
  }
});

assert.equal(twin.architecture, 'avan-financial-digital-twin-v1');
assert.equal(twin.base.endingCash, '1300.1');
assert.equal(twin.scenario.revenue, '550.1');
assert.equal(twin.scenario.collections, '100');
assert.equal(twin.scenario.operatingCosts, '315.1');
assert.equal(twin.scenario.payments, '100');
assert.equal(twin.scenario.endingCash, '1185');
assert.equal(twin.scenario.deltaEndingCash, '-115.1');
assert.equal(twin.liquidity.worsened, true);
assert.equal(twin.contracts.actualLedgerMutation, false);
assert.equal(twin.contracts.actualScenarioSeparation, true);
assert.ok(twin.precision.disclosures.some(item => item.field === 'revenue'), 'sub-Rial proportional remainder must be explicitly disclosed');
assert.ok(twin.precision.disclosures.some(item => item.field === 'operatingCosts'), 'rounding disclosure must not be silent');
assert.deepEqual(baseline, {
  openingCash: '1000.1', revenue: '500.1', collections: '200', operatingCosts: '300.1', payments: '100'
}, 'scenario engine must not mutate baseline input');
assert.deepEqual(twin.provenance.openingCash, [{ type: 'control_tower_metric', id: 'cash_position' }]);

assert.throws(
  () => buildFinancialDigitalTwinScenario({
    horizon: { from: '2026-09-11', to: '2026-10-10' },
    baseline: { ...baseline, revenue: '1.05' }
  }),
  /DIGITAL_TWIN_INVALID_MONEY:revenue/,
  'Digital Twin baseline must respect exact one-Rial canonical precision'
);

assert.throws(
  () => buildFinancialDigitalTwinScenario({
    horizon: { from: '2026-09-11', to: '2026-10-10' },
    baseline,
    assumptions: { revenueChangeBps: -10001 }
  }),
  /DIGITAL_TWIN_NEGATIVE_SCALE:revenueChangeBps/
);

console.log('intelligent-finance-foundation.spec.mjs: PASS');
