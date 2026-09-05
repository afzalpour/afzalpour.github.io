# Avan RC1.2-E.1 — Company identity recovery Gate

## هدف
رفع حالت امن «هویت شرکت در چاپ» وقتی RPCهای جدید هنوز از Supabase REST API دیده نمی‌شوند.

## Database recovery
1. ابتدا `RC1_2_E_COMPANY_PROFILE_PATCH.sql` باید بدون خطا اجرا شده باشد.
2. سپس `RC1_2_E1_SCHEMA_CACHE_RECOVERY.sql` اجرا شود.
3. خروجی Verification باید جدول و هر دو RPC را non-null نشان دهد و bucket `avan-branding` موجود باشد.

## Live Gate
1. Hard Refresh.
2. Settings → هویت شرکت در چاپ.
3. اگر کارت خطا دیده شد، «بررسی مجدد اتصال» را بزنید.
4. فرم پروفایل باید ظاهر شود.
5. یک نام نمایشی ذخیره کنید و Refresh کنید؛ مقدار باید باقی بماند.
6. یک فاکتور/سند را Print/PDF کنید؛ هویت ذخیره‌شده باید در Header چاپ دیده شود.

PASS phrase: `Gate RC1.2-E.1 پاس شد`
