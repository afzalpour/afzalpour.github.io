# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-14**

این فایل Source of Truth وضعیت جاری پروژه است. ترتیب مرجع: `AVAN_MASTER_PROMPT.md` → این فایل → ADRهای Accepted → Repository → گزارش واقعی Live کاربر. Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) وضعیت انتشار

Repository: `afzalpour/afzalpour.github.io`

- ریشه Repository = **محیط عملیاتی**.
- `avan-staging/` = **محیط آماده‌سازی / فضای نسخه بعدی**.
- منبع حقیقت مالی Supabase = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- نسخه عملیاتی جاری = **RC1.8 — Production Live PASS / CLOSED**.
- PR آمادگی RC1.8 = **#188**؛ merge = `1286c6bb887a532f0cca7c2fe799e5aad831a1d3`.
- PR ارتقای RC1.8 به محیط عملیاتی = **#189**؛ merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- تأیید صریح ارتقا = **«RC1.8 Production Promotion APPROVED»**.
- تأیید صریح آزمون تجربه کاربری محیط عملیاتی = **«RC1.8 Production Smoke UX PASS»**.
- pre-merge Architecture Gate #322 = **PASS**.
- pre-merge Production Release Gate #25 = **PASS**.
- post-merge Architecture Gate #323 = **PASS**.
- post-merge Production Release Gate #26 = **PASS**.
- GitHub Pages #432 = **PASS**.
- Production Service Worker cache = `avan-prod-rc1-8-v1`.
- قابلیت‌های **بستن مستمر حساب‌ها و ممیزی مستمر**، **رادار انطباق ایران**، **کنترل هوشمند خرید و هزینه** و **اتصال و بازار اتوماسیون آوان** در محیط عملیاتی پذیرفته و بسته شده‌اند.
- Live validation pending = **none for RC1.8**.

نقاط بازگشت عملیاتی حفظ‌شده:
- `prod-backup-20260914-rc1-8-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-promotion`
- `prod-backup-20260912-rc1-7-pre-smoke-ux-hotfix`
- `prod-backup-20260912-company-onboarding-auth-hotfix-pre-promotion`

قرارداد ارتقای RC1.8 تأیید کرد که:
- `config.js` محیط عملیاتی دست‌نخورده و مختص همان محیط باقی ماند.
- ابزارها، آزمون‌ها، اسکریپت‌ها و metadata اختصاصی محیط آماده‌سازی وارد محیط عملیاتی نشدند.
- Service Worker محیط عملیاتی فقط projection تأییدشده runtime را با شناسه cache عملیاتی دریافت کرد.
- برای این چهار قابلیت هیچ migration پایگاه داده‌ای صرفاً به‌علت ارتقا اضافه نشد.
- هیچ credential اتصال بیرونی، Service Role secret، ثبت خودکار، پرداخت خودکار، تأیید خودکار یا ارسال بیرونی خودکار فعال نشد.

---

## 2) نشانگرهای دائمی محیط عملیاتی

RC1.6 retained:
- تطبیق بانکی، ورود صورتحساب بانکی، دفتر طرف حساب، دریافت/پرداخت/انتقال با دقت یک ریال، چاپ/PDF دفتر طرف حساب و AR/AP ناخالص = Live accepted.

RC1.7 retained:
- برج کنترل مالی = Production Live PASS.
- دوقلوی دیجیتال مالی = Production Live PASS.
- سرمایه در گردش + شواهد = Production Live PASS.
- لایه تصمیم عملیاتی مبتنی بر شواهد = Production Live PASS.
- صحت حسابداری داشبورد = Production Live PASS.
- نمای ۳۶۰ درجه طرف حساب = Production Live PASS.

RC1.8 permanent markers:
- بستن مستمر حساب‌ها و ممیزی مستمر = Production Live PASS.
- رادار انطباق ایران = Production Live PASS.
- کنترل هوشمند خرید و هزینه = Production Live PASS.
- اتصال و بازار اتوماسیون آوان = Production Live PASS.
- RC1.8 Production promotion = APPROVED / MERGED.
- RC1.8 Production Smoke UX = PASS.
- post-smoke read-only integrity verification = PASS.

