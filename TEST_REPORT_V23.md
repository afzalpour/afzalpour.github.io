# گزارش تست V23

## بررسی‌های انجام‌شده
- `demo.html` و `index.html`: تمام اسکریپت‌های Inline با `node --check` بررسی شدند؛ Syntax Error = 0.
- تعداد صفحات ثبت‌شده در معماری V22/V23: 27 بخش.
- Sidebar با CSS صریح در `grid-area: sidebar` و ستون سمت راست تثبیت شده است.
- Dashboard V23 از داده‌های واقعی State برای KPI، ریتم هزینه، آخرین تراکنش‌ها، Attention و Budget استفاده می‌کند.
- Command Palette و میانبر Ctrl/Cmd+K حفظ شده است.
- حالت Personal/Company و فیلتر دسترسی صفحات از V22.1 دست‌نخورده باقی مانده است.
- Bottom Navigation موبایل V19+ حفظ شده و V23 فقط Skin بصری آن را هماهنگ می‌کند.
- Cache سرویس‌ورکر به `hesabyar-v23-shell-1` تغییر داده شد؛ Background Sync tag همان `hesabyar-cloud-sync` باقی ماند.

## محدودیت محیط تست
Chromium CLI در این محیط به دلیل مشکل سرویس Headless/DBus خروجی Screenshot تولید نکرد؛ بنابراین تأیید Runtime تصویری با مرورگر در این مرحله قابل انجام نبود. تست Syntax، ساختار DOM/CSS و مسیرهای تابعی به‌صورت استاتیک انجام شده‌اند.
