import assert from 'node:assert/strict';
import fs from 'node:fs';
import { partyLedgerPositionTone } from '../src/ui/reports/party-ledger-workspace.js';

assert.equal(partyLedgerPositionTone('-0.1'), 'party-ledger-debtor');
assert.equal(partyLedgerPositionTone('25'), 'party-ledger-creditor');
assert.equal(partyLedgerPositionTone('0'), 'party-ledger-settled');

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/reports/party-ledger-workspace.js');
const css = read('rc16-party-ledger-live-polish.css');
const index = read('index.html');
const sw = read('sw.js');

assert.match(ui, /data-party-ledger-range-form/,
  'the Party Ledger itself must own a date-range form');
assert.match(ui, /jalalizeDateInputs\(card\)/,
  'the Reports launcher must also use the shared Jalali date runtime');
assert.match(ui, /<input type="date" name="from"/);
assert.match(ui, /<input type="date" name="to"/);
assert.match(ui, /party-ledger-debtor/);
assert.match(ui, /party-ledger-creditor/);
assert.match(ui, /moneyBare\(row\.debit\)/,
  'detail debit amounts must render without repeating the money unit');
assert.match(ui, /moneyBare\(row\.credit\)/,
  'detail credit amounts must render without repeating the money unit');
assert.match(ui, /moneyBare\(row\.runningNet\)/,
  'detail running balance must render without repeating the money unit');
assert.match(ui, /data-party-ledger-print/);
assert.match(ui, /چاپ \/ ذخیره PDF/);
assert.match(ui, /AvanPrintExport\?\.printElement/,
  'Party Ledger printing must reuse the standard Avan print pipeline');

assert.match(css, /width:min\(1180px,98vw\)/,
  'desktop Party Ledger output must be materially wider than the default modal');
assert.match(css, /party-ledger-creditor strong[\s\S]*?#2457a6/,
  'creditor statement must be blue');
assert.match(css, /party-ledger-debtor strong[\s\S]*?var\(--bad\)/,
  'debtor statement must be red');
assert.match(css, /party-ledger-kpis > \.card[\s\S]*?overflow:hidden/,
  'KPI cards must contain long labels and money values');
assert.match(css, /overflow-wrap:anywhere/);

assert.match(index, /rc16-party-ledger-live-polish\.css/);
assert.match(sw, /rc16-party-ledger-live-polish\.css/);
assert.match(sw, /avan-staging-rc1-v100-party-ledger-live-polish/);

console.log('rc16-party-ledger-live-polish.spec.mjs: PASS');
