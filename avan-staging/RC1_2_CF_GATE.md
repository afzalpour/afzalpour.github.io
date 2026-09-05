# RC1.2-CF — Smart Documents Viewer + OCR Freeze Gate

## Scope
این Gate به‌جای ادامه Tuning پرریسک OCR، Viewer و جریان بازبینی دستی را به‌عنوان مسیر قابل‌اعتماد نگه می‌دارد و OCR مرورگری را از Workflow اصلی خارج می‌کند.

## CF1 — Smart Documents page
1. Staging را Hard Refresh کنید.
2. «اسناد هوشمند» را باز کنید.
3. دکمه «استخراج هوشمند» نباید در ردیف‌های Upload شده دیده شود.
4. پیام غیرفعال بودن استخراج خودکار و فعال بودن مشاهده/بازبینی دستی باید دیده شود.

## CF2 — Original viewer
1. روی «مشاهده اصل سند» برای JPG/PNG/WEBP بزنید.
2. فایل باید داخل Viewer آوان نمایش داده شود.
3. Zoom، Fit، Rotate و «باز کردن اصل فایل» باید کار کنند.
4. تصویر نباید crop یا stretch غیرعادی داشته باشد.

## CF3 — PDF viewer
1. یک PDF موجود را باز کنید.
2. PDF باید با Viewer داخلی/PDF.js رندر شود.
3. صفحه قبل/بعد، Zoom و Rotate باید کار کنند.
4. اصل فایل همچنان از Signed URL قابل باز شدن باشد.

## CF4 — Manual review remains active
1. روی «بازبینی دستی» بزنید.
2. تاریخ، مبلغ، طرف‌حساب، حساب و شرح باید قابل تکمیل/اصلاح باشند.
3. ذخیره بازبینی باید همان جریان قبلی را حفظ کند.
4. سند Reviewed باید همچنان بتواند پیش‌نویس حسابداری بسازد.

## CF5 — Existing extracted documents
- اسنادی که قبلاً OCR شده‌اند نباید حذف یا خراب شوند.
- مقدارهای قبلی قابل مشاهده/بازبینی بمانند.

## CF6 — Financial safety regression
- هیچ سندی از مسیر Smart Documents مستقیم Posted نشود.
- Human Review حفظ شود.
- فایل اصل خصوصی بماند.
- Ledger/RLS/Journal lifecycle تغییری نکرده باشد.

## Pass phrase
`Gate RC1.2-CF پاس شد`

## Decision
OCR browser-local طبق ADR-0013 فعلاً Freeze است. گام بعدی RC1.2-D Print & Export Center است.
