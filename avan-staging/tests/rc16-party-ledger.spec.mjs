import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPartyLedger, partyPositionLabel } from '../src/reports/party-ledger.js';

const roles = { receivable: 'ar', payable: 'ap' };
const accounts = [
  { id: 'ar', code: '1201', name: 'حساب‌های دریافتنی' },
  { id: 'ap', code: '2101', name: 'حساب‌های پرداختنی' },
  { id: 'bank', code: '1101', name: 'بانک' }
];
const entries = [
  { id: 'e0', journal_no: 1, entry_date: '2026-03-20', status: 'posted', source_type: 'sale_invoice', description: 'مانده قبل از بازه' },
  { id: 'e1', journal_no: 2, entry_date: '2026-04-01', status: 'posted', source_type: 'receipt', description: 'دریافت' },
  { id: 'e2', journal_no: 3, entry_date: '2026-04-02', status: 'posted', source_type: 'purchase_invoice', description: 'خرید' },
  { id: 'e3', journal_no: 4, entry_date: '2026-04-03', status: 'posted', source_type: 'payment', description: 'پرداخت' },
  { id: 'e4', journal_no: 5, entry_date: '2026-04-04', status: 'posted', source_type: 'receipt', description: 'نقدی مستقیم' },
  { id: 'e5', journal_no: 6, entry_date: '2026-04-05', status: 'draft', source_type: 'sale_invoice', description: 'پیش‌نویس' }
];
const lines = [
  { journal_entry_id: 'e0', line_no: 1, account_id: 'ar', party_id: 'p1', debit: '1000.1', credit: '0' },
  { journal_entry_id: 'e1', line_no: 1, account_id: 'ar', party_id: 'p1', debit: '0', credit: '400' },
  { journal_entry_id: 'e2', line_no: 1, account_id: 'ap', party_id: 'p1', debit: '0', credit: '300.2' },
  { journal_entry_id: 'e3', line_no: 1, account_id: 'ap', party_id: 'p1', debit: '100.1', credit: '0' },
  { journal_entry_id: 'e4', line_no: 1, account_id: 'bank', party_id: 'p1', debit: '99.9', credit: '0' },
  { journal_entry_id: 'e5', line_no: 1, account_id: 'ar', party_id: 'p1', debit: '999', credit: '0' },
  { journal_entry_id: 'e2', line_no: 2, account_id: 'ap', party_id: 'p2', debit: '0', credit: '500' }
];

const ledger = buildPartyLedger({
  partyId: 'p1', roles, entries, lines, accounts,
  from: '2026-03-21', to: '2026-04-30'
});

assert.equal(ledger.opening.receivable, '1000.1');
assert.equal(ledger.opening.payable, '0');
assert.equal(ledger.opening.net, '1000.1');
assert.equal(ledger.closing.receivable, '600.1');
assert.equal(ledger.closing.payable, '200.1');
assert.equal(ledger.closing.net, '400');
assert.equal(ledger.closing.position, 'طلب ما از طرف‌حساب');
assert.equal(ledger.period.debit, '100.1');
assert.equal(ledger.period.credit, '700.2');
assert.equal(ledger.rows.length, 3, 'only posted AR/AP lines for the selected party belong in the ledger');
assert.deepEqual(ledger.rows.map(row => row.runningNet), ['600.1', '299.9', '400']);
assert.equal(ledger.rows[1].side, 'payable');
assert.equal(partyPositionLabel(-1n), 'بدهی ما به طرف‌حساب');
assert.equal(partyPositionLabel(0n), 'تسویه');

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/reports/party-ledger-workspace.js');
const index = read('index.html');
const sw = read('sw.js');

assert.match(ui, /صورتحساب مالی/);
assert.match(ui, /گردش و مانده طرف‌حساب/);
assert.match(ui, /party_id=eq\.\$\{partyId\}/, 'data retrieval must use the exact party id');
assert.match(ui, /مطالبات و بدهی را به‌صورت خودکار با یکدیگر تهاتر نمی‌کند/);
assert.match(ui, /data-party-ledger-open/);
assert.match(ui, /data-party-ledger-launcher/);
assert.match(index, /src\/ui\/reports\/party-ledger-workspace\.js/);
assert.match(sw, /src\/reports\/party-ledger\.js/);
assert.match(sw, /src\/ui\/reports\/party-ledger-workspace\.js/);
assert.match(sw, /avan-staging-rc1-v99-party-ledger/);

console.log('rc16-party-ledger.spec.mjs: PASS');
