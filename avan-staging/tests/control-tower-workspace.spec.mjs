import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createControlTowerSnapshotService } from '../src/application/intelligence/control-tower-snapshot-service.js';
import { controlTowerPageHtml, controlTowerStatusFa } from '../src/ui/intelligence/control-tower-workspace.js';

const queries = [];
const rows = {
  account_roles: [
    { role_key: 'receivable', account_id: 'ar' },
    { role_key: 'payable', account_id: 'ap' }
  ],
  financial_accounts: [{ id: 'fa1', ledger_account_id: 'cash', kind: 'bank', is_active: true }],
  journal_entries: [{ id: 'e1', journal_no: 1, entry_date: '2026-09-11', status: 'posted' }],
  journal_lines: [
    { journal_entry_id: 'e1', line_no: 1, account_id: 'cash', debit: '100.1', credit: '0' },
    { journal_entry_id: 'e1', line_no: 2, account_id: 'ar', party_id: 'p1', debit: '20.1', credit: '0' },
    { journal_entry_id: 'e1', line_no: 3, account_id: 'ap', party_id: 'p2', debit: '0', credit: '10.1' }
  ],
  bank_statement_lines: [{ id: 'b1', amount: '30.1', booking_date: '2026-09-11', ignored_at: null }],
  bank_reconciliation_matches: [],
  inventory_financial_reconciliation: [{ workspace_id: 'w1', is_reconciled: true, inventory_difference: '0', cogs_difference: '0' }]
};

const cloud = {
  companyContext: {
    async ensure() {
      return {
        selection_required: false,
        active_company: { id: 'w1', display_name: 'شرکت آزمون', role: 'owner' }
      };
    }
  },
  async select(table, query) {
    queries.push({ table, query });
    return rows[table] || [];
  }
};

const service = createControlTowerSnapshotService({ cloud });
const result = await service.load({ asOf: '2026-09-11' });

assert.equal(result.workspace.id, 'w1');
assert.equal(result.snapshot.metrics.cash.value, '100.1');
assert.equal(result.snapshot.metrics.receivables.value, '20.1');
assert.equal(result.snapshot.metrics.payables.value, '10.1');
assert.equal(result.snapshot.metrics.bank.value, '30.1');
assert.equal(result.snapshot.metrics.bank.count, 1);
assert.equal(result.contracts.writeOperations, 0);
assert.equal(result.contracts.rlsRequired, true);
assert.ok(queries.length >= 7);
assert.ok(queries.every(item => item.query.includes('workspace_id=eq.w1')), 'every source query must carry explicit Company scope');
assert.ok(queries.find(item => item.table === 'journal_entries')?.query.includes('entry_date=lte.2026-09-11'));
assert.ok(queries.find(item => item.table === 'bank_statement_lines')?.query.includes('booking_date=lte.2026-09-11'));

assert.equal(controlTowerStatusFa('ready'), 'آماده');
assert.equal(controlTowerStatusFa('attention'), 'نیازمند رسیدگی');

const html = controlTowerPageHtml(result);
assert.match(html, /برج کنترل مالی/);
assert.match(html, /چرا این عدد؟/);
assert.match(html, /data-control-tower-date-form/);
assert.match(html, /type="date"/);
assert.doesNotMatch(html, /موتور سناریو از داده واقعی جداست/);
assert.doesNotMatch(html, /زیرساخت آماده/);
assert.doesNotMatch(html, /تاریخ مبنا:/);
assert.doesNotMatch(html, /عملیات نوشتنی این صفحه: صفر/);
assert.doesNotMatch(html, /Evidence-backed|Ledger|Scenario|Actual/);

const ui = fs.readFileSync(new URL('../src/ui/intelligence/control-tower-workspace.js', import.meta.url), 'utf8');
assert.match(ui, /شواهد حسابداری/);
assert.match(ui, /سند حسابداری شماره/);
assert.match(ui, /طرف‌حساب مؤثر در مانده دریافتنی یا پرداختنی/);
assert.match(ui, /صورتحساب بانکی/);
assert.doesNotMatch(ui, /<code>\$\{esc\(id\)\}<\/code>/,
  'Control Tower evidence must not render raw technical ids');

const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../rc17-control-tower.css', import.meta.url), 'utf8');
assert.match(index, /rc17-control-tower\.css/);
assert.match(index, /src\/ui\/intelligence\/control-tower-workspace\.js/);
assert.match(sw, /src\/application\/intelligence\/control-tower-snapshot-service\.js/);
assert.match(sw, /src\/intelligence\/control-tower-foundation\.js/);
assert.match(sw, /rc17-control-tower\.css/);
assert.match(css, /\.avan-control-tower-grid/);
assert.match(css, /container-type:inline-size/);
assert.match(css, /font-size:clamp\(13px,9cqw,22px\)/);
assert.match(css, /avan-control-tower-evidence-human-row/);
assert.match(css, /@media \(max-width:760px\)/);

console.log('control-tower-workspace.spec.mjs: PASS');
