import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWhyNumberEvidence } from '../src/reports/why-number.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const live = read('src/ui/intelligence/dashboard-live-contract-v3.js');
const index = read('index.html');
const sw = read('sw.js');

// Live DOM contract: units are forced into the exact final headers after legacy polish.
for (const label of ['مبلغ', 'مانده باز', 'مانده', 'سررسیدگذشته']) {
  assert.match(live, new RegExp(label));
}
assert.match(live, /requestAnimationFrame/);
assert.match(live, /دستیار هوشمند وصول\|Smart Collection Agent/);
assert.match(live, /مطالبات و بدهی تجاری/);
assert.match(live, /\$\{base\} \(\$\{unit\}\)/);

// Business Evidence v3 owns the click before the older document-level handler.
assert.match(live, /window\.addEventListener\('click', interceptEvidenceClick, true\)/);
assert.match(live, /stopImmediatePropagation\(\)/);
assert.match(live, /originJournalGuaranteed/);
assert.match(live, /workspace_id=eq\.\$\{workspaceId\}/);
assert.doesNotMatch(live, /\.insert\(|\.update\(|\.delete\(|localStorage/);

// Real-shape regression: purchase invoice journal 54 equivalent must survive FIFO and appear as overdue evidence.
const roles = { payable: 'ap' };
const parties = [{ id: 'vendor', name: 'فروشنده' }];
const accounts = [{ id: 'ap', code: '2101', name: 'پرداختنی تجاری', category: 'liability' }];
const entries = [
  { id: 'old', journal_no: 49, entry_date: '2026-09-10', status: 'posted', source_type: 'purchase_invoice', source_id: 'old-inv' },
  { id: 'pay', journal_no: 52, entry_date: '2026-09-10', status: 'posted', source_type: 'payment' },
  { id: 'j54', journal_no: 54, entry_date: '2026-09-10', status: 'posted', source_type: 'purchase_invoice', source_id: 'inv54' }
];
const lines = [
  { id: 'l-old', journal_entry_id: 'old', account_id: 'ap', party_id: 'vendor', debit: '0', credit: '1000000' },
  { id: 'l-pay', journal_entry_id: 'pay', account_id: 'ap', party_id: 'vendor', debit: '900000', credit: '0' },
  { id: 'l54', journal_entry_id: 'j54', account_id: 'ap', party_id: 'vendor', debit: '0', credit: '104692.8' }
];
const invoices = [
  { id: 'old-inv', invoice_no: 6, invoice_type: 'purchase', invoice_date: '2026-09-10', due_date: '2026-09-10', party_id: 'vendor', status: 'posted', journal_entry_id: 'old', total_amount: '1000000' },
  { id: 'inv54', invoice_no: 7, invoice_type: 'purchase', invoice_date: '2026-09-10', due_date: null, party_id: 'vendor', status: 'posted', journal_entry_id: 'j54', total_amount: '104692.8' }
];
const evidence = buildWhyNumberEvidence({
  metric: 'overdue_payables',
  roles,
  parties,
  accounts,
  entries,
  lines,
  invoices,
  from: '2026-03-21',
  to: '2026-09-11'
});
assert.equal(evidence.calculatedAmount, '204692.8');
assert.ok(evidence.journals.some(entry => entry.journal_no === 54), 'journal 54 origin must be present in overdue payable evidence');

// Wiring and PWA freshness contract.
assert.match(index, /dashboard-live-contract-v3\.js/);
assert.match(sw, /cache:'reload'/);
assert.match(sw, /addAll\(freshAssets\)/);
assert.match(sw, /dashboard-live-contract-v3\.js/);

console.log('dashboard-live-contract-v3.spec.mjs: PASS');