نشانگرهای صریح تاریخی حفظ می‌شوند:
- **«Financial Digital Twin Live PASS»**
- **«Working Capital + Evidence Live PASS»**
- **«RC1.7-D Evidence Readable PASS»**
- **«RC1.7-D Live PASS — Handoff Fixed»**
- **«Digital Twin Evidence Readable PASS»**
- **«Dashboard Accounting Correctness Audit Live PASS»**
- **«Counterparty 360 Live PASS»**
- **«RC1.8 Production Promotion APPROVED»**
- **«RC1.8 Production Smoke UX PASS»**

---

## 3) اصول حاکم و سلامت Backend

- PostgreSQL/Supabase منبع حقیقت مالی است؛ browser storage محل داده مالی نیست.
- canonical money = Toman با `0.1 Toman = 1 Rial`؛ گردکردن پنهان زیر یک ریال مجاز نیست.
- چرخه سند حسابداری = `Draft → Posted → Reversed`؛ سند و خطوط Posted تغییرناپذیرند.
- مرز شرکت/RLS اجباری است؛ مرورگر Service Role/private secrets دریافت نمی‌کند.
- قابلیت‌های هوشمند و اتوماسیون حق ثبت، پرداخت، تأیید یا ارسال پنهان ندارند.
- integration write در آینده باید workspace-scoped، idempotent، auditable و human-controlled باشد.
- اعداد مالی مهم باید به شواهد قابل‌خواندن قابل Drill-down باشند.
- Session guard = 60-minute inactivity + 12-hour maximum session + clock-skew protection.
- password guard = minimum 12 chars + letter + number + symbol + common-password denylist.
- Free Transactional Recovery Rehearsal = PASS.
- isolated external disaster restore = **OPEN**؛ restore آزمایشی هرگز نباید روی `Avan-production` انجام شود.
- Leaked Password Protection به‌دلیل محدودیت provider/plan غیرفعال است و نباید به‌اشتباه fixed اعلام شود.

تأیید نهایی فقط‌خواندنی پس از آزمون عملیاتی RC1.8:
- journal_entries = **94**؛ latest `2026-09-12 19:32:07.685779+00`.
- financial_transactions = **24**؛ latest `2026-09-10 21:16:55.697626+00`.
- invoices = **42**؛ latest `2026-09-10 16:37:20.676074+00`.
- documents = **23**؛ latest `2026-09-07 21:11:31.272166+00`.
- inventory_documents = **9**؛ latest `2026-09-07 12:44:33.272324+00`.
- orphan journal lines = **0**.
- cross-workspace journal-line mismatches = **0**.
- unbalanced Posted journals = **0**.
- orphan invoice lines = **0**.
- cross-workspace invoice-line mismatches = **0**.
- journal lines with fractional Toman = **42**؛ دقت یک‌ریالی واقعی حفظ شده است.
- effective public anon/auth `SECURITY DEFINER` exposure = **0**.
- baseline پیش از ارتقا و نتیجه پس از آزمون عملیاتی یکسان است؛ RC1.8 هیچ mutation مالی ناخواسته ایجاد نکرد.

---

## 4) معماری راهبردی — ADR-0023

قابلیت‌های رسمی:
1. برج کنترل مالی
2. دوقلوی دیجیتال مالی
3. راهبر سرمایه در گردش
4. بستن مستمر حساب‌ها و ممیزی مستمر
5. رادار انطباق ایران
6. نمای ۳۶۰ درجه طرف حساب
7. کنترل هوشمند خرید و هزینه
8. گراف شواهد آوان
9. اتصال و بازار اتوماسیون آوان

وضعیت:
- برج کنترل مالی = Production Live PASS.
- دوقلوی دیجیتال مالی = Production Live PASS.
- راهبر سرمایه در گردش = Production Live PASS.
- بستن مستمر حساب‌ها و ممیزی مستمر = Production Live PASS در RC1.8.
- رادار انطباق ایران = Production Live PASS در RC1.8.
- نمای ۳۶۰ درجه طرف حساب = Production Live PASS.
- کنترل هوشمند خرید و هزینه = Production Live PASS در RC1.8.
- محدوده جاری گراف شواهد آوان = Production Live PASS.
- اتصال و بازار اتوماسیون آوان = Production Live PASS در RC1.8؛ اجرای بیرونی عمومی همچنان غیرفعال است.

قطار قابلیت‌های تعریف‌شده فعلی ADR-0023 برای محدوده موجود **کامل و بسته** است. قطار انتشار بعدی هنوز انتخاب نشده است.

---

