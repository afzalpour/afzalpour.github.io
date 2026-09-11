import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCounterparty360 } from '../src/intelligence/counterparty-360.js';

const party = {
  id: 'p1', name: 'نمونه مشتری', kind: 'both', entity_type: 'legal', legal_name: 'شرکت نمونه',
  national_id: '101', registration_no: '202', economic_code: '303', tax_id: '',
  phone: '021', email: '', postal_code: '404', province: 'تهران', city: 'تهران',
  address: 'تهران', contact_name: 'مدیر مالی', website: '', is_active: true
};
const roles = { receivable: 'ar', payable: 'ap' };
const accounts = [
  { id: 'ar', code: '1201', name: 'حساب‌های دریافتنی' },
  { id: 'ap', code: '2101', name: 'حساب‌های پرداختنی' }
];
const entries = [
  { id: 'e1', journal_no: 1, entry_date: '2026-05-01', status: 'posted', source_type: 'invoice', source_id: 'i1', description: 'فروش' },
  { id: 'e2', journal_no: 2, entry_date: '2026-06-01', status: 'posted', source_type: 'receipt', source_id: 'r1', description: 'وصول' },
  { id: 'e3', journal_no: 3, entry_date: '2026-07-01', status: 'posted', source_type: 'invoice', source_id: 'i2', description: 'خرید' }
];
const lines = [
  { id: 'l1', journal_entry_id: 'e1', line_no: 1, account_id: 'ar', party_id: 'p1', debit: '100.1', credit: '0', description: 'مطالبه' },
  { id: 'l2', journal_entry_id: 'e2', line_no: 1, account_id: 'ar', party_id: 'p1', debit: '0', credit: '40', description: 'دریافت' },
  { id: 'l3', journal_entry_id: 'e3', line_no: 1, account_id: 'ap', party_id: 'p1', debit: '0', credit: '30.2', description: 'بدهی' }
];
const invoices = [
  { id: 'i1', invoice_no: 10, invoice_type: 'sale', invoice_date: '2026-05-01', due_date: '2026-05-20', party_id: 'p1', status: 'posted', journal_entry_id: 'e1', total_amount: '100.1' },
  { id: 'i2', invoice_no: 20, invoice_type: 'purchase', invoice_date: '2026-07-01', due_date: '2026-07-20', party_id: 'p1', status: 'posted', journal_entry_id: 'e3', total_amount: '30.2' }
];

const snapshot = buildCounterparty360({
  party, roles, accounts, entries, lines, invoices,
  fiscalFrom: '2026-03-21', asOf: '2026-09-12'
});

assert.equal(snapshot.financial.receivable, '60.1');
assert.equal(snapshot.financial.overdueReceivable, '60.1');
assert.equal(snapshot.financial.payable, '30.2');
assert.equal(snapshot.financial.overduePayable, '30.2');
assert.equal(snapshot.financial.oldestDueDate, '2026-05-20');
assert.equal(snapshot.ledger.rows.length, 3);
assert.equal(snapshot.invoices.length, 2);
assert.deepEqual(snapshot.evidence.map(item => item.journalNo), [3, 2, 1]);
assert.ok(snapshot.risks.some(item => item.key === 'overdue_receivable'));
assert.ok(snapshot.risks.some(item => item.key === 'overdue_payable'));
assert.ok(snapshot.risks.some(item => item.key === 'incomplete_profile'));
assert.equal(snapshot.contracts.oneRialExact, true);
assert.equal(snapshot.contracts.readOnly, true);
assert.equal(snapshot.contracts.actualLedgerMutation, false);
assert.equal(snapshot.contracts.arApDisplayedSeparately, true);
assert.equal(snapshot.contracts.crossPartyNetting, false);
assert.equal(snapshot.contracts.evidenceBacked, true);

const ui = fs.readFileSync(new URL('../src/ui/parties/counterparty-360.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../rc17-counterparty-360.css', import.meta.url), 'utf8');
assert.match(ui, /data-counterparty-360/);
assert.match(ui, /نمای ۳۶۰/);
assert.match(ui, /مطالبه باز/);
assert.match(ui, /بدهی باز/);
assert.match(ui, /اقلام باز مطالبات/);
assert.match(ui, /اقلام باز بدهی‌ها/);
assert.match(ui, /آخرین فاکتورها/);
assert.match(ui, /گردش‌های دفتر طرف‌حساب/);
assert.match(ui, /شواهد و اسناد مؤثر/);
assert.match(ui, /تهاتر نمی‌شوند/);
assert.match(ui, /formatCanonicalDecimal/);
assert.match(ui, /installUiLifecycle/);
assert.match(ui, /parties:counterparty-360-actions/);
assert.match(ui, /data-counterparty-360-loading/);
assert.match(ui, /در حال بارگذاری اطلاعات طرف‌حساب/);
assert.match(ui, /localIsoDate/);
assert.doesNotMatch(ui, /new MutationObserver/);
assert.doesNotMatch(ui, /requestAnimationFrame/);
assert.doesNotMatch(ui, /\.insert\(|\.update\(|\.delete\(|service_role/i);

// Live stability contract: visible 360 affordance belongs to the stable action cell,
// while the injected legacy button is only an invisible hit area. This prevents
// visible add/remove flashing even if an upstream page rerender occurs.
assert.match(css, /tr\[data-party-master-row\]>td:last-child::after/);
assert.match(css, /content:'نمای ۳۶۰'/);
assert.match(css, /\.avan-counterparty-360-button\{[^}]*opacity:0!important/);
assert.match(css, /animation:none!important/);
assert.match(css, /transition:none!important/);

console.log('counterparty-360.spec.mjs: PASS');
