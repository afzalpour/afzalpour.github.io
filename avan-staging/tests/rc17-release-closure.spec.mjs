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
  assert.ok(stagingIndex.includes(`src="${asset}"`) || stagingIndex.includes(`src='${asset}'`),
    `RC1.7 release closure requires ${asset} in Staging index.html`);
  assert.ok(sw.includes(`'./${asset}'`) || sw.includes(`"./${asset}"`),
    `RC1.7 release closure requires ${asset} in the Staging service-worker asset contract`);
}

for (const stylesheet of [
  'rc17-control-tower.css',
  'rc17-financial-digital-twin.css',
  'rc17-working-capital.css',
  'rc17-working-capital-decisions.css',
  'rc17-party-master-data.css',
  'rc17-counterparty-360.css'
]) {
  assert.ok(stagingIndex.includes(`href="${stylesheet}"`) || stagingIndex.includes(`href='${stylesheet}'`));
  assert.ok(sw.includes(`'./${stylesheet}'`) || sw.includes(`"./${stylesheet}"`));
}

assert.ok(sw.includes("new Request(request,{cache:'reload'})"),
  'Staging runtime requests must cross the browser HTTP-cache boundary');
assert.ok(sw.includes("new Request(new URL(asset,self.registration.scope),{cache:'reload'})"),
  'Staging install-time precache must fetch fresh assets');
assert.ok(sw.includes('client.navigate(client.url)'),
  'Staging service-worker activation must move open clients onto the active runtime');

// Full RC1.7 Live closure must never silently promote Production.
for (const rc17Marker of [
  'rc17-control-tower',
  'rc17-financial-digital-twin',
  'rc17-working-capital',
  'working-capital-decision-workspace',
  'dashboard-accounting-correctness-hotfix',
  'party-master-data',
  'counterparty-360'
]) {
  assert.ok(!productionIndex.includes(rc17Marker),
    `Production runtime must not contain RC1.7 marker ${rc17Marker} before explicit Production Release Gate approval`);
}

assert.ok(currentState.includes('Production current release = **RC1.6**'),
  'Source of Truth must keep Production on RC1.6 before explicit promotion');
assert.ok(currentState.includes('RC1.7 remains **Staging-only**'),
  'Source of Truth must preserve the Staging-only RC1.7 release boundary');
assert.ok(currentState.includes('RC1.7-D Evidence Readable PASS'),
  'Source of Truth must retain the evidence readability Live result');
assert.ok(currentState.includes('RC1.7-D Live PASS — Handoff Fixed'),
  'Source of Truth must record the explicit final RC1.7-D functional Live PASS');
assert.ok(currentState.includes('current Live validation pending = **none for RC1.7 current scope**'),
  'RC1.7 current-scope Live closure must be complete before release freeze');
assert.ok(currentState.includes('Production promotion still requires explicit user release approval'),
  'Full Live closure must not bypass the explicit Production Release Gate');
assert.ok(currentState.includes('93 journal entries / 24 financial transactions / 42 invoices'),
  'Source of Truth must retain the post-Live no-mutation certification');

console.log('rc17-release-closure: PASS');
