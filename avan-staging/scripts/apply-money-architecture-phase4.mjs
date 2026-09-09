import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.m?js$/.test(entry.name)) out.push(full);
  }
  return out;
}

function retireLiveMoneyImports() {
  const touched = [];
  for (const file of walk(root)) {
    if (file.endsWith(path.join('src', 'ui', 'money', 'live-money-inputs.js'))) continue;
    const source = fs.readFileSync(file, 'utf8');
    const next = source
      .split(/\r?\n/)
      .filter(line => !(line.includes('import') && line.includes('live-money-inputs.js')))
      .join('\n');
    if (next !== source) {
      fs.writeFileSync(file, next);
      touched.push(path.relative(root, file).replaceAll('\\', '/'));
    }
  }
  console.log('Retired live-money-input imports:', touched);
}

function delegatePersianUxMoneyHeaders() {
  const file = path.join(root, 'rc14-persian-ux-v62.js');
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes("window.AvanMoneyOutput?.project?.();\n}")) return;

  const start = source.indexOf('function moneyUnit(){');
  const endMarker = 'function replaceTextNode(node, dashboardOnly = false){';
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) throw new Error('Persian UX money header block not found');

  const replacement = `function annotateMoneyHeaders(){\n  window.AvanMoneyOutput?.project?.();\n}\n\n`;
  source = source.slice(0, start) + replacement + source.slice(end);
  if (source.includes('AVAN_MONEY_DISPLAY_UNIT')) throw new Error('Persian UX still references retired unit global');
  fs.writeFileSync(file, source);
}

retireLiveMoneyImports();
delegatePersianUxMoneyHeaders();
console.log('Money architecture phase 4 applied.');
