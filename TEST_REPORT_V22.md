# گزارش تست V22

## تست Syntax
- `demo.html`: JavaScript syntax OK
- `index.html`: JavaScript syntax OK

## Runtime / UX
- حالت شخصی: Primary Navigation دقیقاً ۶ آیتم (داشبورد، تراکنش‌ها، حساب‌ها، تعهدات، گزارش‌ها، تنظیمات).
- در حالت شخصی، فاکتورها/انبار/حسابرسی در Navigation ساخته نمی‌شوند و «فاکتور» در Command Palette نیز نمایش داده نمی‌شود.
- Dashboard شخصی: ۴ KPI اصلی.
- حالت شرکتی: Primary Navigation دقیقاً ۶ آیتم (داشبورد، تراکنش‌ها، فاکتورها، حسابداری، گزارش‌ها، تنظیمات).
- Dashboard شرکتی: ۶ KPI اصلی.
- Sub-nav حسابداری شرکتی: حساب‌ها، سرفصل‌ها، دفتر کل، انبار، کنترل و حسابرسی، تنظیمات شرکت.
- Sidebar Collapse: موفق.
- Command Palette با Ctrl/Cmd+K: موفق.
- Transaction Wizard: سه مرحله، مودال legacy باز نمی‌شود.
- Invoice Wizard: چهار مرحله؛ در تست واقعی با داده نمونه ثبت نهایی موفق بود (تعداد فاکتور ۰ → ۱).
- Mobile 390×844: پنج آیتم Bottom Navigation، بدون overflow افقی.
- Page errors در سناریوهای تست: صفر.

## Motion / Accessibility
- Page enter: 200ms opacity/transform.
- Modal/Drawer: 200ms scale/fade + backdrop blur.
- Hover/Press: 150ms.
- Wizard step: 200ms.
- `prefers-reduced-motion` پشتیبانی می‌شود.