## 5) بستن مستمر حساب‌ها و ممیزی مستمر

- Engineering PASS.
- authenticated Staging Live PASS / CLOSED.
- PRهای اصلی: #164، #170، #172 و #175.
- `writeOperations = 0`; `actualLedgerMutation = false`.
- readable evidence و خروجی تاریخ جلالی پذیرفته شده‌اند.
- ارتقا به محیط عملیاتی از طریق PR #189 انجام شد.
- RC1.8 Production Smoke UX = PASS.
- post-smoke DB integrity = PASS.
- وضعیت نهایی = **Production Live PASS / CLOSED**.

---

## 6) رادار انطباق ایران

- Engineering PASS.
- authenticated Staging Live PASS / CLOSED.
- PR #176 foundation merge `2f7185aa3cc46f735387689274f4db8667d56081`.
- PR #177 runtime-parity merge `7c3fcb636fa419200b37da30fc477771a7c0a6fb`.
- مهلت یا الزام قانونی جعلی تولید نمی‌شود.
- حقوق و بیمه تا زمان وجود منبع حقیقت معتبر، صریحاً خارج از پوشش‌اند.
- قرارداد فارسی‌سازی ADR-0025 برقرار است.
- ارتقا به محیط عملیاتی از طریق PR #189 انجام شد.
- RC1.8 Production Smoke UX = PASS.
- post-smoke DB integrity = PASS.
- وضعیت نهایی = **Production Live PASS / CLOSED**.

---

## 7) کنترل هوشمند خرید و هزینه

معماری:
- id = `avan-smart-procurement-spend-control-v1`.
- روش = کنترل‌های deterministic؛ امتیازدهی دلخواه وجود ندارد.
- محاسبات خرید/هزینه با دقت یک ریال انجام می‌شوند.
- read-only: `writeOperations = 0`, `actualLedgerMutation = false`, approval/payment mutation = false.
- تمام queryهای داده متعلق به شرکت دارای `workspace_id` صریح و پشت RLS هستند.

دامنه پذیرفته‌شده:
- تطبیق فاکتور خرید با رسید انبار.
- تشخیص استفاده مجدد از خط رسید.
- تشخیص اختلاف مقدار و اختلاف قیمت/هزینه رسید.
- خریدهای کالایی ثبت‌شده بدون رسید مرتبط.
- خطوط رسید ثبت‌شده در انتظار ارتباط با فاکتور خرید.
- تمرکز هزینه تأمین‌کننده.
- تاریخچه تغییر قیمت خرید.
- نامزدهای کمبود موجودی/نقطه سفارش.
- شواهد حسابداری قابل‌خواندن بدون نمایش UUID خام.
- چاپ/PDF با هویت شرکت، واحد پول انتخابی و تاریخ جلالی.

خارج از دامنه تا زمان وجود منبع حقیقت معتبر:
- درخواست خرید.
- سفارش خرید.
- تطبیق سه‌طرفه کامل مبتنی بر سفارش خرید.
- کنترل بودجه.
- گردش تأیید.
- اجرای پرداخت.

Engineering/Live evidence:
- PR #181؛ Architecture Gate #312 و #313 = PASS؛ Pages #424 = PASS.
- authenticated Staging Live = PASS / CLOSED.
- ارتقا به محیط عملیاتی از طریق PR #189 انجام شد.
- RC1.8 Production Smoke UX = PASS.
- post-smoke DB integrity = PASS.
- وضعیت نهایی = **Production Live PASS / CLOSED**.

---

## 8) اتصال و بازار اتوماسیون آوان

معماری و مرز ایمنی:
- architecture id = `avan-connect-automation-marketplace-v1`.
- Foundation v1 = registry + marketplace + deterministic preview only.
- `writeOperations = 0`; `actualLedgerMutation = false`; `workflowExecution = false`; `connectionMutation = false`.
- human approval، idempotency و auditability الزامات دائمی اجرای واقعی آینده هستند.
- credential اتصال‌دهنده یا اطلاعات حساس provider در browser financial storage ذخیره نمی‌شود.
- generic external execution همچنان غیرفعال است.

