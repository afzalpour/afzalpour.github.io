import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const stagingRoot = resolve(process.cwd());
const productionRoot = resolve(stagingRoot, '..');
const allowlistPath = join(stagingRoot, 'runtime-divergence-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const allowed = new Map((allowlist.allowed || []).map(item => [String(item.path).replaceAll('\\', '/'), item.reason]));

function declaredRuntimeAssets(root) {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const match = sw.match(/const ASSETS=\[([\s\S]*?)\];/);
  assert.ok(match, `Service Worker ASSETS declaration missing under ${root}`);
  return [...new Set([...match[1].matchAll(/['"]\.\/([^'"]+)['"]/g)].map(item => item[1]))];
}

function assertSameBytes(path) {
  const stagingPath = join(stagingRoot, path);
  const productionPath = join(productionRoot, path);
  assert.ok(existsSync(stagingPath), `Staging counterpart missing for Production runtime: ${path}`);
  assert.ok(existsSync(productionPath), `Production counterpart missing for shared Staging runtime: ${path}`);
  const stagingBytes = readFileSync(stagingPath);
  const productionBytes = readFileSync(productionPath);
  assert.ok(stagingBytes.equals(productionBytes), `Unexpected Production/Staging runtime drift: ${path}. Add a justified allowlist entry only for intentional next-release divergence.`);
}

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`);
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

const stagingRuntime = declaredRuntimeAssets(stagingRoot);
const productionRuntime = declaredRuntimeAssets(productionRoot);

for (const path of stagingRuntime) {
  if (allowed.has(path)) continue;
  assertSameBytes(path);
}

for (const path of productionRuntime) {
  if (allowed.has(path)) continue;
  const stagingPath = join(stagingRoot, path);
  assert.ok(existsSync(stagingPath), `Production runtime asset has no Staging mirror: ${path}. Backport Production hotfixes to Staging before further release work.`);
  assertSameBytes(path);
}

for (const [path, reason] of allowed) {
  assert.ok(String(reason || '').trim().length >= 12, `Allowlist reason is too weak for ${path}`);
  if (path === 'runtime-divergence-allowlist.json' || path === 'package.json' || path === 'config.js' || path === 'index.html' || path === 'sw.js') continue;
  const stagingExists = existsSync(join(stagingRoot, path));
  const productionExists = existsSync(join(productionRoot, path));
  assert.ok(stagingExists || productionExists, `Stale runtime divergence allowlist entry: ${path}`);
}

const businessProd = readFileSync(join(productionRoot, 'src/ui/intelligence/business-copilot-view.js'));
const businessStage = readFileSync(join(stagingRoot, 'src/ui/intelligence/business-copilot-view.js'));
assert.ok(businessProd.equals(businessStage), 'Business Copilot base question runtime must match Production byte-for-byte.');
const polishProd = readFileSync(join(productionRoot, 'src/ui/intelligence/dashboard-intelligence-live-polish.js'));
const polishStage = readFileSync(join(stagingRoot, 'src/ui/intelligence/dashboard-intelligence-live-polish.js'));
assert.ok(polishProd.equals(polishStage), 'Expanded dashboard intelligence question bank must match Production byte-for-byte.');

// RC1.8 controlled promotion gate. These files were accepted on authenticated Staging
// and must be byte-identical when promoted. Production config and cache identity remain environment-specific.
const rc18PromotedRuntime = [
  'index.html',
  'module4-continuous-close-audit.css',
  'module5-iran-compliance-radar.css',
  'module7-procurement-spend-control.css',
  'rc12-print-export.js',
  'rc15-tax-ux.css',
  'src/ai/risk-audit.js',
  'src/application/intelligence/continuous-close-audit-service.js',
  'src/application/intelligence/iran-compliance-radar-service.js',
  'src/application/intelligence/smart-procurement-spend-service.js',
  'src/application/intelligence/avan-connect-service.js',
  'src/intelligence/continuous-close-audit-foundation.js',
  'src/intelligence/iran-compliance-radar-foundation.js',
  'src/intelligence/smart-procurement-spend-foundation.js',
  'src/intelligence/avan-connect-contract.js',
  'src/intelligence/avan-connect-catalog.js',
  'src/intelligence/avan-connect-foundation.js',
  'src/ui/date/jalali-picker.js',
  'src/ui/intelligence/continuous-close-audit-workspace.js',
  'src/ui/intelligence/iran-compliance-radar-workspace.js',
  'src/ui/intelligence/smart-procurement-spend-view.js',
  'src/ui/intelligence/smart-procurement-spend-workspace.js',
  'src/ui/intelligence/avan-connect-view.js',
  'src/ui/intelligence/avan-connect-interactions.js',
  'src/ui/intelligence/avan-connect-workspace.js',
  'src/ui/intelligence/intelligence-print-export.js',
  'src/ui/localization/user-facing-fa.js',
  'src/ui/money/money-output-contract.js'
];
for (const path of rc18PromotedRuntime) assertSameBytes(path);

const productionConfig = readFileSync(join(productionRoot, 'config.js'));
assert.equal(gitBlobSha(productionConfig), '4acd55ba116b8c764167d6165d72192ccb5affda', 'Production config.js changed during RC1.8 promotion.');
assert.ok(!existsSync(join(productionRoot, 'runtime-divergence-allowlist.json')), 'Staging runtime-divergence metadata must not be copied to Production root.');

const productionSw = readFileSync(join(productionRoot, 'sw.js'), 'utf8');
assert.ok(productionSw.includes("const CACHE_PREFIX='avan-prod-';"), 'Production SW must retain the Production cache prefix.');
assert.ok(productionSw.includes("const CACHE='avan-prod-rc1-8-v1';"), 'RC1.8 Production cache identity is missing.');
assert.ok(!productionSw.includes('avan-staging'), 'Staging cache/path marker leaked into Production Service Worker.');
assert.deepEqual([...productionRuntime].sort(), [...stagingRuntime].sort(), 'Production and accepted Staging Service Worker asset sets must match for RC1.8.');

const productionIndex = readFileSync(join(productionRoot, 'index.html'), 'utf8');
for (const entrypoint of [
  'src/ui/intelligence/continuous-close-audit-workspace.js',
  'src/ui/intelligence/iran-compliance-radar-workspace.js',
  'src/ui/intelligence/smart-procurement-spend-workspace.js',
  'src/ui/intelligence/avan-connect-workspace.js'
]) assert.ok(productionIndex.includes(entrypoint), `RC1.8 Production entrypoint missing: ${entrypoint}`);

console.log(`runtime parity PASS — ${stagingRuntime.length} Staging assets / ${productionRuntime.length} Production assets checked; ${allowed.size} intentional divergences declared; RC1.8 promotion contract PASS`);
