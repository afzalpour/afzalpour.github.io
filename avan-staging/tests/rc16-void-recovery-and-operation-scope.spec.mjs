import assert from 'node:assert/strict';
import fs from 'node:fs';
import { excludeVoidedCandidatePairs } from '../src/application/treasury/bank-reconciliation-service.js';
import {
  counterpartScopeForOperation,
  counterpartGuidanceForOperation
} from '../rc16-live-feedback-hotfix-v4.js';

const candidates = [
  { transaction_id: 'tx-old', score: 100 },
  { transaction_id: 'tx-new', score: 90 }
];
const matches = [
  {
    statement_line_id: 'line-1',
    financial_transaction_id: 'tx-old',
    voided_at: '2026-09-10T12:00:00Z'
  },
  {
    statement_line_id: 'line-2',
    financial_transaction_id: 'tx-new',
    voided_at: '2026-09-10T12:00:00Z'
  }
];

assert.deepEqual(
  excludeVoidedCandidatePairs(candidates, matches, 'line-1').map(row => row.transaction_id),
  ['tx-new'],
  'a transaction explicitly voided for the same bank line must not immediately return as a candidate'
);
assert.deepEqual(
  excludeVoidedCandidatePairs(candidates, matches, 'line-3').map(row => row.transaction_id),
  ['tx-old', 'tx-new'],
  'void history for other statement lines must not suppress valid candidates'
);

assert.equal(counterpartScopeForOperation('receipt'), 'all-postable');
assert.equal(counterpartScopeForOperation('payment'), 'all-postable');
assert.equal(counterpartScopeForOperation('transfer'), 'cash-bank-only');
assert.match(counterpartGuidanceForOperation('receipt', 'credit'), /مشتری\/دریافتنی|درآمد/);
assert.match(counterpartGuidanceForOperation('payment', 'debit'), /فروشنده\/پرداختنی|هزینه/);
assert.match(counterpartGuidanceForOperation('transfer', 'credit'), /فقط از بانک‌ها و صندوق‌ها/);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const app = read('app.js');
const service = read('src/application/treasury/bank-reconciliation-service.js');
const v4 = read('rc16-live-feedback-hotfix-v4.js');
const index = read('index.html');
const sw = read('sw.js');

assert.match(app, /kind==='receipt'[\s\S]*?accountOptions\([\s\S]*?a=>a\.is_active&&a\.is_postable/,
  'receipt counterpart must use all active postable accounts');
assert.match(app, /kind==='payment'[\s\S]*?accountOptions\([\s\S]*?a=>a\.is_active&&a\.is_postable/,
  'payment counterpart must use all active postable accounts');
assert.ok((app.match(/a=>finIds\.has\(a\.id\)/g) || []).length >= 2,
  'transfer source/destination must remain restricted to financial bank/cash accounts');
assert.match(service, /voided_at=not\.is\.null/,
  'candidate service must query rejected void history');
assert.match(v4, /حساب مقابل \(همه حساب‌های قابل ثبت\)/);
assert.match(v4, /حساب مبدأ نقدی \(بانک\/صندوق\)/);
assert.match(index, /rc16-live-feedback-hotfix-v4\.js/);
assert.match(sw, /rc16-live-feedback-hotfix-v4\.js/);
assert.match(sw, /avan-staging-rc1-v98-void-recovery/);

console.log('rc16-void-recovery-and-operation-scope.spec.mjs: PASS');
