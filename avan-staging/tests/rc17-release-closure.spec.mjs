import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const stagingRoot = path.resolve(testsDir, '..');
const repoRoot = path.resolve(stagingRoot, '..');

const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const stagingIndex = read(stagingRoot, 'index.html');
const productionIndex = read(repoRoot, 'index.html');
const sw = read(stagingRoot, 'sw.js');
const currentState = read(repoRoot, 'AVAN_CURRENT_STATE.md');

const requiredRuntime = [
  'src/ui/intelligence/control-tower-workspace.js',
  'src/ui/intelligence/financial-digital-twin-workspace.js',
  'src/ui/intelligence/working-capital-workspace.js',
  'src/ui/intelligence/working-capital-decision-workspace.js',
  'src/ui/intelligence/dashboard-accounting-correctness-hotfix.js',
  'src/ui/intelligence/dashboard-live-contract-v3.js',
  'src/ui/parties/party-master-data.js',
  'src/ui/parties/counterparty-360.js',
  'src/ui/reports/report-exact-live-v2.js'
];

for (const asset of requiredRuntime) {
  assert.match(
    stagingIndex,
    new RegExp(`src=["']${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`),
    `RC1.7 release closure requires ${asset} to be wired in Staging index.html`
  );
  assert.match(
    sw,
    new RegExp(`["']\\./${asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`),
    `RC1.7 release closure requires ${asset} in the Staging service-worker asset contract`
  );
}

for (const stylesheet of [
  'rc17-control-tower.css',
  'rc17-financial-digital-twin.css',
  'rc17-working-capital.css',
  'rc17-working-capital-decisions.css',
  'rc17-party-master-data.css',
  'rc17-counterparty-360.css'
]) {
  assert.match(stagingIndex, new RegExp(`href=["']${stylesheet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
  assert.match(sw, new RegExp(`["']\\./${stylesheet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
}

assert.match(sw, /new Request\(request,\{cache:'reload'\}\)/,
  'Staging runtime requests must cross the browser HTTP-cache boundary');
assert.match(sw, /new Request\(new URL\(asset,self\.registration\.scope\),\{cache:'reload'\}\)/,
  'Staging install-time precache must fetch fresh assets');
assert.match(sw, /client\.navigate\(client\.url\)/,
  'Staging service-worker activation must move open clients onto the active runtime');

// Production must remain the explicitly released RC1.6 runtime until the separate Production Release Gate.
for (const rc17Marker of [
  'rc17-control-tower',
  'rc17-financial-digital-twin',
  'rc17-working-capital',
  'working-capital-decision-workspace',
  'dashboard-accounting-correctness-hotfix',
  'party-master-data',
  'counterparty-360'
]) {
  assert.doesNotMatch(productionIndex, new RegExp(rc17Marker),
    `Production runtime must not contain RC1.7 marker ${rc17Marker} before promotion`);
}

assert.match(currentState, /Production current release = \*\*RC1\.6\*\*/,
  'Source of Truth must keep Production on RC1.6 before explicit promotion');
assert.match(currentState, /RC1\.7 remains \*\*Staging-only\*\*/,
  'Source of Truth must preserve the Staging-only RC1.7 release boundary');
assert.match(currentState, /RC1\.7-D Evidence Readable PASS/,
  'Source of Truth must record the explicit RC1.7-D evidence readability Live result');
assert.match(currentState, /current Live validations pending = \*\*Dashboard Accounting Correctness final\*\*, \*\*RC1\.7-D full functional closure\*\*, \*\*Counterparty 360\*\*/,
  'RC1.7 release closure must not silently promote while explicit Live gates remain pending');

console.log('rc17-release-closure: PASS');
