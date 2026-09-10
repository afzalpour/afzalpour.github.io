import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  preferredStandardTaxProfileValue,
  invoiceRowIsUsed
} from '../src/ui/tax/invoice-item-optional.js';

const option = (value, treatment) => ({ value, dataset: { taxTreatment: treatment } });
assert.equal(
  preferredStandardTaxProfileValue([
    option('', ''),
    option('exempt-id', 'exempt'),
    option('standard-id', 'standard'),
    option('zero-id', 'zero')
  ]),
  'standard-id',
  'a tax-enabled invoice line without a registered item should default to a standard profile when available'
);
assert.equal(preferredStandardTaxProfileValue([option('', ''), option('exempt-id', 'exempt')]), '');

const makeRow = values => ({
  querySelector(selector) {
    if (selector === '[name="account"]') return { value: values.account || '' };
    if (selector === '[name="description"]') return { value: values.description || '' };
    if (selector === '[name="unit_price"]') return { value: values.unitPrice || '' };
    return null;
  }
});
assert.equal(invoiceRowIsUsed(makeRow({})), false);
assert.equal(invoiceRowIsUsed(makeRow({ account: 'income-id' })), true);
assert.equal(invoiceRowIsUsed(makeRow({ description: 'خدمت مشاوره' })), true);
assert.equal(invoiceRowIsUsed(makeRow({ unitPrice: '151.5' })), true);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const source = read('src/ui/tax/invoice-item-optional.js');
const taxWorkspace = read('src/ui/tax/tax-workspace-v2.js');
const inventoryUi = read('rc14-invoice-inventory-ui.js');
const backend = read('APPLIED_RC1_5_B_VAT_INVOICE_ENGINE.sql');
const index = read('index.html');
const sw = read('sw.js');

assert.match(inventoryUi, /بدون اتصال به کالا/,
  'invoice inventory UI must continue to expose an explicit no-item choice');
assert.match(source, /taxSelect\.removeAttribute\('required'\)/,
  'the guard must remove browser-native required from per-row tax profile selects');
assert.match(source, /invoiceRowIsUsed\(row\) && !taxSelect\.value/,
  'default tax profile selection must apply only to an invoice row that is actually used');
assert.match(source, /taxTreatment === 'standard'/,
  'the default must be a standard VAT profile, not an arbitrary exempt/zero profile');
assert.match(source, /انتخاب کالا\/خدمت ثبت‌شده اختیاری است/,
  'the invoice must explicitly tell the user that registered item selection is optional');
assert.match(taxWorkspace, /tax_profile_id:/,
  'the existing tax operation boundary must still send a tax profile independently of item_id');
assert.match(backend, /if v_profile_id is null and v_line\.item_id is not null then/,
  'backend must keep item_id as a fallback for tax profile, not as a mandatory invoice-line field');
assert.match(backend, /if v_profile_id is null then raise exception 'TAX_PROFILE_REQUIRED'/,
  'backend tax correctness must remain enforced even after native browser required is removed');
assert.match(index, /src\/ui\/tax\/invoice-item-optional\.js/,
  'the guard must be loaded in the active staging runtime');
assert.match(sw, /src\/ui\/tax\/invoice-item-optional\.js/,
  'the guard must be precached for PWA use');
assert.match(sw, /avan-staging-rc1-v91-invoice-item-optional/,
  'the PWA cache must be bumped for the runtime fix');

console.log('invoice-item-optional: PASS');
