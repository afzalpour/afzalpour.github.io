import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const ui = read('src/ui/intelligence/dashboard-intelligence-live-polish.js');
const css = read('rc17-dashboard-intelligence-polish.css');
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

// Closing a journal opened from why-number / aging returns to the preserved modal DOM.
assert.match(ui, /data-aging-journal/);
assert.match(ui, /data-why-journal/);
assert.match(ui, /DocumentFragment/);
assert.match(ui, /restoreModal/);
assert.match(ui, /modal\.replaceChildren\(fragment\)/);

// Business questions are expanded only with intents supported by the current deterministic copilot.
assert.match(ui, /وضعیت مطالبات/);
assert.match(ui, /بیشترین بدهی تجاری/);
assert.match(ui, /وضعیت بدهی‌ها/);
assert.match(ui, /نقدینگی فعلی/);
assert.match(ui, /سود یا زیان دوره/);
assert.match(ui, /مهم‌ترین اولویت‌ها/);

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

// Financial analysis severity words are visually differentiated.
for (const level of ['critical', 'warning', 'attention', 'info', 'healthy']) {
  assert.match(css, new RegExp(`avan-severity-${level}`));
}
assert.match(ui, /\['هشدار', 'warning'\]/);
assert.match(ui, /\['نیازمند توجه', 'attention'\]/);

// Dashboard numeric overflow is handled without mutating accounting values.
assert.match(css, /avan-dashboard-polish-table-wrap/);
assert.match(css, /overflow-x:auto/);
assert.match(css, /font-variant-numeric:tabular-nums/);
assert.doesNotMatch(ui, /cloud\.(insert|update|delete|rpc)\s*\(/);
assert.doesNotMatch(ui, /localStorage|sessionStorage/);

// Shell/PWA wiring and prior regression-sensitive invoice script must remain intact.
assert.match(index, /rc17-dashboard-intelligence-polish\.css/);
assert.match(index, /dashboard-intelligence-live-polish\.js/);
assert.match(index, /rc14-invoice-live-refinements\.js/);
assert.match(sw, /avan-staging-rc1-v106-dashboard-intelligence-polish/);
assert.match(sw, /rc17-dashboard-intelligence-polish\.css/);
assert.match(sw, /dashboard-intelligence-live-polish\.js/);

console.log('dashboard-intelligence-live-polish.spec.mjs: PASS');
