import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const bootstrap = fs.readFileSync(path.join(root, 'rc15-c1-bootstrap.js'), 'utf8');
const stability = fs.readFileSync(path.join(root, 'src/ui/tax/tax-live-stability.js'), 'utf8');
const settlement = fs.readFileSync(path.join(root, 'src/ui/settlement/tax-settlement-sync.js'), 'utf8');

assert.match(bootstrap, /tax-live-stability\.js/, 'stable tax runtime must be loaded');
assert.doesNotMatch(bootstrap, /tax-date-aware\.js/, 'legacy date-aware runtime must not run in parallel');
assert.match(stability, /cards\.slice\(0, -1\)/, 'duplicate settings cards must collapse to the newest card');
assert.match(stability, /node\.innerHTML !== html/, 'tax runtime must avoid no-op DOM rewrites');
assert.doesNotMatch(stability, /new\s+MutationObserver/, 'hotfix must not add observer debt');
assert.match(settlement, /node\.innerHTML !== html/, 'settlement sync must avoid no-op DOM rewrites');

console.log('tax live stability regression contract: PASS');
