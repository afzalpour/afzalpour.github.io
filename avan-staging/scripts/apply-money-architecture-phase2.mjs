import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
const must = (ok, label) => { if (!ok) throw new Error(label); };

function appCompanyContext() {
  let s = read('app.js');
  if (s.includes('const companyState=await C.companyContext.ensure();')) return;
  const old = "  ctx.visibleWorkspaces=ws.length;ctx.workspace=ws[0]; const wid=ctx.workspace.id;";
  const next = "  const companyState=await C.companyContext.ensure();\n  if(companyState?.selection_required)throw new Error('COMPANY_SELECTION_REQUIRED');\n  const activeId=companyState?.active_company?.id||null;\n  ctx.visibleWorkspaces=ws.length;ctx.workspace=ws.find(x=>x.id===activeId)||companyState?.active_company||ws[0]; const wid=ctx.workspace.id;";
  must(s.includes(old), 'app active-company anchor missing');
  s = s.replace(old, next);
  write('app.js', s);
}

function settlementV2() {
  let s = read('src/ui/settlement/settlement-workspace-v2.js');
  if (s.includes("import { MoneyRuntime } from '../money/money-runtime.js';")) return;
  const oldImport = `import {\n  UNIT_RIAL,\n  normalizeUnit,\n  displayToCanonical,\n  canonicalToDisplay,\n  formatCanonical,\n  groupInteger\n} from '../../core/money/canonical-money.js';`;
  must(s.includes(oldImport), 'settlement core import anchor missing');
  s = s.replace(oldImport, "import { MoneyRuntime } from '../money/money-runtime.js';");
  s = s.replace(/\nfunction currentUnit\(\) \{\n  return normalizeUnit\(window\.AVAN_MONEY_DISPLAY_UNIT\);\n\}/, '');
  s = s.replace(/function displayValue\(canonical, unit = currentUnit\(\)\) \{[\s\S]*?\n\}/, `function displayValue(canonical) {\n  return MoneyRuntime.inputFromCanonical(canonical);\n}`);
  s = s.replace("  const converted = displayToCanonical(visible.value || '0', currentUnit());", "  const converted = MoneyRuntime.parseInput(visible.value || '0');");
  s = s.replaceAll("currentUnit() === UNIT_RIAL ? 'ریال' : 'تومان'", "MoneyRuntime.unitLabel()");
  s = s.replaceAll('formatCanonical(scheduled, currentUnit())', 'MoneyRuntime.formatCanonical(scheduled)');
  s = s.replaceAll('formatCanonical(total, currentUnit())', 'MoneyRuntime.formatCanonical(total)');
  s = s.replaceAll('displayValue(canonical)', 'displayValue(canonical)');
  must(!s.includes('AVAN_MONEY_DISPLAY_UNIT'), 'settlement still reads legacy unit global');
  must(!s.includes('displayToCanonical('), 'settlement still owns conversion');
  must(!s.includes('canonicalToDisplay('), 'settlement still owns conversion');
  write('src/ui/settlement/settlement-workspace-v2.js', s);
}

function taxWrapper() {
  const rel = 'rc15-tax-ux-v3.js';
  let s = read(rel);
  if (s.includes('tax-workspace-v2.js')) return;
  s = `'use strict';\n\nimport { installTaxWorkspaceV2 } from './src/ui/tax/tax-workspace-v2.js';\n\ninstallTaxWorkspaceV2();\n`;
  write(rel, s);
}

function finalPolish() {
  let s = read('rc13-final-polish.js');
  s = s.replace("function unit(){return window.AVAN_MONEY_DISPLAY_UNIT==='rial'?'rial':'toman'}", "function unit(){return window.AvanMoney?.unit?.()||'toman'}");
  s = s.replace(/function preparePageOutput\(\)\{[\s\S]*?\n\}/, "function preparePageOutput(){window.AvanMoneyOutput?.project?.()}");
  s = s.replace(/function prepareDetailOutput\(\)\{[\s\S]*?\n\}/, `function prepareDetailOutput(){\n  window.AvanMoneyOutput?.project?.();\n  const backdrop=document.getElementById('modalBackdrop'),modal=document.getElementById('modal');\n  if(!modal||backdrop?.hidden)return;\n  ensureJournalTotals(modal);\n}`);
  s = s.replace("  document.addEventListener('avan:money-unit-changed',schedule);", '');
  must(!s.includes('AVAN_MONEY_DISPLAY_UNIT'), 'final polish still reads legacy unit global');
  write('rc13-final-polish.js', s);
}

function indexHtml() {
  let s = read('index.html');
  const retired = [
    '  <script type="module" src="rc11-money.js"></script>\n',
    '  <script type="module" src="rc11-currency.js"></script>\n',
    '  <script type="module" src="rc11-unit-density.js"></script>\n'
  ];
  retired.forEach(line => { s = s.replace(line, ''); });
  if (!s.includes('src/ui/money/money-runtime.js')) {
    s = s.replace('  <script type="module" src="app.js"></script>\n', `  <script type="module" src="src/ui/money/money-runtime.js"></script>\n  <script type="module" src="app.js"></script>\n  <script type="module" src="src/ui/money/money-inputs.js"></script>\n  <script type="module" src="src/ui/money/money-settings-card.js"></script>\n  <script type="module" src="src/ui/money/money-output-contract.js"></script>\n`);
  }
  write('index.html', s);
}

function serviceWorker() {
  let s = read('sw.js');
  s = s.replace(/const CACHE='[^']+';/, "const CACHE='avan-staging-rc1-v76-unified-money-runtime';");
  const removeAssets = [
    "'./rc11-money.js',", "'./rc11-currency.js',", "'./rc11-unit-density.js',",
    "'./src/ui/tax/tax-workspace.js',", "'./src/ui/tax/tax-settings-singleton.js',"
  ];
  removeAssets.forEach(asset => { s = s.replace(asset, ''); });
  const anchor = "'./src/core/money/canonical-money.js',";
  const additions = "'./src/core/money/canonical-money.js','./src/application/money/money-service.js','./src/ui/money/money-runtime.js','./src/ui/money/money-inputs.js','./src/ui/money/money-settings-card.js','./src/ui/money/money-output-contract.js','./src/ui/tax/tax-workspace-v2.js',";
  must(s.includes(anchor), 'SW money core anchor missing');
  s = s.replace(anchor, additions);
  write('sw.js', s);
}

appCompanyContext();
settlementV2();
taxWrapper();
finalPolish();
indexHtml();
serviceWorker();
console.log('Money architecture phase 2 applied.');