وضعیت اتصال‌دهنده‌ها:
- **ورود فایل صورت‌حساب بانکی** = فعال در آوان.
- **استخراج هوشمند اسناد** = فعال در آوان و مبتنی بر Edge Function احراز هویت‌شده + بازبینی انسانی.
- **پیش‌اعتبارسنجی صورتحساب الکترونیکی** = آماده با محدودیت؛ ارسال واقعی بیرونی غیرفعال است.
- **اتصال پایانه فروش** = متصل‌نشده.
- **اتصال فروشگاه اینترنتی** = متصل‌نشده.
- **اتصال عمومی داده** = متصل‌نشده.

Engineering/Live evidence:
- PR #184 foundation؛ Architecture Gate #315/#316 = PASS؛ Pages #427 = PASS.
- PR #186 اصلاح چیدمان؛ Architecture Gate #317/#318 = PASS؛ Pages #429 = PASS.
- authenticated Staging Live = PASS / CLOSED.
- ارتقا به محیط عملیاتی از طریق PR #189 انجام شد.
- RC1.8 Production Smoke UX = PASS.
- post-smoke DB integrity = PASS.
- وضعیت نهایی = **Production Live PASS / CLOSED**.

---

## 9) قراردادهای معماری مرتبط

ADR-0024 — Production/Staging Runtime Parity Contract = **Accepted**.
- runtime مشترک باید byte-identical باشد مگر مورد allowlist‌شده.
- parity به‌تنهایی مجوز Production promotion نیست.
- RC1.8 با projection کنترل‌شده runtime پذیرفته‌شده ارتقا یافت.

ADR-0025 — Strict Persian User-Facing Language Contract = **Accepted / permanent**.
- متن غیرضروری انگلیسی نباید در UI اصلی کاربر نشت کند.
- enumهای فنی در مرز presentation فارسی می‌شوند؛ مقدار canonical برای API/audit ثابت می‌ماند.

ADR-0026 — Avan Connect Automation Execution Boundary = **Accepted**.
- وضعیت اتصال‌دهنده باید حقیقت capability را نشان دهد.
- disconnected provider نباید متصل نمایش داده شود.
- اجرای واقعی آینده باید workspace-scoped، idempotent، auditable و human-controlled باشد.
- ثبت مالی، پرداخت، تأیید و ارسال بیرونی همچنان نیازمند کنترل انسانی هستند.

---

## 10) شواهد انتشار RC1.8

آمادگی:
- PR #188 = RC1.8 release readiness.
- rollback = `prod-backup-20260914-rc1-8-pre-promotion`.
- accepted Staging runtime merge = `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- accepted Staging cache = `avan-staging-rc1-v121-module9-live-layout-polish`.

ارتقای کنترل‌شده:
- PR #189 = RC1.8 Production promotion.
- approval = **«RC1.8 Production Promotion APPROVED»**.
- promotion branch head = `c3c2fe5f448aa4937bc08bad8debbadfa436b0f3`.
- Production merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- Production cache = `avan-prod-rc1-8-v1`.
- Architecture Gate #322/#323 = PASS.
- Production Release Gate #25/#26 = PASS.
- GitHub Pages #432 = PASS.

پذیرش نهایی:
- user marker = **«RC1.8 Production Smoke UX PASS»**.
- post-smoke read-only database verification = **PASS**.
- financial mutation introduced by smoke/promotion = **none detected**.
- RC1.8 = **Production Live PASS / CLOSED**.

---

## 11) اشاره‌گرهای جاری

محیط عملیاتی:
- current release = **RC1.8 — Production Live PASS / CLOSED**.
- merge = `aa80efa8cba2a798f649d81021ecafa930949208`.
- Service Worker = `avan-prod-rc1-8-v1`.
- Architecture Gate #323 = PASS.
- Production Release Gate #26 = PASS.
- GitHub Pages #432 = PASS.
- authenticated Production Smoke = PASS.
- post-smoke integrity = PASS.

محیط آماده‌سازی:
- آخرین runtime پذیرفته‌شده پیش از ارتقا = `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- Staging cache = `avan-staging-rc1-v121-module9-live-layout-polish`.
- آخرین Architecture marker مربوط به پذیرش آماده‌سازی = #318 PASS.
- آخرین Pages marker مربوط به پذیرش آماده‌سازی = #429 PASS.

گام بعدی رسمی: **RC1.8 بسته شده است؛ هیچ Live Gate معوقی ندارد. قطار بعدی باید از روی Requirement/Backlog/ADR بعدی انتخاب شود و نباید به‌طور ضمنی از ادامه RC1.8 فرض شود.**
