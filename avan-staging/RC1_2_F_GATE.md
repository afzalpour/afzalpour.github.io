# Gate RC1.2-F — Mobile / iPhone Final UX Regression

هدف: تایید نهایی تجربه موبایل/iPhone بدون تغییر در Ledger، RLS یا منطق مالی.

## قبل از تست
- روی Staging یک Hard Refresh انجام شود.
- اگر آوان به Home Screen اضافه شده، یک‌بار نسخه PWA نیز بسته و دوباره باز شود.
- ترجیحاً حداقل یک iPhone/Safari واقعی تست شود.

## F-1 — Shell / Safe Area / Bottom Navigation
1. داشبورد را در حالت Portrait باز کنید.
2. Topbar نباید زیر Notch/Dynamic Island یا نوار بالای Safari برود.
3. Bottom Navigation نباید با Home Indicator تداخل داشته باشد.
4. بین خانه، حساب‌ها، گزارش و تنظیمات جابه‌جا شوید؛ Bottom Nav باید ثابت و قابل لمس بماند.
5. صفحه نباید Horizontal Scroll ناخواسته داشته باشد.

PASS: هدر، محتوا و Bottom Nav در Safe Area صحیح و پایدار هستند.

## F-2 — Inputs / Forms / Keyboard
1. یک فرم دریافت/پرداخت یا فاکتور Draft باز کنید.
2. روی فیلد مبلغ، تاریخ، شرح و Selectها فوکوس کنید.
3. Safari هنگام Focus نباید Zoom ناخواسته روی صفحه انجام دهد.
4. با باز و بسته شدن Keyboard، Modal/Form نباید از Viewport خارج یا غیرقابل استفاده شود.
5. دکمه‌های اصلی باید Touch target مناسب داشته باشند.

PASS: فرم‌ها بدون Focus Zoom و بدون گیرکردن زیر Keyboard قابل استفاده‌اند.

## F-3 — Invoice / Journal
1. فاکتور Draft را روی موبایل باز کنید.
2. خطوط فاکتور، مبلغ، تخفیف و جمع را بررسی کنید.
3. یک سند حسابداری Draft را باز کنید.
4. خطوط بدهکار/بستانکار و دکمه‌های عملیاتی را بررسی کنید.
5. هیچ فیلدی نباید از Card بیرون بزند یا غیرقابل لمس شود.

PASS: Invoice/Journal در عرض موبایل قابل ثبت و بازبینی هستند.

## F-4 — Wide Financial Tables
1. حساب‌ها، فاکتورها، اسناد حسابداری و یک گزارش جدولی را باز کنید.
2. جدول عریض را افقی Scroll کنید.
3. Scroll باید نرم باشد و کل صفحه را به چپ/راست نکشد.
4. اعداد و ستون‌های مالی نباید روی هم بیفتند.

PASS: جدول‌ها ساختار خود را حفظ می‌کنند و Scroll افقی کنترل‌شده دارند.

## F-5 — Modals
1. Modal ثبت سریع/دریافت/پرداخت یا یک فرم Detail را باز کنید.
2. Modal باید داخل Dynamic Viewport جا شود.
3. محتوای بلند باید داخل خود Modal Scroll شود.
4. باز/بسته کردن Modal نباید Bottom Nav یا صفحه را به وضعیت خراب ببرد.

PASS: Modalها روی Safari/iPhone پایدارند.

## F-6 — Smart Documents Viewer
1. یک تصویر و یک PDF را باز کنید.
2. Zoom/Rotate و برای PDF جابه‌جایی صفحه را تست کنید.
3. Viewer نباید از Viewport بیرون بزند.
4. Stage باید قابل Pan/Scroll باشد.
5. Download/Print Original همچنان در دسترس باشد.

PASS: Viewer روی موبایل قابل استفاده و پایدار است.

## F-7 — Company Print Identity
1. تنظیمات → هویت شرکت در چاپ را باز کنید.
2. Preview، فیلدها و Upload لوگو را بررسی کنید.
3. متن‌های بلند مثل آدرس نباید Layout را بشکنند.
4. دکمه ذخیره باید کامل دیده و قابل لمس باشد.

PASS: Company Profile روی موبایل قابل ویرایش است.

## F-8 — Print / Export Regression
1. یک فاکتور یا سند را باز و Print/PDF را اجرا کنید.
2. یک گزارش را CSV بگیرید.
3. بررسی کنید تغییرات Mobile CSS خروجی چاپ را تغییر نداده باشد.

PASS: Print/Export قبلی بدون Regression باقی مانده است.

## نتیجه Gate
اگر همه موارد بالا درست بود، عبارت زیر را اعلام کنید:

`Gate RC1.2-F پاس شد`

تا قبل از اعلام صریح کاربر، RC1.2-F PASS محسوب نمی‌شود.
