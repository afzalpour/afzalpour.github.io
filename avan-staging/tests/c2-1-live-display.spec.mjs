import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  canonicalFromMoneyText,
  displayFromCanonical,
  finalInvoiceTotal,
  formatCanonicalMoney
} from '../src/ui/settlement/tax-settlement-sync.js';
import { collapseTaxSettingsCards } from '../src/ui/tax/tax-settings-singleton.js';

assert.equal(canonicalFromMoneyText('۱۱۰٬۰۶۰ ریال'), 11006n,
  'rendered Rial must convert back to canonical Toman exactly once');
assert.equal(displayFromCanonical(11006n, 'rial'), 110060n);
assert.equal(formatCanonicalMoney(11006n, 'toman'), '11٬006 تومان');
assert.equal(formatCanonicalMoney(11006n, 'rial'), '110٬060 ریال');
assert.notEqual(formatCanonicalMoney(11006n, 'rial'), '1٬100٬600 ریال',
  'VAT total must never receive a second Rial x10 conversion');

const nodes = new Map([
  ['[data-rc15-invoice-tax-summary] .rc15-grand b', { textContent: '۱۱۰٬۰۶۰ ریال' }],
  ['.invoice-grand-total', { textContent: '۱۱۰٬۰۶۰ ریال' }]
]);
const form = {
  dataset: { avanInvoiceTotal: '110060' },
  querySelector(selector) { return nodes.get(selector) || null; }
};
assert.equal(finalInvoiceTotal(form, 'rial'), 11006n,
  'fresh VAT total must defeat stale doubly-converted dataset state');

const cards = [0, 1, 2].map(index => ({
  index,
  isConnected: true,
  removed: false,
  remove() { this.removed = true; this.isConnected = false; }
}));
const fakeDocument = {
  getElementById(id) {
    if (id === 'pageTitle') return { textContent: 'تنظیمات' };
    if (id === 'content') return { querySelectorAll: () => cards };
    return null;
  }
};
assert.equal(collapseTaxSettingsCards(fakeDocument), 2);
assert.equal(cards[0].removed, true);
assert.equal(cards[1].removed, true);
assert.equal(cards[2].removed, false,
  'newest tax settings render must be the single surviving card');

const outputSource = fs.readFileSync(new URL('../rc13-final-polish.js', import.meta.url), 'utf8');
assert.doesNotMatch(outputSource, /chip\.innerHTML\s*=/,
  'unit chip must not rebuild its own DOM on every observer pass');
assert.match(outputSource, /unitNodes\.forEach\(node=>node\.remove\(\)\)/,
  'money header projection must collapse duplicate unit suffix nodes');
assert.match(outputSource, /if\(label\.textContent!==nextLabel\)/,
  'unit chip writes must be idempotent');

console.log('c2-1-live-display.spec.mjs: PASS');
