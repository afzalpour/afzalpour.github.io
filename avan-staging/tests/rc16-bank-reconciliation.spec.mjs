import assert from 'node:assert/strict';
import {
  evaluateBankReconciliationCandidate,
  resolveBankTransactionDirection,
  suggestBankReconciliationMatches,
} from '../src/domains/treasury/bank-reconciliation-matcher.js';

const bank = {
  id: 'bank-fa-1',
  workspace_id: 'w1',
  kind: 'bank',
  ledger_account_id: 'ledger-bank-1',
};

const creditLine = {
  id: 'line-1',
  workspace_id: 'w1',
  financial_account_id: 'bank-fa-1',
  booking_date: '2026-09-10',
  direction: 'credit',
  amount: '151.5',
  reference_no: 'TRX- ۱۲۳ / 45',
  description: 'واریز مشتری وفاداران',
};

const receipt = {
  id: 'tx-1',
  workspace_id: 'w1',
  status: 'posted',
  tx_type: 'receipt',
  tx_date: '2026-09-10',
  amount: '151.5',
  to_account_id: 'ledger-bank-1',
  from_account_id: null,
  reference: 'trx12345',
  description: 'دریافت از مشتری وفاداران',
};

assert.equal(resolveBankTransactionDirection(receipt, bank.ledger_account_id), 'credit');

const exact = evaluateBankReconciliationCandidate({ statementLine: creditLine, transaction: receipt, financialAccount: bank });
assert.ok(exact);
assert.equal(exact.score, 100);
assert.deepEqual(exact.reason_codes, [
  'EXACT_AMOUNT',
  'BANK_ACCOUNT_SIDE_MATCH',
  'EXACT_REFERENCE',
  'SAME_DAY',
  'DESCRIPTION_TOKEN_MATCH',
]);
assert.equal(exact.amount_tenth_toman, '1515');

// Cross-company candidates are impossible.
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: creditLine,
  transaction: { ...receipt, workspace_id: 'w2' },
  financialAccount: bank,
}), null);

// Only bank financial accounts can participate.
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: creditLine,
  transaction: receipt,
  financialAccount: { ...bank, kind: 'cash' },
}), null);

// Draft/cancelled/opening-balance records never become candidates.
for (const status of ['draft', 'cancelled']) {
  assert.equal(evaluateBankReconciliationCandidate({
    statementLine: creditLine,
    transaction: { ...receipt, status },
    financialAccount: bank,
  }), null);
}
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: creditLine,
  transaction: { ...receipt, tx_type: 'opening_balance' },
  financialAccount: bank,
}), null);

// Exact one-Rial money is mandatory; no fuzzy amount matching.
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: creditLine,
  transaction: { ...receipt, amount: '151.6' },
  financialAccount: bank,
}), null);
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: { ...creditLine, amount: '151.55' },
  transaction: receipt,
  financialAccount: bank,
}), null);

// Direction must match the actual bank side.
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: { ...creditLine, direction: 'debit' },
  transaction: receipt,
  financialAccount: bank,
}), null);

const transferIn = {
  ...receipt,
  id: 'tx-transfer-in',
  tx_type: 'transfer',
  from_account_id: 'other-ledger',
  to_account_id: 'ledger-bank-1',
};
assert.equal(resolveBankTransactionDirection(transferIn, bank.ledger_account_id), 'credit');

const transferOut = {
  ...transferIn,
  id: 'tx-transfer-out',
  from_account_id: 'ledger-bank-1',
  to_account_id: 'other-ledger',
};
assert.equal(resolveBankTransactionDirection(transferOut, bank.ledger_account_id), 'debit');

const payment = {
  ...receipt,
  id: 'tx-payment',
  tx_type: 'payment',
  from_account_id: 'ledger-bank-1',
  to_account_id: null,
  reference: '',
  tx_date: '2026-09-11',
};
const debitLine = { ...creditLine, direction: 'debit', reference_no: '', description: 'پرداخت هزینه', booking_date: '2026-09-10' };
const paymentCandidate = evaluateBankReconciliationCandidate({ statementLine: debitLine, transaction: payment, financialAccount: bank });
assert.ok(paymentCandidate);
assert.equal(paymentCandidate.score, 77);
assert.ok(paymentCandidate.reason_codes.includes('DATE_WITHIN_1_DAY'));

// Date window is a hard candidate boundary; reference cannot override it.
assert.equal(evaluateBankReconciliationCandidate({
  statementLine: creditLine,
  transaction: { ...receipt, tx_date: '2026-09-20' },
  financialAccount: bank,
  maxDateDistanceDays: 3,
}), null);

// Ranking is deterministic and explainable; never confirms anything.
const suggestions = suggestBankReconciliationMatches({
  statementLine: creditLine,
  financialAccount: bank,
  transactions: [
    { ...receipt, id: 'tx-weak', reference: '', tx_date: '2026-09-11', description: '' },
    receipt,
    { ...receipt, id: 'tx-wrong-amount', amount: '150.0' },
  ],
});
assert.equal(suggestions.length, 2);
assert.equal(suggestions[0].transaction_id, 'tx-1');
assert.ok(!('confirmed' in suggestions[0]));

console.log('RC1.6 bank reconciliation domain invariants: PASS');
