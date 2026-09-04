# Avan Core 1.0 — RC1.2-B Premium UI + Account Tree Gate

## B0 — Refresh
- Hard Refresh Staging.
- No SQL migration or Edge Function deployment is required.

## B1 — Premium visual layer
Confirm on Dashboard, Reports, Invoices, Journal and Settings:
- main canvas is warmer/ivory rather than cold grey;
- KPI cards have restrained depth/accent and are clearly richer than RC1.2-A;
- purple remains the primary Avan action color;
- gold is only a limited accent, not a financial status color;
- green/red still indicate positive/error/status semantics;
- tables/forms remain highly readable.

## B2 — Reports copy cleanup
Reports → `از آوان بپرس`:
- `گزارش فارسی از داده‌های معتبر Ledger` is not visible;
- `آوان SQL آزاد اجرا نمی‌کند؛ درخواست فقط به گزارش‌های کنترل‌شده تبدیل می‌شود.` is not visible;
- natural-language reports still execute normally.

## B3 — Settings cleanup / Persian labels
Settings:
- `محل ذخیره` card is removed;
- `سلامت Core` is shown as `سلامت سیستم`;
- `اسناد Posted/Reversed` is shown as `اسناد ثبت‌شده/برگشتی`;
- `Workspace قابل مشاهده` is shown as `فضاهای مالی قابل مشاهده`;
- `دوره بسته` is shown as `دوره‌های بسته`;
- underlying health values are unchanged.

## B4 — Account tree colors
Accounts:
- button `رنگ‌بندی شاخه‌ها: روشن` is visible near `حساب جدید`;
- every top-level account branch has a distinct, muted color family;
- its child/sub-child rows keep the same family with progressively lighter intensity;
- colors do not change during normal re-render/refresh order;
- toggle can turn coloring off and back on;
- editing/archiving/opening-balance actions still work.

## B5 — Mobile / iPhone
- no horizontal layout break caused by the new visual layer;
- account color toggle remains usable;
- cards/tables/forms remain readable;
- bottom navigation remains usable.

## B6 — Accounting regression
- Dashboard opens.
- Draft journal save/delete works.
- Invoice draft works.
- Reports work.
- Rial/Toman switching works.
- Settings user/access panel works.
- orphan journal lines remain 0.
- RLS workspace isolation remains intact.

## PASS
`Gate RC1.2-B پاس شد`
