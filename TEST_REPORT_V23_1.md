# گزارش تست حساب‌یار V23.1

## موبایل — 390×844
- تست واقعی با Playwright و Chromium انجام شد.
- Sidebar در موبایل `position: fixed` است و از جریان صفحه خارج شده است.
- Main از مختصات `y=0` شروع می‌شود؛ دیگر یک viewport خالی قبل از محتوا ایجاد نمی‌شود.
- Topbar از `y=0` و Dashboard از حدود `y=139` نمایش داده شد.
- Dashboard در حالت فعال `display:block` و ارتفاع واقعی حدود 1766px داشت.
- `body.scrollWidth = 390` برای viewport 390؛ Overflow افقی وجود ندارد.
- Bottom Navigation پنج‌گزینه‌ای نمایش داده شد.
- Page Error / Runtime Error: صفر.

## آیکون‌ها
- Icon Registry جدید SVG مستقل از CSS قدیمی است.
- SVG دارای `fill="none"`, `stroke="currentColor"`, `stroke-width`, `linecap`, `linejoin`, `width` و `height` صریح است.
- حالت شخصی: 21 فرمان و 21 آیکون.
- حالت شرکتی: 27 فرمان و 27 آیکون؛ هیچ مقصدی بدون SVG نیست.
- آیکون‌های جدید/تکمیل‌شده: mobile، bank، inventory، smart و بقیه فرمان‌های Sidebar.
- در تست دسکتاپ، Sidebar دقیقاً به لبه راست viewport چسبیده بود (`right = 0`).
- Stroke آیکون Active در تست واقعی مقدار قابل مشاهده داشت (`rgb(44, 42, 102)`).

## علت باگ V23
1. Sidebar روی موبایل به دلیل تداخل CSS نسخه‌های قبلی عملاً `sticky` باقی مانده بود و با ارتفاع 100vh فضای یک صفحه کامل را پیش از Main اشغال می‌کرد.
2. `renderDashboardV23()` با `className` کلاس‌های پایه SPA را بازنویسی می‌کرد.
3. Iconها برای Stroke به CSS نسل‌های قبلی وابسته بودند.

## اصلاح V23.1
- Mobile Shell مستقل و صریح.
- حفظ کلاس‌های `page` و `active` Dashboard.
- هماهنگی `#sidebar.open` و `.app.menu-open`.
- Registry واحد SVG.
- Service Worker جدید با cache key `hesabyar-v23-1-cache` برای حذف Cache نسل‌های قبلی.
