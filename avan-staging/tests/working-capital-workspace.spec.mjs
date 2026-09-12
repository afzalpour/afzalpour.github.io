import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const engine = read('src/intelligence/working-capital-foundation.js');
const service = read('src/application/intelligence/working-capital-service.js');
const ui = read('src/ui/intelligence/working-capital-workspace.js');
const css = read('rc17-working-capital.css');
const index = read('index.html');
const sw = read('sw.js');

assert.match(engine, /canonicalDecimalToTenths/);
assert.match(engine, /crossPartyNetting:\s*false/);
assert.match(engine, /autonomousCollection:\s*false/);
assert.match(engine, /autonomousPayment:\s*false/);
assert.match(engine, /actualLedgerMutation:\s*false/);
assert.match(engine, /evidenceGraph/);
assert.doesNotMatch(engine, /Math\.random|Date\.now\(\)/,
  'working-capital decision primitives must stay deterministic');

assert.match(service, /workspace_id=eq\.\$\{workspaceId\}/);
assert.match(service, /writeOperations:\s*0/);
assert.doesNotMatch(service, /cloud\.(insert|update|delete|rpc)\s*\(/,
  'first working-capital service must be read-only');

assert.match(ui, /مرکز سرمایه در گردش/);
assert.match(ui, /اولویت‌های وصول/);
assert.match(ui, /تقویم پرداختنی ۳۰ روزه/);
assert.match(ui, /گراف شواهد/);
assert.match(ui, /شواهد حسابداری مرتبط/);
assert.match(ui, /data-working-capital-evidence-kind="collection"/);
assert.match(ui, /data-working-capital-evidence-kind="payment"/);
assert.match(ui, /data-working-capital-evidence-id="\$\{esc\(item\.id\)\}"/,
  'payable evidence must preserve the full composite open-item id instead of splitting on colon');
assert.doesNotMatch(ui, /split\(':'\)/,
  'payable evidence binding must not truncate composite ids');
assert.match(ui, /data-working-capital-graph="nodes"/);
assert.match(ui, /data-working-capital-graph="edges"/);
assert.match(ui, /سند حسابداری شماره/);
assert.match(ui, /فاکتور شماره/);
assert.doesNotMatch(ui, /<code>\$\{esc\(id\)\}<\/code>/,
  'Working Capital evidence must not expose raw technical ids');
assert.match(ui, /تهاتر بین طرف‌حساب‌ها: غیرفعال/);
assert.match(ui, /عملیات وصول خودکار: صفر/);
assert.match(ui, /عملیات پرداخت خودکار: صفر/);
assert.match(ui, /data-working-capital-nav/);
assert.match(ui, /data-working-capital-report-launcher/);

assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/,
  'seven Working Capital KPIs must use a compact 4+3 desktop layout');
assert.match(css, /avan-working-capital-evidence-kpis button\.summary-pill/,
  'evidence graph counts must be interactive controls');
assert.match(css, /avan-working-capital-evidence-human-row/);

assert.match(index, /rc17-working-capital\.css/);
assert.match(index, /src\/ui\/intelligence\/working-capital-workspace\.js/);
const cacheVersion = Number(sw.match(/avan-staging-rc1-v(\d+)-/)?.[1] || 0);
assert.ok(cacheVersion >= 104,
  'PWA cache must remain at or beyond the RC1.7-C v104 milestone');
assert.match(sw, /src\/intelligence\/working-capital-foundation\.js/);
assert.match(sw, /src\/application\/intelligence\/working-capital-service\.js/);
assert.match(sw, /src\/ui\/intelligence\/working-capital-workspace\.js/);
assert.match(sw, /rc17-working-capital\.css/);

console.log('working-capital-workspace.spec.mjs: PASS');
