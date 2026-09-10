import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  stripSpreadsheetPreamble,
  prepareCsvTextFromBytes,
  localizeBankText,
  rialLegacyValidationProxyValue
} from '../rc16-live-feedback-hotfix.js';
import { parseCsvText } from '../src/domains/treasury/bank-statement-csv.js';

const bankExport = [
  'گزارش گردش حساب',
  'شماره حساب: ۱۲۳۴۵۶',
  '',
  'تاریخ,شرح,برداشت,واریز,مانده',
  '۱۴۰۵/۰۶/۱۸,خرید,۱۴۱۴,۰,۲۰۰۰۰',
  '۱۴۰۵/۰۶/۱۹,واریز,۰,۵۰۰۰,۲۵۰۰۰'
].join('\r\n');

const cleaned = stripSpreadsheetPreamble(bankExport);
assert.match(cleaned, /^تاریخ,شرح,برداشت,واریز,مانده/,
  'bank CSV preamble rows must be skipped before structural parsing');
const parsed = parseCsvText(cleaned);
assert.deepEqual(parsed.headers, ['تاریخ', 'شرح', 'برداشت', 'واریز', 'مانده']);
assert.equal(parsed.rows.length, 2);

const excelDirective = [
  'sep=;',
  'تاریخ;شرح;برداشت;واریز',
  '۱۴۰۵/۰۶/۱۸;خرید;۱۴۱۴;۰',
  '۱۴۰۵/۰۶/۱۹;واریز;۰;۵۰۰۰'
].join('\r\n');
assert.match(stripSpreadsheetPreamble(excelDirective), /^تاریخ;شرح;برداشت;واریز/,
  'Excel sep= directive must not become the CSV header row');

const utf8 = new TextEncoder().encode(bankExport);
assert.equal(prepareCsvTextFromBytes(utf8.buffer), cleaned,
  'CSV UTF-8 bytes must decode and remove spreadsheet preamble deterministically');

assert.equal(rialLegacyValidationProxyValue('1414'), '14140',
  'odd-Rial exact values need only a temporary legacy-validation proxy, never rounding');
assert.equal(rialLegacyValidationProxyValue('1٬414'), '14140');
assert.equal(rialLegacyValidationProxyValue('1420'), '1420');
assert.equal(rialLegacyValidationProxyValue('1414.5'), null,
  'sub-Rial / decimal Rial input must never be silently coerced');

const localized = localizeBankText('CSV · Match · Importها · Canonical · Tab');
assert.doesNotMatch(localized, /CSV|Match|Import|Canonical|Tab/);
assert.match(localized, /تطبیق/);
assert.match(localized, /استاندارد داخلی/);

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const index = read('index.html');
const sw = read('sw.js');
const hotfix = read('rc16-live-feedback-hotfix.js');

assert.match(index, /src\/ui\/tax\/tax-date-aware\.js/,
  'invoice tax effective-date/status integration must actually be loaded in staging');
assert.match(index, /rc16-live-feedback-hotfix\.js/);
assert.match(hotfix, /windows-1256/,
  'legacy Persian Excel CSV decoding must have a Windows-compatible fallback');
assert.match(hotfix, /انتخاب فایل صورت‌حساب/,
  'native English Choose File control must be replaced by a Persian control');
assert.match(hotfix, /priority:\s*140/,
  'exact-Rial restoration must run after base display restoration and before canonical conversion');
assert.match(hotfix, /showPicker/,
  'invoice tax profile picker must receive a direct user-activation compatibility path');
assert.match(sw, /rc16-live-feedback-hotfix\.js/,
  'PWA cache must ship the live-feedback hotfix offline as well');

console.log('rc16-live-feedback-hotfix.spec.mjs: PASS');
