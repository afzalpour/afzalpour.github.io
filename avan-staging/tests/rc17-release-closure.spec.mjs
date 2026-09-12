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
const productionGate = read(repoRoot, '.github', 'workflows', 'avan-production-release-gate.yml');
const twinUi = read(stagingRoot, 'src', 'ui', 'intelligence', 'financial-digital-twin-workspace.js');
const approvalPath = path.join(repoRoot, 'RC1_7_PRODUCTION_APPROVAL.md');
const approvalRecord = fs.existsSync(approvalPath) ? fs.readFileSync(approvalPath, 'utf8') : '';
const productionApproved = approvalRecord.includes('RC1.7 Production Release APPROVED');

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

const rc17Markers = [
  'rc17-control-tower',
  'rc17-financial-digital-twin',
  'rc17-working-capital',
  'working-capital-decision-workspace',
  'dashboard-accounting-correctness-hotfix',
  'party-master-data',
  'counterparty-360'
];

if (productionApproved) {
  for (const rc17Marker of rc17Markers) {
    assert.ok(productionIndex.includes(rc17Marker),
      `Approved RC1.7 Production projection must contain marker ${rc17Marker}`);
  }
  assert.ok(approvalRecord.includes('prod-backup-20260912-rc1-7-pre-promotion'),
    'Explicit Production approval must preserve the named rollback point');
  assert.ok(
    currentState.includes('Production current release = **RC1.6**') ||
    currentState.includes('Production current release = **RC1.7**'),
    'During the approved release transition Source of Truth must identify the current Production release'
  );
} else {
  for (const rc17Marker of rc17Markers) {
    assert.ok(!productionIndex.includes(rc17Marker),
      `Production runtime must not contain RC1.7 marker ${rc17Marker} before explicit Production Release Gate approval`);
  }
  assert.ok(currentState.includes('Production current release = **RC1.6**'),
    'Source of Truth must keep Production on RC1.6 before explicit promotion');
  assert.ok(currentState.includes('RC1.7 remains **Staging-only**'),
    'Source of Truth must preserve the Staging-only RC1.7 release boundary before approval');
  assert.ok(currentState.includes('Production promotion still requires explicit user release approval'),
    'Full Live closure must not bypass the explicit Production Release Gate');
}

assert.ok(currentState.includes('RC1.7-D Evidence Readable PASS'),
  'Source of Truth must retain the decision evidence readability Live result');
assert.ok(currentState.includes('RC1.7-D Live PASS — Handoff Fixed'),
  'Source of Truth must record the explicit final RC1.7-D functional Live PASS');
assert.ok(currentState.includes('Digital Twin Evidence Readable PASS'),
  'Source of Truth must record the explicit readable opening-evidence Live PASS');

const initialLiveClosureComplete = currentState.includes('current Live validation pending = **none for RC1.7 current scope**');
const postReleaseSmokeCorrectionTracked = productionApproved &&
  currentState.includes('## 14) RC1.7 Production Smoke correction loop') &&
  currentState.includes('current Live validation pending = **targeted authenticated Staging retest of PR #160**') &&
  currentState.includes('no database/schema/accounting math changes');
assert.ok(initialLiveClosureComplete || postReleaseSmokeCorrectionTracked,
  'RC1.7 feature Live closure must remain complete; after release only a documented authenticated Smoke correction loop may remain pending');

assert.ok(currentState.includes('93 journal entries / 24 financial transactions / 42 invoices'),
  'Source of Truth must retain the post-Live no-mutation certification');

assert.ok(productionGate.includes("const CACHE='avan-prod-rc1-7-v1';"),
  'RC1.7 release engineering must advance the Production service-worker cache identity');
assert.ok(!productionGate.includes("const CACHE='avan-prod-rc1-6-v1';"),
  'RC1.6 cache identity must not remain hardcoded in the RC1.7 Production gate');
assert.ok(twinUi.includes('avan-twin-evidence-human-list'),
  'Digital Twin opening evidence must render accounting-facing rows');
assert.ok(!twinUi.includes('<code>${esc(id)}</code>'),
  'Digital Twin opening evidence must not render raw technical IDs');

console.log('rc17-release-closure: PASS');