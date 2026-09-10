import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  taxSurfaceNeedsRefresh,
  operationChoicesForDirection
} from '../rc16-live-feedback-hotfix-v3.js';

assert.equal(taxSurfaceNeedsRefresh({ rowCount: 1, taxEnabled: '', taxFieldCount: 0 }), true,
  'new invoice forms must request one tax refresh before deciding whether tax is enabled');
assert.equal(taxSurfaceNeedsRefresh({ rowCount: 2, taxEnabled: '1', taxFieldCount: 2 }), false,
  'complete invoice tax fields must stay stable and must not be rewritten every lifecycle pass');
assert.equal(taxSurfaceNeedsRefresh({ rowCount: 2, taxEnabled: '1', taxFieldCount: 1 }), true,
  'a newly added invoice row must receive a missing tax field');
assert.equal(taxSurfaceNeedsRefresh({ rowCount: 2, taxEnabled: '0', taxFieldCount: 0 }), false,
  'tax-disabled companies must not loop trying to create invoice tax selectors');
assert.equal(taxSurfaceNeedsRefresh({ title: 'تنظیمات', hasSettingsCard: false }), true);
assert.equal(taxSurfaceNeedsRefresh({ title: 'تنظیمات', hasSettingsCard: true }), false);
assert.equal(taxSurfaceNeedsRefresh({ hasItemForm: true, hasItemTaxField: false }), true,
  'inventory item tax metadata must remain available after replacing the generic tax lifecycle');
assert.equal(taxSurfaceNeedsRefresh({ hasItemForm: true, hasItemTaxField: true }), false);
assert.equal(taxSurfaceNeedsRefresh({ invoiceViewPending: true }), true,
  'invoice tax detail must still receive one controlled refresh');

assert.deepEqual(operationChoicesForDirection('credit').map(item => item.kind), ['receipt', 'transfer']);
assert.deepEqual(operationChoicesForDirection('debit').map(item => item.kind), ['payment', 'transfer']);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const v3 = read('rc16-live-feedback-hotfix-v3.js');
const index = read('index.html');
const sw = read('sw.js');

assert.match(v3, /Lifecycle\.remove\('tax:workspace-v2'\)/,
  'the unstable tax lifecycle owner must be replaced rather than allowed to rewrite native selects continuously');
assert.match(v3, /tax:workspace-v2-stable/);
assert.match(v3, /select\.dataset\.avanNativeTaxPicker = '1'/,
  'stable native tax selects must not be cloned by the previous compatibility layer');
assert.match(v3, /rc14ItemForm/,
  'stable tax lifecycle must preserve inventory item tax fields');
assert.match(v3, /avanTaxDetailAttempted/,
  'invoice tax detail rendering must be attempted once per invoice modal instead of looping');
assert.match(v3, /ستون‌های فایل بانک‌ها لازم نیست یکسان باشند/,
  'bank import guidance must explicitly state that source bank layouts may differ');
assert.match(v3, /avanBankHistoryManaged/,
  'history panel must hide by default without immediately overriding the user toggle');
assert.match(v3, /صورت‌حساب‌های قبلی/,
  'bank import history must remain available as an opt-in compact control');
assert.match(v3, /ثبت رویداد مالی مناسب/,
  'no-candidate reconciliation rows must offer a human-controlled accounting action');
assert.match(v3, /تا فشردن «ثبت قطعی» هیچ سندی ایجاد نمی‌شود/,
  'bank-to-operation flow must preserve the human-controlled accounting contract');
assert.match(v3, /addRequiredPlaceholder\(counter/,
  'bank-prefilled receipt/payment must force the user to choose the counterpart account');
assert.match(index, /rc16-live-feedback-hotfix-v3\.js/);
assert.match(sw, /rc16-live-feedback-hotfix-v3\.js/);

console.log('rc16-live-feedback-v3.spec.mjs: PASS');
