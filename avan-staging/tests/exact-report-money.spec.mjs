import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  reportMoneyTenths,
  reportMoneyDecimal,
  reportMoneyCategoryTenths,
  sumReportMoneyTenths,
  EXACT_REPORT_MONEY_CONTRACT
} from '../src/reports/report-money-exact.js';
import { executeReportIntent } from '../src/reports/nl-report-executor.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

assert.equal(reportMoneyTenths('104692.8'), 1046928n);
assert.equal(reportMoneyDecimal(1046928n), '104692.8');
assert.equal(sumReportMoneyTenths(['104692.8', '0.1', '-2.9']), 1046900n);
assert.deepEqual(
  reportMoneyCategoryTenths([
    { category: 'income', amount: '177178123.1' },
    { category: 'expense', amount: '11595500.5' }
  ]),
  { income: 1771781231n, expense: 115955005n }
);
assert.equal(EXACT_REPORT_MONEY_CONTRACT.oneRialExact, true);
assert.throws(() => reportMoneyTenths('1.01'), /REPORT_INVALID_CANONICAL_MONEY/);

const period = { from: '2026-03-21', to: '2026-09-12' };
const baseIntent = { read_only: true, allow_raw_sql: false, period };

const pnlRpc = async name => {
  assert.equal(name, 'report_profit_loss');
  return [
    { category: 'income', amount: '177178123.1' },
    { category: 'expense', amount: '11595500.5' }
  ];
};
const profit = await executeReportIntent({
  intent: { ...baseIntent, intent: 'profit_loss', metric: 'profit' },
  workspaceId: 'w1',
  rpc: pnlRpc
});
assert.equal(profit.value, '165582622.6');
assert.equal(profit.one_rial_exact, true);

const expense = await executeReportIntent({
  intent: { ...baseIntent, intent: 'profit_loss', metric: 'expense' },
  workspaceId: 'w1',
  rpc: pnlRpc
});
assert.equal(expense.value, '11595500.5');

const cash = await executeReportIntent({
  intent: { ...baseIntent, intent: 'cash_balances' },
  workspaceId: 'w1',
  rpc: async name => {
    assert.equal(name, 'report_cash_bank_balances');
    return [{ amount: '104692.8' }, { amount: '0.1' }];
  }
});
assert.equal(cash.value, '104692.9');

const balance = await executeReportIntent({
  intent: { ...baseIntent, intent: 'balance_sheet', metric: 'equity' },
  workspaceId: 'w1',
  rpc: async name => {
    assert.equal(name, 'report_balance_sheet');
    return [
      { category: 'asset', amount: '100.1' },
      { category: 'liability', amount: '30.1' },
      { category: 'equity', amount: '50.0' },
      { category: 'current_profit', amount: '20.0' }
    ];
  }
});
assert.equal(balance.value, '70');

const runtime = read('src/ui/reports/prepared-report-exactness.js');
const view = read('src/ui/reports/nl-report-view.js');
const executor = read('src/reports/nl-report-executor.js');
assert.match(runtime, /report_profit_loss/);
assert.match(runtime, /report_balance_sheet/);
assert.match(runtime, /avanExactReportMoney/);
assert.match(runtime, /oneRialExact:\s*true/);
assert.match(runtime, /workspaceId/);
assert.doesNotMatch(runtime, /\.insert\(|\.update\(|\.delete\(|service_role/i);
assert.match(view, /import '\.\/prepared-report-exactness\.js'/);
assert.match(executor, /reportMoneyDecimal/);
assert.doesNotMatch(executor, /function bi\(|BigInt\(\s*String/);

console.log('exact-report-money.spec.mjs: PASS');
