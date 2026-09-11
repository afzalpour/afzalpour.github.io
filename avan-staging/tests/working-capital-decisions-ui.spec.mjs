import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/intelligence/working-capital-decision-workspace.js');
const css = read('rc17-working-capital-decisions.css');
const index = read('index.html');
const sw = read('sw.js');

assert.match(ui, /تصمیم‌یار عملیاتی/);
assert.match(ui, /چرا این پیشنهاد؟/);
assert.match(ui, /آزمایش وصول در دوقلو/);
assert.match(ui, /آزمایش پرداخت در دوقلو/);
assert.match(ui, /شواهد قابل‌فهم/,
  'why modal must explicitly present human-readable evidence');
assert.match(ui, /سند حسابداری شماره/,
  'journal evidence must use journal number instead of exposing internal UUID');
assert.match(ui, /ردیف مرتبط با سند شماره/,
  'journal-line evidence must be described in accounting context');
assert.match(ui, /فاکتور شماره/,
  'invoice evidence must use invoice number instead of exposing internal UUID');
assert.match(ui, /طرف‌حساب مرتبط با این پیشنهاد/,
  'party evidence must resolve to a human-facing party description');
assert.doesNotMatch(ui, /<code>\$\{esc\(id\)\}<\/code>/,
  'decision evidence modal must never print raw UUID references');
assert.match(ui, /window\.AvanFinancialDigitalTwin\.open\(item\.simulationSeed\)/,
  'simulation handoff must open Digital Twin with explicit deterministic seed only');
assert.match(ui, /Human-controlled/);
assert.doesNotMatch(ui, /localStorage|sessionStorage/,
  'decision workspace must not persist financial decision data in browser storage');
assert.doesNotMatch(ui, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
  'decision workspace must not expose financial write operations');
assert.match(css, /avan-decision-evidence-human-row/,
  'human-readable evidence rows must have stable presentation styling');
assert.match(css, /@media\(max-width:600px\)/,
  'decision layer must remain responsive on mobile');
assert.match(index, /rc17-working-capital-decisions\.css/);
assert.match(index, /src\/ui\/intelligence\/working-capital-decision-workspace\.js/);
assert.match(sw, /rc17-working-capital-decisions\.css/);
assert.match(sw, /src\/intelligence\/working-capital-decisions\.js/);
assert.match(sw, /src\/application\/intelligence\/working-capital-decision-service\.js/);
assert.match(sw, /src\/ui\/intelligence\/working-capital-decision-workspace\.js/);
assert.match(sw, /avan-staging-rc1-v10[5-9]-/,
  'PWA cache must advance beyond the RC1.7-C v104 cache');

console.log('working-capital-decisions-ui.spec.mjs: PASS');
