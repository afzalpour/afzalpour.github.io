import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const presentation = read('src/ui/money/accounting-negative-presentation.js');
const print = read('rc12-print-export.js');
const index = read('index.html');
const sw = read('sw.js');

assert.match(presentation, /installUiLifecycle/,
  'negative-number formatting must run through the central UI lifecycle');
assert.doesNotMatch(presentation, /new MutationObserver|MutationObserver\(/,
  'negative-number formatting must not add a generic monetary MutationObserver');
assert.match(presentation, /numbers:accounting-negative-presentation/);
assert.match(presentation, /priority: 900/,
  'negative projection must run after the existing money output contract');

assert.match(presentation, /'td'/,
  'standalone negative table values must be covered');
assert.match(presentation, /'\.num'/,
  'numeric output cells must be covered');
assert.match(presentation, /'\.kpi-value'/,
  'dashboard/report KPI values must be covered');
assert.match(presentation, /'\.summary-pill'/,
  'report summary values must be covered');
assert.match(presentation, /'\.line-total > \*'/,
  'document/invoice total presentation must be covered');

assert.match(presentation, /avan-accounting-negative::before\{content:'\('\}/);
assert.match(presentation, /avan-accounting-negative::after\{content:'\)'\}/);
assert.match(presentation, /avan-accounting-negative-sign[\s\S]*?font-size:0!important/,
  'the stored/rendered minus character must remain in DOM but be visually replaced by accounting parentheses');
assert.match(presentation, /signNode\.textContent = sign/,
  'raw signed display text must retain the original minus sign for non-visual consumers');
assert.match(presentation, /color:var\(--bad,#b23b3b\)!important/,
  'negative values must be red on screen');

assert.match(print, /AvanAccountingNegative\?\.project\?\.\(\)/,
  'print must force the shared negative presentation before cloning');
assert.match(print, /avan-accounting-negative::before\{content:'\('\}/);
assert.match(print, /avan-accounting-negative::after\{content:'\)'\}/);
assert.match(print, /color:#a83c48!important/,
  'negative values must remain red in Print/PDF');

assert.match(index, /src\/ui\/money\/accounting-negative-presentation\.js/);
assert.match(sw, /src\/ui\/money\/accounting-negative-presentation\.js/);
const cacheVersion = Number(sw.match(/avan-staging-rc1-v(\d+)-/)?.[1] || 0);
assert.ok(cacheVersion >= 101,
  'accounting-negative presentation must stay precached in its introducing generation or any later PWA cache');

console.log('accounting-negative-presentation.spec.mjs: PASS');
