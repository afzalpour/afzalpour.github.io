# حساب‌یار V21

## Voice reliability
- مدیریت اختصاصی خطاهای `service-not-allowed`, `not-allowed`, `network` و `language-not-supported`.
- مسیر جایگزین فرمان متنی با همان موتور Intent هنگامی که Speech Recognition گوشی/PWA در دسترس نیست.
- تست مستقل دسترسی میکروفن برای تفکیک مشکل Permission از مشکل Speech Service.
- وضعیت واضح گفتار داخل Copilot.

## OCR reliability
- جدا شدن «گرفتن عکس» از «آپلود تصویر»؛ آپلود از Gallery/Files دیگر به `capture` وابسته نیست.
- OCR دقیقاً روی همان Data URL پیش‌نمایش‌شده اجرا می‌شود، نه صرفاً `input.files[0]`.
- Lazy loading موتور OCR با fallback بین jsDelivr و unpkg.
- fallback جدا برای Worker/Core/Language data.
- پیش‌پردازش خودکار تصویر (resize + grayscale/contrast) و امکان استفاده از تصویر اصلی.
- امکان چرخش تصویر قبل از OCR.
- Diagnostic واضح برای تصویر، موتور OCR و اتصال اینترنت.
- دکمه تست موتور OCR و پیام خطای قابل فهم.

## PWA
- Cache version به V21 ارتقا یافت تا Service Worker قدیمی رابط جدید را نگه ندارد.
