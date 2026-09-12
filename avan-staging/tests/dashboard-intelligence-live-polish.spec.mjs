import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeExactDashboardMetrics } from '../src/ui/intelligence/dashboard-accounting-correctness-hotfix.js';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/intelligence/dashboard-intelligence-live-polish.js');
const css = read('rc17-dashboard-intelligence-polish.css');
const fixV2 = read('src/ui/intelligence/dashboard-intelligence-live-fix-v2.js');
const fixCssV2 = read('rc17-dashboard-intelligence-live-fix-v2.css');
const accountingFix = read('src/ui/intelligence/dashboard-accounting-correctness-hotfix.js');
const index = read('index.html');
const sw = read('sw.js');

// Why-number UX: user-facing Persian, primary amount card, technical details collapsed, noise removed.
assert.match(ui, /شواهد حسابداری/);
assert.match(ui, /مشاهده جزئیات/);
assert.match(ui, /جزئیات محاسبه و شواهد/);
assert.match(ui, /avan-why-amount-card/);
assert.match(ui, /عدد اصلی مستقیماً از RPC گزارش محاسبه می‌شود/);
assert.match(ui, /box\.remove\(\)/);
assert.match(ui, /report_balance_sheet', 'ترازنامه/);

// Live fix v2: the amount card must span the full why-number grid and fit its number instead of breaking it.
assert.match(fixCssV2, /avan-why-amount-card-v2\{grid-column:1\/-1!important/);
assert.match(fixV2, /fitSingleLineValue\(value, 12\)/);
assert.match(fixCssV2, /white-space:nowrap/);

// Business evidence Live polish: fully Persian, one large answer-number card, accounting negatives and Persian account groups.
assert.match(fixV2, /ACCOUNT_CATEGORY_FA/);
for (const label of ['دارایی', 'بدهی', 'حقوق مالکانه', 'درآمد', 'هزینه']) {
  assert.match(fixV2, new RegExp(label));
}
assert.match(fixV2, /Evidence\\b\/g, 'شواهد حسابداری'/);
assert.match(fixV2, /Ledger\\b\/g, 'دفتر کل'/);
assert.match(fixV2, /منبع محاسبه\|حساب‌های مرتبط\|شواهد دفتر کل/);
assert.match(fixV2, /منطق\\s\*:\|بازه\\s\*:/);
assert.match(fixV2, /avan-business-evidence-answer-card/);
assert.match(fixV2, /font-size:clamp\(1\.65rem,5vw,2\.6rem\)/);
assert.match(fixV2, /AvanAccountingNegative\?\.project/);
assert.match(fixV2, /color:var\(--bad,#b23b3b\)!important/);

// Closing a journal opened from why-number / aging returns to the preserved modal DOM.
assert.match(ui, /data-aging-journal/);
assert.match(ui, /data-why-journal/);
assert.match(ui, /DocumentFragment/);
assert.match(ui, /restoreModal/);
assert.match(ui, /modal\.replaceChildren\(fragment\)/);

// Business questions remain deterministic; every suggestion only selects text and requires explicit Analyze submit.
assert.match(ui, /وضعیت مطالبات/);
assert.match(ui, /بیشترین بدهی تجاری/);
assert.match(ui, /وضعیت بدهی‌ها/);
assert.match(ui, /نقدینگی فعلی/);
assert.match(ui, /سود یا زیان دوره/);
assert.match(fixV2, /اولویت‌های ده روز آینده/);
assert.match(fixV2, /TEN_DAY_QUERY/);
assert.match(fixV2, /data-business-example\],\[data-avan-business-question/);
assert.match(fixV2, /stopImmediatePropagation\(\)/);
assert.match(fixV2, /سؤال انتخاب شد\. برای اجرا، دکمه «تحلیل کن» را بزنید/);
assert.match(fixV2, /منبع/);
assert.match(fixV2, /node\.remove\(\)/);
assert.match(fixV2, /پیش‌بینی رویدادهای آینده محسوب نمی‌شود/);

// Ten-day answer must not create a MutationObserver feedback loop by rewriting an identical heading forever.
assert.match(fixV2, /trim\(\) !== 'اولویت‌های ده روز آینده'/);
assert.match(fixV2, /!card\.querySelector\('\[data-avan-ten-day-note\]'\)/);

// Risk explanations must expose formulas / data origin instead of only a score or percentage.
assert.match(ui, /بدهی تجاری سررسیدگذشته منهای نقد و بانک فعلی/);
assert.match(ui, /بزرگ‌ترین بدهکار بر کل مطالبات باز/);
assert.match(ui, /بزرگ‌ترین بستانکار تجاری بر کل بدهی تجاری باز/);
assert.match(ui, /چرا این عدد؟/);

// Aging tables: centered, body units remain de-duplicated, but money unit must be restored explicitly in headers.
assert.match(ui, /avan-aging-centered-table/);
assert.match(ui, /stripMoneyUnit/);
assert.match(fixV2, /activeMoneyUnitLabel/);
assert.match(fixV2, /AvanMoney\?\.unitLabel/);
assert.match(fixV2, /ensureHeaderUnit\(th, 'مبلغ', unit\)/);
assert.match(fixV2, /ensureHeaderUnit\(th, 'مانده باز', unit\)/);
assert.match(fixV2, /ensureHeaderUnit\(th, 'مانده', unit\)/);
assert.match(fixV2, /`\$\{label\} \(\$\{unit\}\)`/);
assert.match(css, /\.avan-aging-centered-table th,.avan-aging-centered-table td\{text-align:center!important/);
assert.match(css, /\.avan-continuous-controls-table th:nth-child\(4\),.avan-continuous-controls-table td:nth-child\(4\)/);

// Continuous controls level and collection priority table must never split labels/names/amounts.
assert.match(fixCssV2, /avan-continuous-controls-table-v2 th:first-child/);
assert.match(fixCssV2, /white-space:nowrap!important;word-break:keep-all!important/);
assert.match(fixV2, /avan-collection-priority-table/);
assert.match(fixV2, /stripMoneyUnit\(table\)/);
assert.match(fixCssV2, /min-width:1120px/);
assert.match(fixCssV2, /nth-child\(2\).*white-space:nowrap/s);
assert.match(fixCssV2, /nth-child\(5\).*white-space:nowrap/s);

// Financial analysis severity words are visually differentiated.
for (const level of ['critical', 'warning', 'attention', 'info', 'healthy']) {
  assert.match(css, new RegExp(`avan-severity-${level}`));
}
assert.match(ui, /\['هشدار', 'warning'\]/);
assert.match(ui, /\['نیازمند توجه', 'attention'\]/);

// Dashboard numeric overflow: original tables stay safe and primary KPI cards have their own fit contract.
assert.match(css, /avan-dashboard-polish-table-wrap/);
assert.match(css, /overflow-x:auto/);
assert.match(css, /font-variant-numeric:tabular-nums/);
assert.match(fixV2, /avan-dashboard-primary-kpis/);
assert.match(fixV2, /fitSingleLineValue\(value, 11\)/);
assert.match(fixCssV2, /avan-dashboard-primary-kpi-card\{min-width:0;overflow:hidden\}/);
assert.doesNotMatch(ui + fixV2, /cloud\.(insert|update|delete|rpc)\s*\(/);
assert.doesNotMatch(ui + fixV2, /localStorage|sessionStorage/);

// Accounting correctness: decimal canonical Toman from report RPCs must remain one-Rial exact.
const exact = computeExactDashboardMetrics({
  balance: [
    { category: 'asset', amount: '74082141.5' },
    { category: 'liability', amount: '-96000481.1' }
  ],
  profitLoss: [
    { category: 'income', amount: '177178123.1' },
    { category: 'expense', amount: '11595500.5' }
  ],
  cash: [{ amount: '-102329664.8' }]
});
assert.equal(exact.assets, '74082141.5');
assert.equal(exact.liabilities, '-96000481.1');
assert.equal(exact.cash, '-102329664.8');
assert.equal(exact.profit, '165582622.6');
assert.equal(exact.profitTenths, 1655826226n);
assert.match(accountingFix, /canonicalDecimalToTenths/);
assert.match(accountingFix, /canonicalTenthsToDecimal/);
assert.match(accountingFix, /why\.dataset\.whyAmount = canonical/);
assert.match(accountingFix, /report_profit_loss/);
assert.match(accountingFix, /report_balance_sheet/);
assert.match(accountingFix, /report_cash_bank_balances/);
assert.match(accountingFix, /buildPartyAging/);
assert.match(accountingFix, /buildFinancialCopilotSnapshot/);
assert.match(accountingFix, /buildRiskAuditSnapshot/);
assert.match(accountingFix, /workspace_id=eq\.\$\{workspaceId\}/);
assert.match(accountingFix, /writeOperations: 0/);
assert.doesNotMatch(accountingFix, /\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage/);

// Shell/PWA wiring and prior regression-sensitive invoice script must remain intact.
assert.match(index, /rc17-dashboard-intelligence-polish\.css/);
assert.match(index, /dashboard-intelligence-live-polish\.js/);
assert.match(index, /rc17-dashboard-intelligence-live-fix-v2\.css/);
assert.match(index, /dashboard-intelligence-live-fix-v2\.js/);
assert.match(index, /dashboard-accounting-correctness-hotfix\.js/);
assert.match(index, /rc14-invoice-live-refinements\.js/);
const cacheVersion = Number(sw.match(/const CACHE='avan-staging-rc1-v(\d+)-/)?.[1] || 0);
assert.ok(cacheVersion >= 110,
  'Staging cache identity must not regress below the v110 fresh-runtime delivery milestone');
assert.match(sw, /new Request\(new URL\(asset,self\.registration\.scope\),\{cache:'reload'\}\)/,
  'install-time precache must keep fetching fresh runtime assets');
assert.match(sw, /new Request\(request,\{cache:'reload'\}\)/,
  'runtime fetches must keep crossing the browser HTTP-cache boundary');
assert.match(sw, /client\.navigate\(client\.url\)/,
  'activation must move open clients to the active service-worker runtime');
assert.match(sw, /dashboard-accounting-correctness-hotfix\.js/);
assert.match(sw, /dashboard-intelligence-live-fix-v2\.js/);

console.log('dashboard-intelligence-live-polish.spec.mjs: PASS');
