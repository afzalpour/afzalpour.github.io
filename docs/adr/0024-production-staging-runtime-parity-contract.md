# ADR-0024 — Production/Staging Runtime Parity Contract

- **Status:** Accepted
- **Date:** 2026-09-12
- **Related:** ADR-0004, ADR-0012, ADR-0016

## زمینه / مسئله

آوان دو سطح Runtime دارد: ریشه Repository به‌عنوان Production و `avan-staging/` به‌عنوان Staging/next-release. این ساختار برای Staging-first لازم است، اما اگر تغییرات اضطراری Production یا اصلاحات بعد از Release فقط در یکی از دو Runtime بمانند، Staging می‌تواند روی پایه‌ای قدیمی ادامه پیدا کند. نتیجه آن Drift رفتاری، تست روی نسخه نادرست و ریسک بازگرداندن ناخواسته اصلاحات Production در Promotion بعدی است.

در Live Gate ماژول 4، اختلاف مشاهده‌شده در رفتار «از آوان بپرس» این ریسک را آشکار کرد. بررسی Source نشان داد فایل پایه سؤال‌ها و لایه polish در وضعیت جاری byte-identical هستند؛ بنابراین اختلاف مشاهده‌شده می‌تواند از Runtime/cache سرو شده نیز ناشی شود. معماری باید هم Source drift و هم stale release identity را مهار کند.

## تصمیم

1. **Production baseline مرجع مشترک است.** هر فایل Runtime که در Production و Staging مشترک است باید byte-for-byte یکسان باشد.
2. **اختلاف Staging فقط صریح است.** فایل next-release یا environment-specific فقط وقتی می‌تواند متفاوت باشد که در `avan-staging/runtime-divergence-allowlist.json` با دلیل روشن ثبت شده باشد.
3. **Parity دوطرفه است.** Gate هم بررسی می‌کند Staging فایل مشترک قدیمی نداشته باشد و هم اینکه Runtime جدید Production بدون mirror در Staging باقی نمانده باشد.
4. **Production hotfix باید Staging-first باشد.** اگر به‌دلیل Incident یک hotfix مستقیم Production لازم شد، همان تغییر باید در همان release train فوراً به Staging backport شود و parity Gate آن را enforce کند.
5. **Promotion همچنان صریح است.** این قرارداد به معنی auto-promotion نیست؛ فایل‌های next-release allowlisted تا Live PASS و مجوز Release فقط در Staging می‌مانند.
6. **هر تغییر Runtime Staging باید cache identity جدید داشته باشد.** Service Worker Staging با cache نسخه‌دار و network-first ادامه می‌دهد تا stale Runtime بین Live Gateها باقی نماند.
7. **Drift مجاز دائمی نیست.** allowlist باید حداقل و موقت باشد؛ پس از Production promotion، entry مربوط باید حذف شود و فایل مشترک دوباره byte-identical شود.
8. **قابلیت‌های حساس دارای lock اختصاصی‌اند.** برای Runtimeهایی مانند Business Copilot/بانک سؤال‌ها، Gate علاوه بر قرارداد عمومی، تطابق صریح فایل‌های مرجع را نیز کنترل می‌کند.

## پیامدها

- Promotion بعدی نمی‌تواند سهواً یک اصلاح Production را با نسخه قدیمی Staging بازگرداند.
- Staging روی همان baseline واقعی Production توسعه می‌یابد و فقط delta بعدی Release را نگه می‌دارد.
- اختلاف عمدی شفاف، reviewable و قابل حذف است.
- تعداد فایل‌های allowlist در هر Release باید قابل توضیح باشد و رشد بی‌دلیل آن یک هشدار معماری محسوب می‌شود.
- Environment-specific فایل‌هایی مانند `config.js`, `index.html` و `sw.js` می‌توانند متفاوت بمانند، اما تفاوتشان باید در allowlist ثبت شود.

## Guardrails / Invariants

- ADR-0004 Staging-first پابرجاست؛ parity Gate جای Live Gate را نمی‌گیرد.
- Production بدون مجوز صریح Release تغییر نمی‌کند، مگر Incident hotfix کنترل‌شده با rollback و Gate.
- `config.js` Production-only secrets/config هرگز از Staging overwrite نمی‌شود.
- فایل‌های مالی/امنیتی مشترک نباید بدون دلیل allowlist متفاوت شوند.
- Gate باید از هر دو جهت Production → Staging و Staging → Production drift را بررسی کند.
- Service Worker cache identity باید همراه Runtime Staging تغییر کند.
- Runtime parity هیچ مجوزی برای bypass RLS، تغییر Ledger یا تغییر داده مالی ایجاد نمی‌کند.

## گزینه‌های ردشده

### نگه‌داشتن دو کپی مستقل و اتکا به بررسی دستی
رد شد؛ خطای انسانی و drift پس از hotfix اجتناب‌ناپذیر است.

### کپی کامل Production به Staging قبل از هر Release
به‌تنهایی رد شد؛ ممکن است deltaهای معتبر next-release را پاک کند و provenance اختلاف‌ها را از بین ببرد.

### auto-sync دوطرفه بدون allowlist
رد شد؛ می‌تواند تغییرات آزمایشی Staging را ناخواسته وارد Production کند و اصل promotion صریح را نقض کند.

## ارتباط با Gateها / فایل‌های اجرایی

- `avan-staging/runtime-divergence-allowlist.json`
- `avan-staging/tests/runtime-parity.spec.mjs`
- `avan-staging/package.json` → `test:architecture`
- Staging Service Worker cache identity
- Production Release Gate همچنان مرز promotion نهایی است.
