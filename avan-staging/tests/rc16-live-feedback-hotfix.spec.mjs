import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  stripSpreadsheetPreamble,
  prepareCsvTextFromBytes,
  prepareCsvImportFromBytes,
  normalizeEscBankExport,
  localizeBankText,
  rialLegacyValidationProxyValue,
  exactRialCanonicalValue
} from '../rc16-live-feedback-hotfix.js';
import { parseCsvText, inferBankStatementMapping, normalizeBankStatementRows } from '../src/domains/treasury/bank-statement-csv.js';

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

const ESC = '\u001b';
const escBankExport = [
  ESC.repeat(20),
  ['ردیف','تاریخ','زمان','عملیات','شرح','واریز (ریال)','برداشت (ریال)','مانده (ریال)','', '', 'یادداشت', '', ''].join(ESC),
  ['1','1405/06/19','17:53:46','طرف بدهکار','انتقال وجه اینترنتی','0','78,000,000','18,225,673','','','','',''].join(ESC),
  ['2','1405/06/19','17:53:02','طرف بستانکار','واریز انتقالی','70,000,000','0','96,225,673','','','','',''].join(ESC),
  ['', '', '', '', 'مجموع','70,000,000','78,000,000','','','','','',''].join(ESC)
].join('\r\n');

const normalizedEsc = normalizeEscBankExport(escBankExport);
assert.ok(normalizedEsc, 'ESC-delimited bank exports must be recognized');
assert.equal(normalizedEsc.sourceUnit, 'rial');
assert.equal(normalizedEsc.rowCount, 2, 'footer totals must not be treated as transactions');
assert.match(normalizedEsc.text, /^تاریخ\tشرح\tواریز\tبرداشت\tمانده/);

const escBytes = new TextEncoder().encode(escBankExport);
const preparedEsc = prepareCsvImportFromBytes(escBytes.buffer);
assert.equal(preparedEsc.sourceUnit, 'rial');
const parsedEsc = parseCsvText(preparedEsc.text);
assert.deepEqual(parsedEsc.headers, ['تاریخ','شرح','واریز','برداشت','مانده']);
assert.equal(parsedEsc.rows.length, 2);
const mapping = inferBankStatementMapping(parsedEsc.headers);
assert.equal(mapping.date, 'تاریخ');
assert.equal(mapping.credit, 'واریز');
assert.equal(mapping.debit, 'برداشت');
assert.equal(mapping.balance, 'مانده');
const normalizedRows = normalizeBankStatementRows(parsedEsc, { mapping, sourceUnit: preparedEsc.sourceUnit });
assert.equal(normalizedRows.errors.length, 0);
assert.equal(normalizedRows.rows.length, 2);
assert.equal(normalizedRows.rows[0].direction, 'debit');
assert.equal(normalizedRows.rows[0].amount, '7800000.0');
assert.equal(normalizedRows.rows[1].direction, 'credit');
assert.equal(normalizedRows.rows[1].amount, '7000000.0');

assert.equal(rialLegacyValidationProxyValue('1414'), '14140',
  'odd-Rial exact values need only a temporary legacy-validation proxy, never rounding');
assert.equal(rialLegacyValidationProxyValue('1٬414'), '14140');
assert.equal(rialLegacyValidationProxyValue('1420'), '1420');
assert.equal(rialLegacyValidationProxyValue('1414.5'), null,
  'sub-Rial / decimal Rial input must never be silently coerced');
assert.equal(exactRialCanonicalValue('1414'), '141.4',
  'one-Rial financial operations must persist exact canonical Toman tenths');
assert.equal(exactRialCanonicalValue('1414.5'), null,
  'sub-Rial financial operations must be rejected');

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
assert.match(hotfix, /normalizeEscBankExport/,
  'bank-specific ESC-delimited exports must be normalized before generic parsing');
assert.match(hotfix, /تشخیص آوان از ستون‌های فایل/,
  'bank preview must explain detected column mapping to the user');
assert.match(hotfix, /انتخاب فایل صورت‌حساب/,
  'native English Choose File control must be replaced by a Persian control');
assert.match(hotfix, /operation\.exact-rial-live-feedback/,
  'receipt/payment/transfer must restore exact one-Rial values before persistence');
assert.match(hotfix, /p_amount:\s*exact/,
  'financial operation RPC payload must receive the exact canonical decimal amount');
assert.doesNotMatch(hotfix, /showPicker/,
  'tax status must use the native select path instead of a brittle programmatic picker');
assert.match(hotfix, /avanNativeTaxPicker/,
  'tax selector must be replaced with a listener-clean native control');
assert.match(sw, /rc16-live-feedback-hotfix\.js/,
  'PWA cache must ship the live-feedback hotfix offline as well');

console.log('rc16-live-feedback-hotfix.spec.mjs: PASS');
