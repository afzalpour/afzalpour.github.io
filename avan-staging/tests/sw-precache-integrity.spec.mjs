import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const stagingRoot = path.resolve(testsDir, '..');
const sw = fs.readFileSync(path.join(stagingRoot, 'sw.js'), 'utf8');

const assetBlock = sw.match(/const ASSETS=\[([\s\S]*?)\];/);
assert.ok(assetBlock, 'service worker must declare a bounded ASSETS array');
const assets = [...assetBlock[1].matchAll(/['"]\.\/([^'"]*)['"]/g)].map(match => match[1]);
assert.ok(assets.length > 0, 'service worker must declare runtime assets');
assert.equal(new Set(assets).size, assets.length, 'precache asset list must not contain duplicates');

const missing = [];
for (const rel of assets) {
  if (!rel) continue;
  const target = path.resolve(stagingRoot, rel);
  if (!target.startsWith(`${stagingRoot}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) missing.push(rel);
}
assert.deepEqual(missing, [], `every precached runtime asset must exist; missing: ${missing.join(', ')}`);

for (const module5 of [
  'module5-iran-compliance-radar.css',
  'src/application/intelligence/iran-compliance-radar-service.js',
  'src/intelligence/iran-compliance-radar-foundation.js',
  'src/ui/intelligence/iran-compliance-radar-workspace.js'
]) assert.ok(assets.includes(module5), `Module 5 precache missing: ${module5}`);

assert.doesNotMatch(assetBlock[1], /src\/ui\/money\/live-money-inputs\.js/,
  'removed legacy money input runtime must never be precached again');

const cacheIdentity = sw.match(/const CACHE='(avan-staging-rc1-v(\d+)-[a-z0-9-]+)'/i);
assert.ok(cacheIdentity, 'Staging service worker must use a versioned avan-staging-rc1 cache identity');
assert.ok(Number(cacheIdentity[2]) >= 117, 'Module 5 Staging cache identity must be v117 or newer');
assert.match(sw, /if\(request\.mode==='navigate'\)/, 'HTML fallback must remain navigation-only');
assert.match(sw, /url\.origin!==location\.origin/, 'cross-origin traffic must stay outside the app cache');

console.log(`sw-precache-integrity: PASS (${assets.length} declared runtime entries; ${cacheIdentity[1]})`);