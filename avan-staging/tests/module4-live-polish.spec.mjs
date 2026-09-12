import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const read = path => readFileSync(join(root, path), 'utf8');

const workspace = read('src/ui/intelligence/continuous-close-audit-workspace.js');
assert.ok(workspace.includes('کنترل مستمر بستن دوره و حسابرسی'));
assert.ok(workspace.includes('کل موارد نیازمند بررسی'));
assert.ok(workspace.includes('فهرست موارد نیازمند بررسی'));
assert.ok(workspace.includes('کنترل‌های یکپارچگی، ثبت‌های مشابه، مغایرت‌ها و ناهنجاری‌ها'));
assert.ok(workspace.includes('هشدار ثبت مشابه یا رفتار غیرعادی'));
assert.ok(!workspace.includes('Continuous Close + Continuous Audit'));
assert.ok(!workspace.includes('کنترل باز برای Close'));
assert.ok(!workspace.includes('Exception کل'));
assert.ok(!workspace.includes('<h2>Exception Register</h2>'));
assert.ok(workspace.includes('data-avan-money-unit-badge="suppress"'));
assert.ok(workspace.includes('data-cca-evidence-body'));

const evidenceStart = workspace.indexOf('async function evidenceModal');
const evidenceEnd = workspace.indexOf('\nfunction bindPageActions', evidenceStart);
assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart);
const evidenceBody = workspace.slice(evidenceStart, evidenceEnd);
assert.equal((evidenceBody.match(/openModal\(/g) || []).length, 1, 'Evidence modal must open once and update in place.');

const moneyOutput = read('src/ui/money/money-output-contract.js');
assert.ok(moneyOutput.includes('function directUnitBadges'));
assert.ok(moneyOutput.includes('badges.forEach(node => node.remove())'));
assert.ok(moneyOutput.includes('data-avan-money-unit-badge="suppress"'));

const vatCss = read('rc15-tax-ux.css');
assert.ok(vatCss.includes('.rc15-vat-report .table-wrap'));
assert.ok(vatCss.includes('overflow-x:auto'));
assert.ok(vatCss.includes('max-width:100%'));

const print = read('src/ui/intelligence/intelligence-print-export.js');
for (const title of ['برج کنترل مالی', 'دوقلوی مالی', 'مرکز سرمایه در گردش', 'بستن و حسابرسی پیوسته']) {
  assert.ok(print.includes(`'${title}'`), `Print/PDF support missing for ${title}`);
}
assert.ok(print.includes('AvanPrintExport'));
assert.ok(print.includes('function intelligencePrintSource(content)'));
assert.ok(print.includes('.avan-working-capital-date-form,.avan-cca-date-form'));
assert.ok(print.includes('replacement.textContent = `تا تاریخ: ${visibleDate}`'));
assert.ok(print.includes('printElement(intelligencePrintSource(content), title)'));

const printBoundary = read('rc12-print-export.js');
assert.ok(printBoundary.includes("Intl.DateTimeFormat('fa-IR-u-ca-persian'"), 'Print/PDF header date must use explicit Persian calendar.');
assert.ok(!printBoundary.includes("Intl.DateTimeFormat('fa-IR', {\n    dateStyle: 'medium'"), 'Ambiguous fa-IR print date formatter must not return.');

const module4Css = read('module4-continuous-close-audit.css');
assert.ok(module4Css.includes('.avan-working-capital-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important'), 'Working Capital desktop KPI layout must remain 4 columns (4+3 for seven cards).');
assert.ok(module4Css.includes('@media(max-width:900px){.avan-working-capital-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important'), 'Working Capital responsive two-column guard must remain.');
assert.ok(module4Css.includes('@media(max-width:560px){.avan-working-capital-grid{grid-template-columns:1fr!important'), 'Working Capital mobile single-column guard must remain.');

const module4 = read('src/ui/intelligence/continuous-close-audit-workspace.js');
assert.ok(module4.includes("import './intelligence-print-export.js';"), 'Module 4 bootstrap must load unified intelligence Print/PDF controls.');

const sw = read('sw.js');
assert.ok(sw.includes('avan-staging-rc1-v115-module4-print-jalali-single-date'));

console.log('Module 4 Live polish regression PASS');
