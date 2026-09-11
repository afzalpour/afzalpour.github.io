import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/intelligence/dashboard-intelligence-live-polish.js');
const css = read('rc17-dashboard-intelligence-polish.css');
const fixV2 = read('src/ui/intelligence/dashboard-intelligence-live-fix-v2.js');
const fixCssV2 = read('rc17-dashboard-intelligence-live-fix-v2.css');
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
assert.match(fixV2, /منبع\s\*:/);
assert.match(fixV2, /node\.remove\(\)/);
assert.match(fixV2, /پیش‌بینی رویدادهای آینده محسوب نمی‌شود/);

// Risk explanations must expose formulas / data origin instead of only a score or percentage.
assert.match(ui, /بدهی تجاری سررسیدگذشته منهای نقد و بانک فعلی/);
assert.match(ui, /بزرگ‌ترین بدهکار بر کل مطالبات باز/);
assert.match(ui, /بزرگ‌ترین بستانکار تجاری بر کل بدهی تجاری باز/);
assert.match(ui, /چرا این عدد؟/);

// Aging tables: centered and unit-stripped in table cells; continuous controls centered.
assert.match(ui, /avan-aging-centered-table/);
assert.match(ui, /stripMoneyUnit/);
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

// Dashboard numeric overflow: original tables stay safe and primary KPI cards now have their own fit contract.
assert.match(css, /avan-dashboard-polish-table-wrap/);
assert.match(css, /overflow-x:auto/);
assert.match(css, /font-variant-numeric:tabular-nums/);
assert.match(fixV2, /avan-dashboard-primary-kpis/);
assert.match(fixV2, /fitSingleLineValue\(value, 11\)/);
assert.match(fixCssV2, /avan-dashboard-primary-kpi-card\{min-width:0;overflow:hidden\}/);
assert.doesNotMatch(ui + fixV2, /cloud\.(insert|update|delete|rpc)\s*\(/);
assert.doesNotMatch(ui + fixV2, /localStorage|sessionStorage/);

// Shell/PWA wiring and prior regression-sensitive invoice script must remain intact.
assert.match(index, /rc17-dashboard-intelligence-polish\.css/);
assert.match(index, /dashboard-intelligence-live-polish\.js/);
assert.match(index, /rc17-dashboard-intelligence-live-fix-v2\.css/);
assert.match(index, /dashboard-intelligence-live-fix-v2\.js/);
assert.match(index, /rc14-invoice-live-refinements\.js/);
assert.match(sw, /avan-staging-rc1-v107-dashboard-intelligence-live-fix-v2/);
assert.match(sw, /rc17-dashboard-intelligence-live-fix-v2\.css/);
assert.match(sw, /dashboard-intelligence-live-fix-v2\.js/);

console.log('dashboard-intelligence-live-polish.spec.mjs: PASS');
