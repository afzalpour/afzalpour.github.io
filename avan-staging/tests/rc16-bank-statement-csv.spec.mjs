import assert from 'node:assert/strict';
import {
  parseCsvText,
  inferBankStatementMapping,
  normalizeBankStatementRows,
  parseBankMoney,
  normalizeBankDate,
  attachStatementFingerprints
} from '../src/domains/treasury/bank-statement-csv.js';

assert.deepEqual(parseBankMoney('۱٬۵۱۵', { sourceUnit: 'rial' }), {
  ok: true, code: null, canonical: '151.5', tenths: '1515'
});
assert.equal(parseBankMoney('151.5', { sourceUnit: 'toman' }).canonical, '151.5');
assert.equal(parseBankMoney('151.55', { sourceUnit: 'toman' }).code, 'SUB_RIAL_VALUE');
assert.equal(parseBankMoney('1515.5', { sourceUnit: 'rial' }).code, 'SUB_RIAL_VALUE');
assert.equal(parseBankMoney('-2500', { sourceUnit: 'rial', allowNegative: true }).canonical, '-250.0');
assert.equal(normalizeBankDate('۱۴۰۵/۰۶/۱۹'), '2026-09-10');
assert.equal(normalizeBankDate('2026/09/10'), '2026-09-10');
assert.equal(normalizeBankDate('2026/13/40'), null);

const text = '\uFEFFتاریخ;شرح;شماره پیگیری;برداشت;واریز;مانده\n۱۴۰۵/۰۶/۱۹;"واریز، مشتری";TRX-۱۲۳;;۱٬۵۱۵;۱۰٬۰۰۰\n۱۴۰۵/۰۶/۲۰;خرید;PAY-1;۵۰۰;;۹٬۵۰۰\n';
const parsed = parseCsvText(text);
assert.equal(parsed.delimiter, ';');
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].values['شرح'], 'واریز، مشتری');
const mapping = inferBankStatementMapping(parsed.headers);
assert.equal(mapping.date, 'تاریخ');
assert.equal(mapping.debit, 'برداشت');
assert.equal(mapping.credit, 'واریز');
assert.equal(mapping.reference, 'شماره پیگیری');

const normalized = normalizeBankStatementRows(parsed, { mapping, sourceUnit: 'rial' });
assert.equal(normalized.errors.length, 0);
assert.equal(normalized.rows.length, 2);
assert.deepEqual(normalized.rows.map(row => [row.direction, row.amount]), [['credit','151.5'],['debit','50.0']]);
assert.equal(normalized.rows[0].booking_date, '2026-09-10');
assert.equal(normalized.rows[0].balance_after, '1000.0');

const combined = parseCsvText('date,amount,direction,description\n2026-09-10,151.5,credit,"receipt, customer"\n');
const combinedMap = inferBankStatementMapping(combined.headers);
const combinedNormalized = normalizeBankStatementRows(combined, { mapping: combinedMap, sourceUnit: 'toman' });
assert.equal(combinedNormalized.errors.length, 0);
assert.equal(combinedNormalized.rows[0].amount, '151.5');
assert.equal(combinedNormalized.rows[0].direction, 'credit');

const bad = parseCsvText('تاریخ,برداشت,واریز\n۱۴۰۵/۰۶/۱۹,100,200\n۱۴۰۵/۰۶/۲۰,1.25,\n');
const badResult = normalizeBankStatementRows(bad, { mapping: inferBankStatementMapping(bad.headers), sourceUnit: 'toman' });
assert.equal(badResult.errors.length, 2);
assert.ok(badResult.errors[0].message.includes('دقیقاً یکی'));
assert.ok(badResult.errors[1].message.includes('کمتر از یک ریال'));

const withFingerprints = await attachStatementFingerprints(normalized.rows);
assert.match(withFingerprints[0].fingerprint, /^[a-f0-9]{64}$/);
assert.equal(withFingerprints[0].fingerprint, (await attachStatementFingerprints(normalized.rows))[0].fingerprint);
assert.notEqual(withFingerprints[0].fingerprint, withFingerprints[1].fingerprint);

assert.throws(() => parseCsvText('a,b\n"broken,b\n'), /CSV_UNCLOSED_QUOTE/);
const tooMany = `date,amount,direction\n${Array.from({ length: 5001 }, (_, i) => `2026-09-10,${i+1},credit`).join('\n')}`;
assert.throws(() => parseCsvText(tooMany), /CSV_ROW_LIMIT_EXCEEDED/);

console.log('RC1.6-B bank statement CSV: PASS');
