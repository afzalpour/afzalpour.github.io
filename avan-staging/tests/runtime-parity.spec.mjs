import assert from 'node:assert/strict';
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

console.log(`runtime parity PASS — ${stagingRuntime.length} Staging assets / ${productionRuntime.length} Production assets checked; ${allowed.size} intentional divergences declared`);
