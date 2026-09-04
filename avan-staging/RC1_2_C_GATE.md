# RC1.2-C — Smart Document Viewer + OCR Reliability Gate

## Scope
این Gate فقط اسناد هوشمند را اصلاح می‌کند و مطابق ADR-0009 است.

Pipeline حفظ‌شده:
`Upload → Private Storage → Viewer → OCR → Structured Extraction → Human Review → Accounting Draft → Ledger Link`

هیچ OCR نتیجه‌ای مستقیم Posted نمی‌شود.

## تغییرات

### Viewer تصویر
- نمایش تصویر با نسبت واقعی.
- احترام به orientation/EXIF مرورگر.
- Zoom in/out.
- Rotate دستی.
- Fit.
- امکان باز کردن اصل فایل با Signed URL موقت.

### Viewer PDF
- دیگر متکی به iframe مرورگر نیست.
- PDF.js فایل را از Signed URL خوانده و روی Canvas رندر می‌کند.
- صفحه قبل/بعد.
- Zoom.
- Rotate.
- HiDPI rendering.

### OCR v2
- برای PDF ابتدا embedded text بررسی می‌شود؛ اگر PDF متن واقعی داشته باشد OCR تصویری بی‌دلیل اجرا نمی‌شود.
- PDF اسکن‌شده با PDF.js به Canvas تبدیل و سپس OCR می‌شود.
- تصاویر با orientation-aware decode آماده می‌شوند.
- grayscale + contrast stretch.
- Otsu threshold pass.
- Tesseract فارسی + انگلیسی با دو layout pass برای تصویر.
- تاریخ/مبلغ از متن‌های critical جدا می‌شوند و همچنان در Human Review کنترل می‌شوند.
- اصل فایل تغییر نمی‌کند.

## Live Gate

### C1 — تصویر
1. اسناد هوشمند → یک JPG/PNG/WEBP موجود را «مشاهده» کنید.
2. تصویر باید کامل، بدون کشیدگی و با جهت صحیح دیده شود.
3. بزرگ‌نمایی/کوچک‌نمایی و چرخش را تست کنید.
4. روی iPhone Safari نیز Viewer نباید تصویر را crop یا deform کند.

### C2 — PDF
1. یک PDF را مشاهده کنید.
2. PDF باید داخل Viewer آوان رندر شود.
3. اگر چندصفحه‌ای است صفحه قبل/بعد کار کند.
4. Zoom و Rotate کار کنند.

### C3 — OCR تصویر
1. یک سند تصویر با متن/عدد فارسی آپلود کنید.
2. «استخراج هوشمند» را بزنید.
3. Progress باید قابل مشاهده باشد.
4. پس از تکمیل، صفحه Refresh می‌شود و وضعیت سند «استخراج شده» باشد.
5. بازبینی را باز کنید و تاریخ/مبلغ/شماره/شرح را با اصل فایل مقایسه کنید.
6. در صورت خطای OCR، ثبت قطعی خودکار نباید انجام شده باشد.

### C4 — OCR PDF
- یک PDF text-based: استخراج باید سریع‌تر و بدون OCR تصویری غیرضروری انجام شود.
- یک PDF اسکن‌شده: باید از مسیر render → OCR عبور کند.

### C5 — Human Control
1. نتیجه استخراج را بازبینی کنید.
2. فیلدهای اشتباه باید قابل اصلاح باشند.
3. تا «تأیید بازبینی»/مراحل بعدی کاربر انجام نشده، هیچ سند Posted جدیدی نباید ساخته شود.

### C6 — Regression
- Dashboard باز شود.
- فاکتورها باز شوند.
- اسناد حسابداری باز شوند.
- Reports باز شوند.
- Money/Currency رفتار قبلی حفظ شده باشد.

## PASS criterion
Gate فقط زمانی PASS است که کاربر Live اعلام کند:

`Gate RC1.2-C پاس شد`
