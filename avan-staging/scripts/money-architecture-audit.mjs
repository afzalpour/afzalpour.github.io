import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const findings = [];
const active = new Set();

function rel(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function addFinding(code, file, detail) {
  findings.push({ code, file, detail });
}

function localFile(specifier, fromFile) {
  if (!specifier || /^(?:https?:|data:|blob:)/.test(specifier)) return null;
  if (!specifier.startsWith('.')) return null;
  const resolved = path.resolve(path.dirname(fromFile), specifier);
  return fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null;
}

function importsFrom(source) {
  const specs = [];
  const re = /\bimport\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(re)) specs.push(match[1]);
  return specs;
}

function visit(file) {
  const name = rel(file);
  if (active.has(name)) return;
  active.add(name);
  if (!/\.m?js$/i.test(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  for (const specifier of importsFrom(source)) {
    const child = localFile(specifier, file);
    if (child) visit(child);
  }
}

const index = fs.readFileSync(indexPath, 'utf8');
for (const match of index.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
  const src = match[1];
  if (/^https?:/.test(src)) continue;
  const file = path.resolve(root, src.replace(/^\.\//, ''));
  if (fs.existsSync(file)) visit(file);
  else addFinding('MISSING_ACTIVE_SCRIPT', 'index.html', src);
}

const requiredActive = [
  'src/ui/money/money-runtime.js',
  'src/ui/money/money-inputs.js',
  'src/ui/money/money-settings-card.js',
  'src/ui/money/money-output-contract.js',
  'src/ui/money/invoice-money-workspace.js',
  'src/ui/settlement/settlement-workspace-v2.js',
  'src/ui/tax/tax-workspace-v2.js',
  'src/ui/tax/tax-date-aware.js'
];
for (const file of requiredActive) {
  if (!active.has(file)) addFinding('REQUIRED_MONEY_RUNTIME_NOT_ACTIVE', file, 'not reachable from index.html');
}

const retired = [
  'rc11-money.js',
  'rc11-currency.js',
  'rc11-unit-density.js',
  'src/ui/money/live-money-inputs.js'
];
for (const file of retired) {
  if (active.has(file)) addFinding('RETIRED_MONEY_RUNTIME_ACTIVE', file, 'legacy runtime is still reachable');
}

for (const file of active) {
  const full = path.join(root, file);
  if (!fs.existsSync(full) || !/\.m?js$/i.test(full)) continue;
  const source = fs.readFileSync(full, 'utf8');
  if (source.includes('AVAN_MONEY_DISPLAY_UNIT')) {
    addFinding('LEGACY_UNIT_GLOBAL_ACTIVE', file, 'AVAN_MONEY_DISPLAY_UNIT');
  }
  if (/\b(?:const|let|var)\s+money\s*=\s*[^;\n]*(?:تومان|ریال)/.test(source)) {
    addFinding('LOCAL_LITERAL_MONEY_FORMATTER', file, 'money formatter owns a unit literal');
  }
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
if (!app.includes("import { MoneyRuntime } from './src/ui/money/money-runtime.js';")) {
  addFinding('APP_MONEY_RUNTIME_MISSING', 'app.js', 'MoneyRuntime import missing');
}
if (!app.includes('await Money.ready();await reloadAndRender()')) {
  addFinding('APP_RENDERS_BEFORE_MONEY_READY', 'app.js', 'showApp must await money preference');
}
if (/ctx\.workspace\s*=\s*ws\[0\]/.test(app)) {
  addFinding('APP_FIRST_WORKSPACE_BYPASS', 'app.js', 'must use active CompanyContext');
}

const taxDate = fs.readFileSync(path.join(root, 'src/ui/tax/tax-date-aware.js'), 'utf8');
for (const forbidden of ['calculateVatAmount', 'calculateTaxableAmount', 'data-rc15-invoice-tax-summary', 'rc15-invoice-totals']) {
  if (taxDate.includes(forbidden)) addFinding('TAX_DATE_AWARE_WRITES_MONEY', 'src/ui/tax/tax-date-aware.js', forbidden);
}

const invoiceMoney = fs.readFileSync(path.join(root, 'src/ui/money/invoice-money-workspace.js'), 'utf8');
if (!invoiceMoney.includes("architecture: 'invoice-money-single-writer-v3'")) {
  addFinding('INVOICE_SINGLE_WRITER_MISSING', 'src/ui/money/invoice-money-workspace.js', 'v3 ownership marker missing');
}
if (!invoiceMoney.includes('rc15TaxMetadataReady')) {
  addFinding('INVOICE_TAX_READINESS_GATE_MISSING', 'src/ui/money/invoice-money-workspace.js', 'tax metadata readiness is not gated');
}

const settlement = fs.readFileSync(path.join(root, 'src/ui/settlement/settlement-workspace-v2.js'), 'utf8');
for (const forbidden of ['AVAN_MONEY_DISPLAY_UNIT', 'displayToCanonical(', 'canonicalToDisplay(']) {
  if (settlement.includes(forbidden)) addFinding('SETTLEMENT_OWNS_CONVERSION', 'src/ui/settlement/settlement-workspace-v2.js', forbidden);
}

const inventory = fs.readFileSync(path.join(root, 'rc14-inventory-operations.js'), 'utf8');
if (!inventory.includes('MoneyRuntime.parseDecimalInput')) {
  addFinding('INVENTORY_DECIMAL_INPUT_BOUNDARY_MISSING', 'rc14-inventory-operations.js', 'unit cost is not parsed through MoneyRuntime');
}
if (!inventory.includes('MoneyRuntime.formatCanonicalDecimal')) {
  addFinding('INVENTORY_DECIMAL_OUTPUT_BOUNDARY_MISSING', 'rc14-inventory-operations.js', 'inventory values are not formatted through MoneyRuntime');
}
if (inventory.includes('formatCanonical(Math.round')) {
  addFinding('INVENTORY_PRECISION_LOSS', 'rc14-inventory-operations.js', 'rounding before display');
}

const print = fs.readFileSync(path.join(root, 'rc12-print-export.js'), 'utf8');
if (!print.includes('avan-print-money-unit') || !print.includes("csvCell('واحد مبالغ')") || !print.includes("th[data-avan-money-unit]")) {
  addFinding('PRINT_MONEY_UNIT_CONTRACT_MISSING', 'rc12-print-export.js', 'print/CSV must expose the active unit');
}

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const file of retired.slice(0, 3)) {
  if (sw.includes(`'./${file}'`)) addFinding('RETIRED_MONEY_ASSET_CACHED', 'sw.js', file);
}

const metrics = {
  active_runtime_files: active.size,
  findings: findings.length,
  app_js_bytes: fs.statSync(path.join(root, 'app.js')).size,
  index_html_bytes: fs.statSync(indexPath).size
};

console.log(JSON.stringify({ metrics, active: [...active].sort(), findings }, null, 2));
if (findings.length) {
  console.error(`Money architecture gate failed with ${findings.length} finding(s).`);
  process.exitCode = 1;
}
