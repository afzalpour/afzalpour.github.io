import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const stagingRoot = resolve(process.cwd());
const productionRoot = resolve(stagingRoot, '..');
const allowlistPath = join(stagingRoot, 'runtime-divergence-allowlist.json');
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const allowed = new Map((allowlist.allowed || []).map(item => [String(item.path).replaceAll('\\', '/'), item.reason]));

const ROOT_RUNTIME_EXTENSIONS = new Set(['.js', '.css', '.html', '.webmanifest', '.png', '.ico']);
const STAGING_IGNORE_DIRS = new Set(['tests', 'scripts', 'node_modules']);
const PRODUCTION_IGNORE_DIRS = new Set(['.git', '.github', 'docs', 'avan-staging', 'node_modules']);
const STAGING_IGNORE_FILES = new Set(['package-lock.json']);

function normalized(path) {
  return path.split(sep).join('/');
}

function walk(root, dir = root, ignoreDirs = new Set()) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = normalized(relative(root, full));
    const top = rel.split('/')[0];
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (ignoreDirs.has(top)) continue;
      out.push(...walk(root, full, ignoreDirs));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function isProductionRuntime(path) {
  if (path.startsWith('src/')) return true;
  if (path.includes('/')) return false;
  return ROOT_RUNTIME_EXTENSIONS.has(extname(path));
}

function isStagingRuntime(path) {
  if (STAGING_IGNORE_FILES.has(path)) return false;
  if (path === 'runtime-divergence-allowlist.json' || path === 'package.json') return true;
  if (path.startsWith('src/')) return true;
  if (path.includes('/')) return false;
  return ROOT_RUNTIME_EXTENSIONS.has(extname(path));
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

const stagingRuntime = walk(stagingRoot, stagingRoot, STAGING_IGNORE_DIRS).filter(isStagingRuntime);
for (const path of stagingRuntime) {
  if (allowed.has(path)) continue;
  assertSameBytes(path);
}

const productionRuntime = walk(productionRoot, productionRoot, PRODUCTION_IGNORE_DIRS).filter(isProductionRuntime);
for (const path of productionRuntime) {
  if (allowed.has(path)) continue;
  const stagingPath = join(stagingRoot, path);
  assert.ok(existsSync(stagingPath), `Production runtime has no Staging mirror: ${path}. Backport Production hotfixes to Staging before further release work.`);
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

console.log(`runtime parity PASS — ${stagingRuntime.length} staged runtime files checked, ${allowed.size} intentional divergences declared`);
