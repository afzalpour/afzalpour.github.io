# RC1.2-E.2 — Company Profile Stability Gate

هدف این Hotfix فقط رفع Regression صفحه تنظیمات در مرحله E است.

## Gate E2-0 — Refresh
- یک Hard Refresh انجام شود.
- صفحه تنظیمات باز شود.

## Gate E2-1 — No flicker / no render loop
- کارت «هویت شرکت در چاپ» باید ثابت بماند.
- کارت نباید فعال/غیرفعال، حذف/ظاهر یا چشمک‌زن شود.
- تایپ یا حرکت در صفحه نباید فرم را Reset کند.

## Gate E2-2 — Missing RPC safe state
اگر RPC هنوز از Supabase API قابل مشاهده نیست:
- فقط یک کارت خطای پایدار دیده شود.
- فقط یک دکمه «بررسی مجدد اتصال» وجود داشته باشد.
- با زدن دکمه فقط یک بررسی انجام شود؛ UI نباید وارد Loop شود.

## Gate E2-3 — Connected state
اگر RPC قابل مشاهده است:
- فرم کامل هویت شرکت نمایش داده شود.
- ذخیره نام/مشخصات کار کند.
- فرم پس از ذخیره پایدار بماند.
- Print/PDF همچنان از Profile استفاده کند.

## Regression
- Dashboard/Reports/Invoices/Journal باز شوند.
- Print/PDF مرحله D و D.1 بدون تغییر کار کند.
- Ledger/RLS/Journal lifecycle دست‌نخورده هستند.

PASS phrase:
`Gate RC1.2-E.2 پاس شد`
