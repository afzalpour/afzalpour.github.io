# گزارش تست V24-A

## ممیزی ساختاری
- تعداد صفحات عملکردی `.page[id]`: **27**
- همه 27 شناسه اصلی در DOM موجودند.
- `v232-script-live` اکنون یک Script اجرایی مستقل است و دیگر داخل Template چاپ فاکتور قرار ندارد.
- `v24-core-js` در انتهای Body و خارج از Templateها قرار دارد.

## JavaScript Syntax
تمام Scriptهای inline در `index.html` و `demo.html` جداگانه استخراج و با `node --check` بررسی شدند: **PASS**.

## تست Chromium Headless با `page.set_content`
به دلیل Policy محیط، `localhost` با `ERR_BLOCKED_BY_ADMINISTRATOR` مسدود بود؛ بنابراین اجرای Runtime از طریق `set_content` انجام شد.

### Mobile Navigation
Viewport: `390×844`
- Main: نمایش داده شد.
- Dashboard: نمایش داده شد.
- Sidebar پس از لمس Menu: open / visible / pointer-events auto.
- پس از انتخاب Dashboard: کلاس open حذف شد و pointer-events به none برگشت.
- `body.v24-menu-open` پس از بسته‌شدن: false.
- خطای Page/Console در تست: صفر.

### Accounts CRUD
با داده Demo:
- تعداد اولیه: 4
- پس از ایجاد حساب آزمایشی: 5
- فرم Edit مقدار حساب ایجادشده را درست بارگذاری کرد.
- نام حساب ویرایش و در کارت منعکس شد.
- حذف حساب بدون وابستگی موفق بود و تعداد دوباره 4 شد.

### OCR intake
- انتخاب فایل از `ocrFileV232`: Preview به `data:image/...` تبدیل شد.
- Status قبل از OCR: «تصویر آماده است؛ خواندن متن فارسی + English را بزنید.»
- لمس `runOcr` دیگر Silent نیست و وارد مرحله بارگذاری/اجرای موتور می‌شود.
- اجرای واقعی مدل Tesseract در این محیط به دلیل محدودیت CDN قابل تأیید end-to-end نبود.

## نتیجه
V24-A برای Milestone اول تحویل سه‌روزه، Baseline قابل تست است. مرحله بعد باید روی OCR عملیاتی و قرارداد ذخیره داده/Backend تمرکز کند.
