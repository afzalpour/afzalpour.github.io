import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(path.join(root, rel), text); }
function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(before, after);
}
function replaceRegexOnce(source, re, after, label) {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const matches = [...source.matchAll(new RegExp(re.source, flags))];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(re, after);
}

function refactorApp() {
  let source = read('app.js');
  if (source.includes("import { MoneyRuntime } from './src/ui/money/money-runtime.js';")) return;

  source = replaceOnce(
    source,
    "import {\n  installAvanCloud\n} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';",
    "import {\n  installAvanCloud\n} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';\nimport { MoneyRuntime } from './src/ui/money/money-runtime.js';",
    'app money import'
  );
  source = replaceOnce(
    source,
    "const Q=id=>document.getElementById(id), C=installAvanCloud();",
    "const Q=id=>document.getElementById(id), C=installAvanCloud(), Money=MoneyRuntime;",
    'app Money binding'
  );
  source = replaceRegexOnce(
    source,
    /const money=v=>\{let n=bi\(v\),sign=n<0n\?'-':'';if\(n<0n\)n=-n;return sign\+n\.toString\(\)\.replace\(\/\\B\(\?=\(\\d\{3\}\)\+\(\?!\\d\)\)\/g,'٬'\)\+' تومان'\};/,
    "const money=v=>Money.formatCanonical(v);\nconst inputCanonical=v=>{const parsed=Money.parseInput(v||'0');return parsed.ok?parsed.value:null};\nconst inputCanonicalRequired=(v,label='مبلغ')=>{const parsed=Money.parseInput(v);if(!parsed.ok){const e=new Error(parsed.code||'INVALID_AMOUNT');e.userMessage=parsed.code==='RIAL_NOT_DIVISIBLE_BY_10'?`${label} ریالی باید مضرب ۱۰ باشد.`:`${label} معتبر نیست.`;throw e}return parsed.value};",
    'app money formatter'
  );
  source = replaceOnce(
    source,
    "  try{await reloadAndRender()}catch(e){",
    "  try{await Money.ready();await reloadAndRender()}catch(e){",
    'app wait money ready'
  );

  // Opening balance command boundary.
  source = replaceRegexOnce(
    source,
    /Q\('cancelModal'\)\.onclick=closeModal;Q\('openingForm'\)\.onsubmit=async e=>\{e\.preventDefault\(\);const f=new FormData\(e\.target\),amt=cleanAmount\(f\.get\('amount'\)\);if\(bi\(amt\)<=0n\)return toast\('مبلغ معتبر وارد کنید'\);try\{await C\.rpc\('post_financial_operation',\{p_workspace_id:ctx\.workspace\.id,p_fiscal_year_id:ctx\.fiscalYear\.id,p_tx_date:f\.get\('date'\),p_tx_type:'opening_balance',p_amount:amt,p_primary_account_id:a\.id,p_counterpart_account_id:null,p_party_id:null,p_description:`مانده افتتاحیه \$\{a\.name\}`\}\);/,
    "Q('cancelModal').onclick=closeModal;Q('openingForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);let amt;try{amt=inputCanonicalRequired(f.get('amount'))}catch(err){return toast(err.userMessage||'مبلغ معتبر وارد کنید')}if(amt<=0n)return toast('مبلغ معتبر وارد کنید');try{await C.rpc('post_financial_operation',{p_workspace_id:ctx.workspace.id,p_fiscal_year_id:ctx.fiscalYear.id,p_tx_date:f.get('date'),p_tx_type:'opening_balance',p_amount:amt.toString(),p_primary_account_id:a.id,p_counterpart_account_id:null,p_party_id:null,p_description:`مانده افتتاحیه ${a.name}`});",
    'opening boundary'
  );

  // Invoice base calculator must delegate to the single owner.
  source = replaceRegexOnce(
    source,
    /function updateInvoiceTotals\(\)\{[\s\S]*?\n\}\n\nfunction bindInvoiceLines\(\)\{[\s\S]*?\n\}\n\nfunction renderInvoices\(\)\{/,
    `function updateInvoiceTotals(){\n  window.AvanInvoiceMoney?.project?.();\n}\n\nfunction bindInvoiceLines(){\n  document.querySelectorAll('[data-remove-invoice-line]').forEach(b=>{\n    b.onclick=()=>{\n      b.closest('[data-invoice-line]').remove();\n      document.dispatchEvent(new CustomEvent('avan:ui-changed'));\n      updateInvoiceTotals();\n    };\n  });\n  document.dispatchEvent(new CustomEvent('avan:ui-changed'));\n  updateInvoiceTotals();\n}\n\nfunction renderInvoices(){`,
    'invoice single writer'
  );

  // Invoice validation understands display-unit values; payload remains display and middleware canonicalizes it.
  source = replaceRegexOnce(
    source,
    /function invoiceAmount\(qty,price,discount\)\{[\s\S]*?\n\}/,
    `function invoiceAmount(qty,price,discount){\n  const q=qtyMilli(qty);\n  const p=inputCanonical(price);\n  const d=inputCanonical(discount||'0');\n  if(q===null||q<=0n||p===null||d===null||p<0n||d<0n)return null;\n  const gross=(q*p+500n)/1000n;\n  return d>gross?null:gross-d;\n}`,
    'invoice display validation'
  );
  source = source.replace("if(bi(price)<=0n)\n          return toast(\n            'فی باید بیشتر از صفر باشد'\n          );", "if((inputCanonical(price)??0n)<=0n)\n          return toast(\n            Money.unit()==='rial'&&inputCanonical(price)===null?'فی ریالی باید مضرب ۱۰ باشد.':'فی باید بیشتر از صفر باشد'\n          );");

  // Existing journal canonical values -> display; live totals and submit -> canonical.
  source = replaceRegexOnce(
    source,
    /function lineRow\(l=\{\}\)\{return `<div class="journal-line"[\s\S]*?<button type="button" class="danger small" data-remove-line>×<\/button><\/div>`\}/,
    `function lineRow(l={}){return \`<div class="journal-line" data-line-row><div class="field"><label>حساب</label><select name="account"><option value="">انتخاب حساب…</option>\${accountOptions(l.account_id||'',a=>a.is_active&&a.is_postable)}</select></div><div class="field"><label>طرف‌حساب</label><select name="party">\${partyOptions(l.party_id||'')}</select></div><div class="field"><label>بدهکار (\${Money.unitLabel()})</label><input name="debit" data-money-input="true" inputmode="numeric" value="\${esc(l.debit&&String(l.debit)!=='0'?Money.inputFromCanonical(l.debit):'')}"></div><div class="field"><label>بستانکار (\${Money.unitLabel()})</label><input name="credit" data-money-input="true" inputmode="numeric" value="\${esc(l.credit&&String(l.credit)!=='0'?Money.inputFromCanonical(l.credit):'')}"></div><button type="button" class="danger small" data-remove-line>×</button></div>\`}`,
    'journal display rows'
  );
  source = replaceRegexOnce(
    source,
    /function updateLineTotals\(\)\{const rows=\[\.\.\.document\.querySelectorAll\('\[data-line-row\]'\)\],[\s\S]*?\}\nfunction journalModal/,
    `function updateLineTotals(){const rows=[...document.querySelectorAll('[data-line-row]')];let d=0n,c=0n,complete=0,valid=true;for(const r of rows){const dv=inputCanonical(r.querySelector('[name=debit]').value||'0'),cv=inputCanonical(r.querySelector('[name=credit]').value||'0');if(dv===null||cv===null){valid=false;continue}d+=dv;c+=cv;if(r.querySelector('[name=account]').value&&(dv>0n||cv>0n))complete+=1}Q('lineTotals').innerHTML=\`جمع بدهکار: <b>\${valid?money(d):'نامعتبر'}</b> | جمع بستانکار: <b>\${valid?money(c):'نامعتبر'}</b> | \${valid&&d>0n&&d===c&&complete>=2?'<span class="pos">آماده ثبت قطعی</span>':'<span class="warn">پیش‌نویس — هنوز آماده Post نیست</span>'}\`}\nfunction journalModal`,
    'journal totals boundary'
  );
  source = replaceRegexOnce(
    source,
    /Q\('journalForm'\)\.onsubmit=async ev=>\{ev\.preventDefault\(\);const f=new FormData\(ev\.target\),rawRows=\[\.\.\.document\.querySelectorAll\('\[data-line-row\]'\)\]\.map\(r=>\(\{account_id:r\.querySelector\('\[name=account\]'\)\.value,party_id:r\.querySelector\('\[name=party\]'\)\.value\|\|null,debit:cleanAmount\(r\.querySelector\('\[name=debit\]'\)\.value\)\|\|'0',credit:cleanAmount\(r\.querySelector\('\[name=credit\]'\)\.value\)\|\|'0'\}\)\);for\(const r of rawRows\)\{const d=bi\(r\.debit\),c=bi\(r\.credit\);/,
    "Q('journalForm').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),rawRows=[];for(const row of document.querySelectorAll('[data-line-row]')){const debit=inputCanonical(row.querySelector('[name=debit]').value||'0'),credit=inputCanonical(row.querySelector('[name=credit]').value||'0');if(debit===null||credit===null)return toast('مبلغ بدهکار/بستانکار با واحد انتخاب‌شده سازگار نیست');rawRows.push({account_id:row.querySelector('[name=account]').value,party_id:row.querySelector('[name=party]').value||null,debit:debit.toString(),credit:credit.toString()})}for(const r of rawRows){const d=bi(r.debit),c=bi(r.credit);",
    'journal command boundary'
  );

  // Receipt/payment/transfer command boundary.
  source = replaceRegexOnce(
    source,
    /const amt=\s*cleanAmount\(\s*f\.get\('amount'\)\s*\);([\s\S]*?)if\(bi\(amt\)<=0n\)/,
    "let amt;try{amt=inputCanonicalRequired(f.get('amount'))}catch(err){return toast(err.userMessage||'مبلغ معتبر وارد کنید')}\n\n      $1if(amt<=0n)",
    'operation command boundary'
  );
  source = replaceOnce(source, 'p_amount:\n              amt,', 'p_amount:\n              amt.toString(),', 'operation canonical payload');

  // Labels tell the user which unit an input expects.
  source = source.replace('<label>مبلغ</label><input name="amount" inputmode="numeric" required>', '<label>مبلغ (${Money.unitLabel()})</label><input name="amount" data-money-input="true" inputmode="numeric" required>');
  source = source.replace('<label>مبلغ</label>\n\n          <input\n            name="amount"', '<label>مبلغ (${Money.unitLabel()})</label>\n\n          <input\n            data-money-input="true"\n            name="amount"');

  write('app.js', source);
}

function refactorLegacySettlement() {
  let source = read('rc14-catalog-settlement-v61.js');
  if (source.includes("from './src/ui/money/money-runtime.js'")) return;
  source = source.replace(
    "import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';",
    "import { installAvanCloud } from './src/infrastructure/supabase/avan-cloud-bootstrap.js';\nimport { MoneyRuntime } from './src/ui/money/money-runtime.js';"
  );
  source = source.replace(/const money=v=>`\$\{groupInt\(v\)\} تومان`;/, 'const money=v=>MoneyRuntime.formatCanonical(v);');
  write('rc14-catalog-settlement-v61.js', source);
}

function refactorInventoryOutput() {
  let source = read('rc14-inventory-operations.js');
  if (source.includes("from './src/ui/money/money-runtime.js'")) return;
  source = source.replace(
    "import {installAvanCloud} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';",
    "import {installAvanCloud} from './src/infrastructure/supabase/avan-cloud-bootstrap.js';\nimport {MoneyRuntime} from './src/ui/money/money-runtime.js';"
  );
  source = source.replace(/money=v=>`\$\{Math\.round\(Number\(v\|\|0\)\)\.toLocaleString\('fa-IR'\)\} تومان`/, 'money=v=>MoneyRuntime.formatCanonical(Math.round(Number(v||0)))');
  write('rc14-inventory-operations.js', source);
}

refactorApp();
refactorLegacySettlement();
refactorInventoryOutput();
console.log('Money architecture source refactor applied.');
