# Gate RC1.3-C1 — Security Definer Hardening + Audit Log UX

هدف این Gate بستن سطح EXECUTE ناشناس برای RPCهای `SECURITY DEFINER` و اضافه‌کردن گزارش فعالیت خواندنی، بدون تغییر منطق مالی یا RLS Workspace است.

## Database hardening
- Migration: `RC1_3_C1_SECURITY_DEFINER_HARDENING.sql`
- فقط `EXECUTE` از `PUBLIC` و `anon` برای توابع `SECURITY DEFINER` در schema `public` revoke می‌شود.
- دسترسی موجود `authenticated` و `service_role` تغییر نمی‌کند.
- body هیچ تابعی تغییر نمی‌کند.
- هیچ RLS Policy، Ledger data، Journal lifecycle یا Invoice posting تغییر نمی‌کند.

Verification مورد انتظار:
- `anon_executable_security_definers = 0`
- `public_executable_security_definers = 0`
- `authenticated_executable_security_definers` همچنان غیرصفر و مطابق موجودی قبلی باشد.

## Audit Log UX
در `تنظیمات` کارت `گزارش فعالیت` نمایش داده می‌شود.
- Read-only
- حداکثر ۴۰ رویداد آخر Workspace
- فقط فیلدهای امن نمایشی: action/entity/summary/time/actor classification
- `before_json` و `after_json` نمایش داده نمی‌شوند.
- actor فقط به صورت `شما` / `کاربر دیگر` / `سیستم` نمایش داده می‌شود.
- فیلترهای حسابداری، اسناد هوشمند، کاربران و تنظیمات وجود دارند.

## Live Gate
1. Hard Refresh.
2. در حالت Logout صفحه ورود باید عادی و بدون خطای تکرارشونده نمایش داده شود.
3. وارد حساب شو؛ Dashboard و اطلاعات Workspace باید عادی Load شوند.
4. `گزارش‌ها` را باز کن و حداقل یک گزارش موجود را مشاهده کن.
5. `اسناد حسابداری` و `فاکتورها` را باز کن؛ لیست‌ها باید عادی نمایش داده شوند.
6. برو `تنظیمات`:
   - کارت `گزارش فعالیت` باید پایدار باشد و چشمک نزند.
   - رویدادهای قبلی باید نمایش داده شوند.
   - فیلترها کار کنند.
   - `به‌روزرسانی` کار کند.
7. مشخصات شرکت را بدون تغییر ذخیره یا یک تغییر بی‌خطر انجام بده، سپس Refresh گزارش فعالیت را بزن؛ رویداد جدید باید ظاهر شود.
8. روی iPhone/mobile نیز تنظیمات و کارت گزارش فعالیت قابل استفاده باشد.
9. Regression: اطلاعات شرکت، چاپ، اسناد هوشمند و Navigation موبایل همچنان عادی باشند.

عبارت PASS:

`Gate RC1.3-C1 پاس شد`
