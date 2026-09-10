# ADR-0022 — Bank Statement Reconciliation Boundary

- **Status:** Accepted
- **Date:** 2026-09-10
- **Related ADRs:** 0002, 0003, 0005, 0016, 0019, 0020

## زمینه / مسئله

آوان برای خزانه‌داری حرفه‌ای باید گردش واقعی صورت‌حساب بانک را با دریافت/پرداخت/انتقال‌های ثبت‌شده در Ledger تطبیق دهد. در مدل موجود، `financial_accounts` همین حالا حساب بانکی را به `ledger_account_id` متصل می‌کند و `financial_transactions` منبع عملیات دریافت/پرداخت/انتقال است. ایجاد یک Master موازی برای حساب بانکی یا یک Ledger دوم، Source of Truth را دوگانه و مستعد مغایرت می‌کند.

## تصمیم

1. RC1.6 بانک جدیدی به‌عنوان Master موازی ایجاد نمی‌کند. حساب بانکی همان `financial_accounts(kind='bank')` است.
2. داده بانکی بیرونی در سه موجودیت Evidence ذخیره می‌شود:
   - `bank_statement_imports`: نوبت ورود صورت‌حساب و fingerprint فایل؛
   - `bank_statement_lines`: ردیف‌های واقعی بانک؛
   - `bank_reconciliation_matches`: سابقه تطبیق تاییدشده/باطل‌شده با `financial_transactions`.
3. تطبیق فقط Evidence است و هیچ Journal/Financial Transaction را ایجاد، Post، Reverse یا ویرایش نمی‌کند.
4. پیشنهاد Match فقط بین همان Company و همان Bank account ساخته می‌شود و فقط `financial_transactions.status='posted'` را در نظر می‌گیرد.
5. مبلغ باید در Canonical Toman با دقت یک ریال **دقیقاً برابر** باشد. تطبیق fuzzy مبلغ ممنوع است.
6. جهت گردش بانک باید با سمت حساب بانکی در تراکنش سازگار باشد:
   - `credit`: receipt/transfer ورودی به ledger account بانک؛
   - `debit`: payment/transfer خروجی از ledger account بانک.
7. `opening_balance` یک ردیف عملیاتی قابل Match نیست.
8. امتیازدهی فقط برای رتبه‌بندی کاندیدهای از قبل معتبر است؛ reference و نزدیکی تاریخ score را بالا می‌برند اما مبلغ/سمت صحیح را جایگزین نمی‌کنند.
9. پیشنهاد هیچ‌گاه auto-confirm نمی‌شود. تایید و ابطال Match باید کاربر انسانی و قابل Audit داشته باشد.
10. تکرار کل فایل با SHA-256 در سطح Company + Bank account مسدود می‌شود؛ برای ردیف‌ها fingerprint ثبت می‌شود اما روی فایل‌های همپوشان uniqueness سراسری اعمال نمی‌شود تا تراکنش‌های واقعی هم‌مبلغ/هم‌روز حذف نشوند.

## Guardrails / Invariants

- PostgreSQL/Supabase منبع حقیقت مالی باقی می‌ماند.
- RLS و Company boundary روی همه جداول جدید اجباری است.
- هیچ `SECURITY DEFINER` عمومی برای این قابلیت مجاز نیست؛ RPC پیشنهادها `SECURITY INVOKER` است.
- Browser هیچ Service Role یا secret دریافت نمی‌کند.
- Match روی تراکنش Draft/Cancelled ممنوع است.
- Match با مبلغ متفاوت یا Bank-side متفاوت ممنوع است، حتی اگر reference یکسان باشد.
- تاریخ/شرح/reference صرفاً Evidence رتبه‌بندی هستند.
- Match history با delete بازنویسی نمی‌شود؛ active match با void خاتمه می‌یابد.
- یک Statement line در هر لحظه حداکثر یک Match فعال دارد.
- یک Financial Transaction برای یک Bank account در هر لحظه حداکثر یک Match فعال دارد؛ انتقال Bank→Bank می‌تواند مستقل در صورت‌حساب هر بانک Match شود.
- مبالغ مطابق ADR-0019 با `numeric(20,1)` ذخیره می‌شوند.
- Runtime مطابق ADR-0016 ماژولار باقی می‌ماند.

## گزینه‌های ردشده

### جدول `bank_accounts` مستقل
رد شد؛ چون `financial_accounts(kind='bank')` همین مسئولیت را دارد.

### Match خودکار بر اساس مبلغ نزدیک
رد شد؛ چون می‌تواند Evidence بانکی را به تراکنش اشتباه متصل کند.

### ایجاد خودکار دریافت/پرداخت برای ردیف Match‌نشده
رد شد؛ این کار یک عملیات مالی جدید است و باید در فاز جداگانه با Preview و تایید صریح کاربر طراحی شود.

### حذف Match اشتباه
رد شد؛ ابطال audit-friendly جایگزین delete است.

## ارتباط با Implementation

- Backend: `avan-staging/APPLIED_RC1_6_A_BANK_RECONCILIATION.sql`
- Domain matcher: `avan-staging/src/domains/treasury/bank-reconciliation-matcher.js`
- Tests: `avan-staging/tests/rc16-bank-reconciliation.spec.mjs`
