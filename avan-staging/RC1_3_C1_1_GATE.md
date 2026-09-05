# Gate RC1.3-C1.1 — Audit Role Boundary

هدف: گزارش فعالیت باید در سطح دیتابیس و UI بر اساس نقش Workspace محدود باشد.

## Expected behavior

### Owner / Manager
- کارت `گزارش فعالیت` نمایش داده شود.
- فیلتر `کاربران و دسترسی` وجود داشته باشد.
- رویدادهای دعوت کاربر / افزودن یا تغییر عضو در صورت وجود قابل مشاهده باشند.
- رویدادهای مالی، فاکتور، سند، دوره مالی، اسناد هوشمند و تنظیمات نیز نمایش داده شوند.

### Accountant / Viewer
- کارت `گزارش فعالیت` نمایش داده شود.
- فیلتر `کاربران و دسترسی` وجود نداشته باشد.
- هیچ رویداد `workspace_member` / `workspace_invitation` یا رویداد مدیریتی دسترسی نمایش داده نشود.
- رویدادهای عملیاتی مجاز مثل فاکتور، سند حسابداری، اسناد هوشمند و دوره مالی قابل مشاهده باشند.
- متن راهنما اعلام کند که رویدادهای کاربران و دسترسی فقط برای مالک/مدیر قابل مشاهده است.

## Database boundary
- `anon` هیچ privilege روی `public.audit_logs` نداشته باشد.
- `authenticated` فقط SELECT ستون‌های امن موردنیاز UI را داشته باشد.
- `before_json` و `after_json` از Data API برای authenticated قابل خواندن نباشند.
- RLS policy فقط Owner/Manager را برای مشاهده همه رویدادهای Workspace مجاز کند.
- نقش‌های غیرمدیریتی فقط entityهای عملیاتی allow-list شده را ببینند.

## Regression
- Login / Dashboard / Reports کار کند.
- Invoice و Journal مشاهده/ثبت عادی کار کند.
- کارت Audit چشمک نزند و Refresh/Filter کار کند.
- هیچ تغییر در Ledger، Journal lifecycle، Invoice posting یا سایر RLSهای مالی انجام نشده است.

عبارت PASS:

`Gate RC1.3-C1.1 پاس شد`
