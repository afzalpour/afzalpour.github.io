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
  if (!rel) continue; // './' is the navigation root.
  const target = path.resolve(stagingRoot, rel);
  if (!target.startsWith(`${stagingRoot}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    missing.push(rel);
  }
}

assert.deepEqual(missing, [], `every precached runtime asset must exist; missing: ${missing.join(', ')}`);
assert.doesNotMatch(assetBlock[1], /src\/ui\/money\/live-money-inputs\.js/,
  'removed legacy money input runtime must never be precached again');
assert.match(sw, /const CACHE='avan-staging-rc1-v94-precache-integrity'/,
  'the stale precache fix must activate a fresh PWA cache identity');
assert.match(sw, /if\(request\.mode==='navigate'\)/,
  'HTML fallback must remain navigation-only');

console.log(`sw-precache-integrity: PASS (${assets.length} declared runtime entries)`);
