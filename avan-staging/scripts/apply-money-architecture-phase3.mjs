import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
const must = (ok, label) => { if (!ok) throw new Error(label); };

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  must(count === 1, `${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function coreDecimalSum() {
  let s = read('src/core/money/canonical-money.js');
  if (s.includes('export function sumCanonicalDecimals')) return;
  const anchor = `export function formatCanonicalDecimal(value, unit = UNIT_TOMAN, { withUnit = true } = {}) {\n  const display = canonicalDecimalToDisplay(value, unit);\n  if (display === null) return '—';\n  const formatted = groupedDecimalString(display);\n  return withUnit ? \`${'${formatted}'} ${'${unitLabel(unit)}'}\` : formatted;\n}\n`;
  must(s.includes(anchor), 'canonical decimal formatter anchor missing');
  s = s.replace(anchor, `${anchor}\nexport function sumCanonicalDecimals(values = []) {\n  let totalMicros = 0n;\n  for (const value of values) {\n    const micros = signedDecimalMoneyMicros(value);\n    if (micros === null) throw new Error('INVALID_CANONICAL_DECIMAL_AMOUNT');\n    totalMicros += micros;\n  }\n  return decimalMicrosToPlainString(totalMicros);\n}\n`);
  write('src/core/money/canonical-money.js', s);
}

function inventoryMoney() {
  let s = read('rc14-inventory-operations.js');
  if (!s.includes("import {sumCanonicalDecimals} from './src/core/money/canonical-money.js';")) {
    s = replaceOnce(
      s,
      "import {MoneyRuntime} from './src/ui/money/money-runtime.js';",
      "import {MoneyRuntime} from './src/ui/money/money-runtime.js';\nimport {sumCanonicalDecimals} from './src/core/money/canonical-money.js';",
      'inventory decimal sum import'
    );
  }
  s = s.replace(
    "const fa=v=>Number(v||0).toLocaleString('fa-IR',{maximumFractionDigits:6}),money=v=>MoneyRuntime.formatCanonical(Math.round(Number(v||0)));",
    "const fa=v=>Number(v||0).toLocaleString('fa-IR',{maximumFractionDigits:6}),money=v=>MoneyRuntime.formatCanonicalDecimal(v);"
  );
  s = s.replace(
    '<div class=\"field e-cost\"><label>بهای واحد</label><input name=\"cost\" inputmode=\"decimal\"></div>',
    '<div class=\"field e-cost\"><label>بهای واحد (${MoneyRuntime.unitLabel()})</label><input name=\"cost\" data-money-decimal-input=\"true\" inputmode=\"decimal\"></div>'
  );

  const oldCost = "const need=['receipt','opening'].includes(t)||(t==='adjustment'&&dir==='in'),cost=dec(r.querySelector('[name=cost]').value||'0');if(cost===null||(need&&Number(cost)<=0))return toast(`بهای ردیف ${i+1} معتبر نیست`);rows.push({line_no:i+1,item_id:item.id,from_warehouse_id:from,to_warehouse_id:to,quantity:q,unit_cost:cost,description:r.querySelector('[name=desc]').value.trim()||null});";
  const newCost = "const need=['receipt','opening'].includes(t)||(t==='adjustment'&&dir==='in'),costResult=MoneyRuntime.parseDecimalInput(r.querySelector('[name=cost]').value||'0');if(!costResult.ok||(need&&Number(costResult.value)<=0))return toast(costResult.code==='RIAL_DECIMAL_PRECISION_EXCEEDED'?`دقت بهای ریالی ردیف ${i+1} قابل تبدیل دقیق به تومان نیست`:`بهای ردیف ${i+1} معتبر نیست`);rows.push({line_no:i+1,item_id:item.id,from_warehouse_id:from,to_warehouse_id:to,quantity:q,unit_cost:costResult.value,description:r.querySelector('[name=desc]').value.trim()||null});";
  must(s.includes(oldCost) || s.includes('costResult=MoneyRuntime.parseDecimalInput'), 'inventory cost boundary anchor missing');
  if (s.includes(oldCost)) s = s.replace(oldCost, newCost);

  s = s.replaceAll('${fa(r.unit_cost)}', '${money(r.unit_cost)}');
  s = s.replaceAll('${fa(x.moving_average_unit_cost)}', '${money(x.moving_average_unit_cost)}');
  s = s.replaceAll('${fa(x.sub_toman_rounding_delta)}', '${money(x.sub_toman_rounding_delta)}');
  s = s.replace('<th>اختلاف زیر تومان</th>', '<th>اختلاف گرد کردن</th>');

  const oldMap = "const w=M.company.id,[v,rec]=await Promise.all([C.select('inventory_valuation',`select=*&workspace_id=eq.${w}`),C.select('inventory_financial_reconciliation',`select=*&workspace_id=eq.${w}&limit=1`).catch(()=>[])]),map=new Map();v.forEach(x=>{const z=map.get(x.item_id)||{q:0,val:0};z.q+=Number(x.quantity_on_hand||0);z.val+=Number(x.ledger_inventory_value_toman||0);map.set(x.item_id,z);});";
  const newMap = "const w=M.company.id,[v,rec]=await Promise.all([C.select('inventory_valuation',`select=*&workspace_id=eq.${w}`),C.select('inventory_financial_reconciliation',`select=*&workspace_id=eq.${w}&limit=1`).catch(()=>[])]),map=new Map();v.forEach(x=>{const z=map.get(x.item_id)||{q:0,val:'0'};z.q+=Number(x.quantity_on_hand||0);z.val=sumCanonicalDecimals([z.val,x.ledger_inventory_value_toman||'0']);map.set(x.item_id,z);});";
  must(s.includes(oldMap) || s.includes("val=sumCanonicalDecimals([z.val"), 'inventory value accumulation anchor missing');
  if (s.includes(oldMap)) s = s.replace(oldMap, newMap);
  s = s.replace(
    "money([...map.values()].reduce((s,x)=>s+x.val,0))",
    "money(sumCanonicalDecimals([...map.values()].map(x=>x.val)))"
  );

  must(!s.includes('formatCanonical(Math.round'), 'inventory still rounds canonical values');
  write('rc14-inventory-operations.js', s);
}

function printMoneyContract() {
  let s = read('rc12-print-export.js');
  if (!s.includes("import { MoneyRuntime } from './src/ui/money/money-runtime.js';")) {
    s = replaceOnce(
      s,
      "import { toast } from './src/ui/feedback/toast.js';",
      "import { toast } from './src/ui/feedback/toast.js';\nimport { MoneyRuntime } from './src/ui/money/money-runtime.js';",
      'print money runtime import'
    );
  }

  if (!s.includes("clone.querySelectorAll('th[data-avan-money-unit]')")) {
    const anchor = "  clone.querySelectorAll('input,select,textarea').forEach(control => {\n    const replacement = document.createElement('span');\n    replacement.textContent = toPersianDigits(control.value || '—');\n    control.replaceWith(replacement);\n  });\n\n";
    must(s.includes(anchor), 'print control replacement anchor missing');
    s = s.replace(anchor, `${anchor}  clone.querySelectorAll('th[data-avan-money-unit]').forEach(th => {\n    const base = text(th.dataset.avanMoneyHeaderBase || th.textContent);\n    const unit = text(th.dataset.avanMoneyUnit);\n    if (base && unit) th.textContent = \`${'${base}'} (${'${unit}'})\`;\n  });\n\n`);
  }

  if (!s.includes('const moneyUnit = MoneyRuntime?.unitLabel?.()')) {
    s = s.replace(
      "function printHeaderHtml(title, detail, now) {\n  const profile = companyProfile();",
      "function printHeaderHtml(title, detail, now) {\n  const profile = companyProfile();\n  const moneyUnit = MoneyRuntime?.unitLabel?.() || '—';"
    );
  }
  if (!s.includes('avan-print-money-unit')) {
    const anchor = '        <div class="avan-print-meta">${escapeHtml(toPersianDigits(now))}</div>\n';
    must(s.includes(anchor), 'print header meta anchor missing');
    s = s.replace(anchor, `${anchor}        <div class="avan-print-money-unit"><b>واحد مبالغ:</b> ${'${escapeHtml(moneyUnit)}'}</div>\n`);
  }

  if (!s.includes('cell.dataset?.avanMoneyUnit')) {
    const oldRows = "function tableRows(table) {\n  return [...table.querySelectorAll('tr')].map(row =>\n    [...row.querySelectorAll('th,td')].map(cell => csvCell(cell.innerText))\n  );\n}";
    const newRows = "function tableRows(table) {\n  return [...table.querySelectorAll('tr')].map(row =>\n    [...row.querySelectorAll('th,td')].map(cell => {\n      const raw = text(cell.innerText);\n      const unit = text(cell.dataset?.avanMoneyUnit);\n      const value = unit ? `${raw} (${unit})` : raw;\n      return csvCell(value);\n    })\n  );\n}";
    must(s.includes(oldRows), 'CSV table rows anchor missing');
    s = s.replace(oldRows, newRows);
  }

  if (!s.includes("csvCell('واحد مبالغ')")) {
    const oldCsv = "  const csv = '\\uFEFF' + rows.map(row => row.join(',')).join('\\r\\n');";
    const newCsv = "  const profile = companyProfile();\n  const metaRows = [\n    [csvCell('شرکت'), csvCell(profile.display_name || profile.workspace_name || 'آوان')],\n    [csvCell('واحد مبالغ'), csvCell(MoneyRuntime?.unitLabel?.() || '—')],\n    []\n  ];\n  const csv = '\\uFEFF' + [...metaRows, ...rows].map(row => row.join(',')).join('\\r\\n');";
    must(s.includes(oldCsv), 'CSV export anchor missing');
    s = s.replace(oldCsv, newCsv);
  }

  write('rc12-print-export.js', s);
}

function serviceWorker() {
  let s = read('sw.js');
  s = s.replace(/const CACHE='[^']+';/, "const CACHE='avan-staging-rc1-v77-money-architecture-gate';");
  write('sw.js', s);
}

coreDecimalSum();
inventoryMoney();
printMoneyContract();
serviceWorker();
console.log('Money architecture phase 3 applied.');
