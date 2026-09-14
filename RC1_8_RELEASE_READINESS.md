# AVAN — RC1.8 Release Readiness / Production Closure

Status: **CLOSED — Production Live PASS**

Date: **2026-09-14**

این سند ابتدا برای کنترل آمادگی ارتقای RC1.8 ایجاد شد و اکنون به‌عنوان رکورد نهایی آمادگی، ارتقا و پذیرش عملیاتی RC1.8 نگهداری می‌شود.

## محدوده انتشار

قابلیت‌های پذیرفته‌شده این انتشار:
- **بستن مستمر حساب‌ها و ممیزی مستمر**.
- **رادار انطباق ایران**.
- **کنترل هوشمند خرید و هزینه**.
- **اتصال و بازار اتوماسیون آوان**.

مبنای runtime آماده‌سازی:
- frozen accepted Staging runtime merge = `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- Source-of-Truth closure merge = `6dc872e98124c4312f2c2462a192c46a6098c662`.
- accepted Staging cache = `avan-staging-rc1-v121-module9-live-layout-polish`.
- pre-promotion rollback branch = `prod-backup-20260914-rc1-8-pre-promotion`.

## پذیرش قابلیت‌ها در محیط آماده‌سازی

### بستن مستمر حساب‌ها و ممیزی مستمر
- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] Read-only intelligence؛ بدون mutation پنهان دفتر کل.
- [x] شواهد قابل‌خواندن و خروجی تاریخ جلالی پذیرفته شد.

### رادار انطباق ایران
- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] مهلت قانونی جعلی تولید نمی‌شود.
- [x] حقوق و بیمه بدون منبع حقیقت معتبر خارج از پوشش اعلام می‌شوند.
- [x] قرارداد فارسی‌سازی ADR-0025 برقرار است.

### کنترل هوشمند خرید و هزینه
- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] تطبیق خرید/رسید، تشخیص استفاده مجدد از رسید، اختلاف مقدار/قیمت و کنترل موجودی/تأمین‌کننده پذیرفته شد.
- [x] درخواست خرید، سفارش خرید، بودجه، گردش تأیید و پرداخت تا زمان وجود منبع حقیقت معتبر خارج از دامنه‌اند.
- [x] استفاده Live در محیط آماده‌سازی mutation-free باقی ماند.

### اتصال و بازار اتوماسیون آوان
- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] اصلاح نهایی چیدمان با نشانگر **«چیدمان ماژول ۹ نهایی PASS»** در تاریخچه پذیرفته شد.
- [x] registry/marketplace/preview وضعیت واقعی اتصال‌دهنده‌ها را نشان می‌دهند.
- [x] اجرای workflow، تغییر اتصال و financial write در Foundation v1 غیرفعال باقی ماند.
- [x] مرز idempotency/audit/human-approval تحت ADR-0026 حفظ شد.

## Gateهای runtime آماده‌سازی

- [x] Architecture Gate #317 = PASS.
- [x] Architecture Gate #318 = PASS.
- [x] GitHub Pages #429 = PASS.
- [x] Source-of-Truth closure Pages #430 = PASS.
- [x] PWA precache integrity در Architecture Gate پوشش داده شد.
- [x] Runtime Parity تحت ADR-0024 پوشش داده شد.
- [x] Persian presentation تحت ADR-0025 پوشش داده شد.
- [x] canonical Toman / one-Rial precision regression در gate کامل حفظ شد.

## ارتقای کنترل‌شده به محیط عملیاتی

- [x] rollback branch پیش از ارتقا freeze شد: `prod-backup-20260914-rc1-8-pre-promotion`.
- [x] controlled Staging → Production runtime diff ساخته شد.
- [x] Production-only configuration/secrets boundary حفظ شد.
- [x] Staging-only tooling/tests/scripts/runtime-divergence metadata وارد محیط عملیاتی نشد.
- [x] Production Service Worker به `avan-prod-rc1-8-v1` ارتقا یافت.
- [x] Production Release Gate پیش از merge اجرا شد.
- [x] تأیید صریح کاربر دریافت شد: **«RC1.8 Production Promotion APPROVED»**.
- [x] PR #189 merge شد؛ Production merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- [x] pre-merge Architecture Gate #322 = PASS.
- [x] pre-merge Production Release Gate #25 = PASS.
- [x] post-merge Architecture Gate #323 = PASS.
- [x] post-merge Production Release Gate #26 = PASS.
- [x] GitHub Pages #432 = PASS.

## مرزهای حفظ‌شده در ارتقا

- [x] `config.js` محیط عملیاتی با تنظیمات محیط آماده‌سازی جایگزین نشد.
- [x] هیچ migration پایگاه داده‌ای صرفاً برای این چهار قابلیت وارد نشد.
- [x] هیچ connector credential یا Service Role secret به مرورگر منتقل نشد.
- [x] ثبت، پرداخت، تأیید یا ارسال بیرونی خودکار فعال نشد.
- [x] generic external execution در اتصال و بازار اتوماسیون آوان غیرفعال باقی ماند.

## آزمون نهایی محیط عملیاتی

- [x] کاربر آزمون تجربه کاربری احراز هویت‌شده محیط عملیاتی را انجام داد.
- [x] نشانگر صریح پذیرش = **«RC1.8 Production Smoke UX PASS»**.
- [x] چهار قابلیت پذیرفته‌شده در محیط عملیاتی بازبینی شدند.
- [x] مسیرهای نمایش/تاریخ/چاپ/پیش‌نمایش بدون فعال‌شدن mutation ناخواسته پذیرفته شدند.
- [x] refresh و بارگذاری مجدد runtime پذیرفته شد.

## تأیید نهایی فقط‌خواندنی پایگاه داده پس از آزمون عملیاتی

- [x] journal_entries = **94**؛ latest `2026-09-12 19:32:07.685779+00`.
- [x] financial_transactions = **24**؛ latest `2026-09-10 21:16:55.697626+00`.
- [x] invoices = **42**؛ latest `2026-09-10 16:37:20.676074+00`.
- [x] documents = **23**؛ latest `2026-09-07 21:11:31.272166+00`.
- [x] inventory_documents = **9**؛ latest `2026-09-07 12:44:33.272324+00`.
- [x] orphan journal lines = **0**.
- [x] cross-workspace journal-line mismatch = **0**.
- [x] unbalanced Posted journals = **0**.
- [x] orphan invoice lines = **0**.
- [x] cross-workspace invoice-line mismatch = **0**.
- [x] journal lines with fractional Toman = **42**؛ دقت یک‌ریالی حفظ شد.
- [x] effective public anon/auth `SECURITY DEFINER` exposure = **0**.
- [x] شمار رکوردها و latest timestampها با baseline پیش از آزمون عملیاتی یکسان ماندند.
- [x] financial mutation ناخواسته = **none detected**.

## نتیجه نهایی انتشار

**RC1.8 = Production Live PASS / CLOSED.**

هیچ Live Gate معوقی برای RC1.8 باقی نمانده است. `AVAN_CURRENT_STATE.md` باید RC1.8 را به‌عنوان نسخه عملیاتی جاری و بسته‌شده نگهداری کند. قطار بعدی فقط پس از انتخاب Requirement/Backlog/ADR بعدی آغاز می‌شود.
