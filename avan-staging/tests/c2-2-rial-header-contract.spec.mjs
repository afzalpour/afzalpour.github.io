import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canonicalTextForDisplay,
  displayTextFromCanonical
} from '../src/ui/money/currency-contract.js';

assert.equal(canonicalTextForDisplay('۱۱۰٬۰۶۰', 'rial'), '11006');
assert.equal(canonicalTextForDisplay('110,060', 'rial'), '11006');
assert.equal(canonicalTextForDisplay('۱۱۰٬۰۶۱', 'rial'), null, 'Rial input must be divisible by 10');
assert.equal(canonicalTextForDisplay('۱۱٬۰۰۶', 'toman'), '11006');
assert.equal(displayTextFromCanonical('۱۱٬۰۰۶', 'rial'), '110060');
assert.notEqual(displayTextFromCanonical('۱۱٬۰۰۶', 'rial'), '1100600', 'display conversion must happen exactly once');

const polish = fs.readFileSync(new URL('../rc13-final-polish.js', import.meta.url), 'utf8');
assert.match(polish, /function resetCorruptedMoneyHeader/);
assert.match(polish, /replaceChildren\(document\.createTextNode\(base\)\)/);
assert.match(polish, /characterData:true/);
assert.match(polish, /totalTokens>1/);

const polluted = 'مبلغ (ریال) (ریال) (ریال) (ریال)';
const base = polluted.replace(/(?:\s*\((?:تومان|ریال)\))+$/, '').trim();
assert.equal(base, 'مبلغ');

const boundary = fs.readFileSync(new URL('../src/ui/money/invoice-canonical-input-boundary.js', import.meta.url), 'utf8');
assert.match(boundary, /isSalesInvoiceForm/);
assert.match(boundary, /AVAN_MONEY_DISPLAY_UNIT !== UNIT_RIAL/);
assert.match(boundary, /canonicalTextForDisplay\(displayed, UNIT_RIAL\)/);

console.log('c2-2-rial-header-contract.spec.mjs: PASS');
