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
assert.match(ui, /window\.AvanFinancialDigitalTwin\.open\(item\.simulationSeed\)/,
  'simulation handoff must open Digital Twin with explicit deterministic seed only');
assert.match(ui, /Human-controlled/);
assert.doesNotMatch(ui, /localStorage|sessionStorage/,
  'decision workspace must not persist financial decision data in browser storage');
assert.doesNotMatch(ui, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
  'decision workspace must not expose financial write operations');
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
