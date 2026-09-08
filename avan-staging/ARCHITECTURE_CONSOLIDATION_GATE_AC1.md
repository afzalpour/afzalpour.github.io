# AVAN — Architecture Consolidation Gate AC-1

Date: 2026-09-08  
Status: **IN PROGRESS**

## هدف

کاهش coupling و patch-on-patch در Frontend بدون Rewrite و بدون تغییر رفتار مالی Live-PASS.

این Gate تحت `ADR-0016` و `docs/architecture/AVAN_MIGRATION_MAP_V1.md` اجرا می‌شود.

## Baseline واقعی

- Production/Stage `index.html` تقریباً 7.8 KB است؛ monolithic 500KB index در Runtime فعلی وجود ندارد.
- `app.js` تقریباً 108 KB است و هنوز Compatibility Shell اصلی است.
- `demo.html` فایل Legacy/نمایشی بزرگ (~689 KB) است و Runtime اصلی Production نیست.
- Runtime فعلی تعداد زیادی فایل `rc11/rc12/rc13/rc14` دارد؛ نام نسخه‌ای و interaction بین این فایل‌ها بخشی از Technical Debt است.
- patch مستقیم client method و MutationObserverهای گسترده هنوز در بعضی compatibility moduleها وجود دارند.

## اقدامات AC-1

### AC1.1 — Explicit operation composition
- [x] ایجاد `src/core/runtime/operation-pipeline.js`.
- [x] pipeline دارای middleware ID، priority، single-next rule و diagnostics است.
- [x] pipeline در `installAvanCloud()` نصب می‌شود.
- [x] در Migration mode، overwriteهای Legacy قابل تشخیص هستند ولی هنوز hard-fail نمی‌شوند.

### AC1.2 — First legacy patch migration
- [x] `rc14-invoice-inventory-ui.js` دیگر `C.rpc` را overwrite نمی‌کند.
- [x] invoice/inventory enrichment به `rc14.invoice-inventory-bridge` middleware منتقل شد.
- [x] reverse-journal → reverse-invoice routing داخل pipeline با ترتیب صریح انجام می‌شود.
- [x] MutationObserver داخلی ردیف‌های invoice حذف شد؛ افزودن ردیف از event صریح دکمه انجام می‌شود.

### AC1.3 — Tests / diagnostics
- [x] `tests/operation-pipeline.spec.mjs` بدون dependency خارجی اضافه شد.
- [x] تست pipeline به‌صورت محلی با Node PASS شد.
- [x] `scripts/architecture-audit.mjs` برای گزارش overwrite و MutationObserver اضافه شد.
- [ ] audit کامل تمام runtime moduleها و ثبت baseline count.

### AC1.4 — Remaining known debt
- [ ] انتقال `rc15-tax-ux-v3.js` از direct `C.rpc/C.insert/C.update` overwrite به Operation Pipeline.
- [ ] تعریف lifecycle/event صریح برای render/page/modal و حذف نیاز Tax UX به body-wide MutationObserver.
- [ ] استخراج pure invoice/tax calculations به Domain modules.
- [ ] کاهش تدریجی مسئولیت `app.js` طبق Migration Map.
- [ ] تبدیل نام‌گذاری release-based به responsibility-based برای کد جدید؛ Legacy wrapperها فقط تا Gate مهاجرت باقی بمانند.

## Performance / quality rules از این Gate به بعد

1. Feature جدید نباید direct client monkey-patch ایجاد کند.
2. Feature جدید نباید body-wide MutationObserver اضافه کند مگر با Evidence ضرورت.
3. Business calculation جدید باید Pure و قابل Unit Test باشد.
4. هر Data access جدید باید در مسیر Repository/Adapter حرکت کند.
5. هر module باید ownership مشخص داشته باشد.
6. تغییرات Production فقط بعد از Staging regression و Live acceptance انجام شوند.

## Gate exit criteria

AC-1 وقتی PASS می‌شود که:

- direct client overwrite در Runtime جدید = 0؛
- lifecycle tax/invoice بدون observer سراسری کار کند؛
- pipeline tests PASS؛
- invoice sale/purchase inventory + tax draft/post/reversal regression PASS؛
- Ledger/RLS/Security baseline بدون Regression باشد؛
- User Live Gate روی build مربوطه PASS شود.

## Windows / Offline readiness

`ADR-0017` جهت آینده را ثبت کرده است. AC-1 با جداکردن Domain/Application از Supabase و Browser، شرط لازم برای reuse کد در Windows Desktop را فراهم می‌کند، ولی Offline Ledger کامل جزو این Gate نیست.
