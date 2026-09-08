# ADR-0016 — Modular Runtime, Explicit Composition, No New Monkey-Patching

Status: **Accepted**  
Date: **2026-09-08**

## زمینه / مسئله

آوان به‌صورت تدریجی از نسخه‌های قدیمی به Core ابری فعلی رسیده است. بخشی از Frontend هنوز با الگوهای compatibility مانند overwrite کردن متدهای مشترک (`C.rpc = ...`, `C.update = ...`) و `MutationObserver`های گسترده توسعه یافته است.

این روش در کوتاه‌مدت سرعت توسعه را بالا برده، اما در ادامه هزینه Debug، ریسک ترتیب Load، coupling بین ماژول‌ها و دشواری تست را افزایش می‌دهد.

همزمان `docs/architecture/AVAN_MIGRATION_MAP_V1.md` از قبل Strangler Pattern، تفکیک Domain/Application/Infrastructure/UI و ممنوعیت Rewrite یک‌باره را فریز کرده است.

## تصمیم

1. **Rewrite کامل ممنوع می‌ماند.** مهاجرت Frontend به‌صورت Strangler و Gate-by-Gate انجام می‌شود.
2. از این ADR به بعد، توسعه جدید حق overwrite مستقیم متدهای مشترک Runtime مانند `C.rpc`, `C.select`, `C.insert`, `C.update` و `C.remove` را ندارد.
3. Extensionهای موقت/سازگاری باید از یک **Operation Pipeline نام‌دار و deterministic** استفاده کنند.
4. ترتیب اجرای extensionها باید صریح و قابل مشاهده باشد؛ وابستگی به ترتیب تصادفی `<script>`ها قابل قبول نیست.
5. `MutationObserver` سراسری فقط به‌عنوان compatibility موقت مجاز است. هدف، lifecycle/event صریح برای Page/Modal/Form است.
6. فایل‌های جدید باید براساس مسئولیت نام‌گذاری شوند، نه شماره Release. فایل‌های `rc*` موجود می‌توانند تا زمان مهاجرت compatibility wrapper باقی بمانند.
7. Business logic قابل محاسبه باید از DOM جدا و به ماژول Pure/Domain منتقل شود تا تست بدون Browser ممکن باشد.
8. Data access باید به Repository/Adapterهای Infrastructure منتقل شود؛ Domain نباید Supabase را بشناسد.
9. `app.js` تا پایان Migration یک Compatibility Shell است و فقط وقتی کوچک می‌شود که رفتار Feature متناظر تست و Gate شده باشد.
10. هر مرحله Refactor باید behavior-preserving باشد و بدون Migration مالی یا Rewrite داده تاریخی انجام شود، مگر Requirement مستقل چنین تغییری را ایجاب کند.

## Composition Contract

Runtime Client یک pipeline نام‌دار دارد:

- middleware شناسه یکتا دارد؛
- priority صریح دارد؛
- `next()` فقط یک بار قابل فراخوانی است؛
- وضعیت اتصال pipeline قابل بازرسی است تا monkey-patch باقی‌مانده شناسایی شود؛
- در دوره Migration، متدها برای Compatibility هنوز writable می‌مانند؛ قفل سخت فقط پس از مهاجرت کامل Legacy patchها فعال می‌شود.

## Guardrails / Invariants

- PostgreSQL/Supabase همچنان Source of Truth مالی نسخه وب است.
- Ledger، RLS، Company boundary، integer Toman و Posted immutability تغییر نمی‌کنند.
- Production root محل توسعه نیست؛ Refactor ابتدا در Staging انجام می‌شود.
- هیچ Refactor صرفاً برای کاهش تعداد خطوط انجام نمی‌شود؛ مسئولیت معماری باید مشخص باشد.
- هیچ Feature پاس‌شده‌ای بدون Regression evidence حذف یا بازطراحی نمی‌شود.
- Performance و maintainability باید بهبود یابد، اما correctness مالی اولویت بالاتر دارد.

## پیامدها

مزایا:
- Debug path کوتاه‌تر و قابل پیش‌بینی‌تر.
- امکان Unit test برای logic مستقل.
- کاهش coupling به ترتیب Load فایل‌ها.
- امکان جایگزینی تدریجی Supabase adapter و آماده‌سازی Platformهای دیگر.
- فراهم‌شدن مسیر امن برای Windows/Desktop در آینده.

هزینه‌ها:
- تا پایان Migration، Legacy و معماری جدید مدتی همزمان وجود دارند.
- بعضی فایل‌های `rc*` باید مرحله‌ای بازنویسی/حذف شوند.
- قبل از قفل سخت Runtime، audit تمام patchهای باقی‌مانده لازم است.

## گزینه‌های ردشده

### Rewrite کامل Frontend
رد شد؛ ریسک Regression مالی و از دست‌دادن رفتارهای Live-PASS بالا است.

### ادامه Patch نسخه‌ای بدون Consolidation
رد شد؛ هزینه نگه‌داری و ریسک interaction بین ماژول‌ها با هر Release افزایش می‌یابد.

### مهاجرت فوری به Framework جدید
فعلاً رد شد؛ Framework به‌تنهایی coupling معماری را حل نمی‌کند و Rewrite گسترده ایجاد می‌کند.

## ارتباط با Gateها / فایل‌های اجرایی

- `docs/architecture/AVAN_MIGRATION_MAP_V1.md`
- `avan-staging/src/core/runtime/operation-pipeline.js`
- `avan-staging/tests/operation-pipeline.spec.mjs`
- Architecture Consolidation Gate AC-1

اولین مهاجرت عملی تحت این ADR:
- `rc14-invoice-inventory-ui.js`: حذف overwrite مستقیم `C.rpc` و انتقال به middleware نام‌دار.
