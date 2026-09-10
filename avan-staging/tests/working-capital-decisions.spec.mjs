import assert from 'node:assert/strict';
import { buildWorkingCapitalDecisions } from '../src/intelligence/working-capital-decisions.js';

const snapshot = {
  asOf: '2026-09-11',
  cash: { value: '100.1', evidence: [] },
  metrics: { overdueReceivables: '80.1' },
  receivables: { available: true, parties: [], openItems: [] },
  payables: {
    available: true,
    parties: [{ partyId: 'supplier-1', partyName: 'تأمین‌کننده تست' }],
    openItems: [
      {
        id: 'open-a', partyId: 'supplier-1', remaining: '60.1', dueDate: '2026-09-10',
        journalEntryId: 'j-pay-a', journalNo: 10, invoiceId: 'inv-a', invoiceNo: 100,
        paymentPriority: { tier: 'overdue' },
        evidence: [{ type: 'party', id: 'supplier-1' }, { type: 'journal_entry', id: 'j-pay-a' }]
      },
      {
        id: 'open-b', partyId: 'supplier-1', remaining: '50', dueDate: '2026-09-15',
        journalEntryId: 'j-pay-b', journalNo: 11, invoiceId: 'inv-b', invoiceNo: 101,
        paymentPriority: { tier: 'due_7' },
        evidence: [{ type: 'party', id: 'supplier-1' }, { type: 'journal_entry', id: 'j-pay-b' }]
      }
    ]
  },
  collectionPriorities: [
    {
      partyId: 'customer-1', partyName: 'مشتری تست', total: '100.1', overdue: '80.1', maxDaysPastDue: 95,
      evidence: [{ type: 'party', id: 'customer-1' }, { type: 'journal_entry', id: 'j-ar' }]
    }
  ]
};

const before = JSON.stringify(snapshot);
const decisions = buildWorkingCapitalDecisions(snapshot);

assert.equal(decisions.architecture, 'avan-working-capital-decisions-v1');
assert.equal(decisions.collections.length, 1);
assert.equal(decisions.collections[0].recommendation.action, 'contact_and_commitment_today');
assert.equal(decisions.collections[0].overdueAmount, '80.1', 'one-Rial overdue amount must remain exact');
assert.equal(decisions.collections[0].simulationSeed.collections, '80.1');
assert.equal(decisions.collections[0].simulationSeed.from, '2026-09-11');
assert.equal(decisions.collections[0].simulationSeed.to, '2026-10-11');

assert.equal(decisions.payments.length, 2);
assert.equal(decisions.payments[0].cashBefore, '100.1');
assert.equal(decisions.payments[0].projectedCashAfter, '40');
assert.equal(decisions.payments[0].coveredByCurrentCashAtTurn, true);
assert.equal(decisions.payments[1].cashBefore, '40');
assert.equal(decisions.payments[1].projectedCashAfter, '-10');
assert.equal(decisions.payments[1].cumulativeShortfall, '10');
assert.equal(decisions.payments[1].coveredByCurrentCashAtTurn, false);
assert.equal(decisions.payments[1].recommendation.action, 'simulate_before_commitment');
assert.equal(decisions.payments[1].simulationSeed.payments, '50');

assert.equal(decisions.summary.uncoveredPaymentCount, 1);
assert.equal(decisions.summary.firstLiquidityShortfall, '10');
assert.equal(decisions.contracts.oneRialExact, true);
assert.equal(decisions.contracts.crossPartyNetting, false);
assert.equal(decisions.contracts.aiGeneratedAmounts, false);
assert.equal(decisions.contracts.aiGeneratedRecommendations, false);
assert.equal(decisions.contracts.autonomousMessage, false);
assert.equal(decisions.contracts.autonomousPayment, false);
assert.equal(decisions.contracts.actualLedgerMutation, false);
assert.equal(decisions.contracts.writeOperations, 0);
assert.equal(JSON.stringify(snapshot), before, 'decision engine must not mutate the source snapshot');

console.log('working-capital-decisions.spec.mjs: PASS');
