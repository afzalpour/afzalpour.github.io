# Avan Core 1.0 — RC1.2-A Visual Design Gate

## هدف
ایجاد Design System حرفه‌ای و یکپارچه برای آوان، بدون تغییر منطق حسابداری، Ledger، RLS یا گردش عملیات.

## Design direction
- Sidebar دسکتاپ: تیره، کم‌حواس‌پرتی و متمرکز بر محتوای اصلی.
- Main canvas: روشن و گرم با کنتراست حرفه‌ای.
- Typography: Vazirmatn با fallback استاندارد iOS/macOS/Windows.
- KPI cards: سلسله‌مراتب واضح، accent محدود و قابل اسکن.
- Tables: متراکم، تمیز، hover ملایم و header واضح.
- Forms: focus state مشخص و کنترل‌های خواناتر.
- Buttons: primary/secondary/success/danger با وزن بصری متفاوت.
- Mobile: bottom navigation شناور، safe-area friendly و بدون overflow.

## A1 — Desktop shell
1. Staging را Hard Refresh کن.
2. Sidebar باید تیره و حرفه‌ای باشد.
3. آیتم active باید واضح باشد ولی Sidebar نباید از محتوای اصلی پررنگ‌تر شود.
4. Header و Main content باید روشن، منظم و دارای spacing کافی باشند.
5. Workspace selector نباید overflow یا شکستگی داشته باشد.

## A2 — Typography / iPhone
1. روی iPhone/Safari باز کن.
2. فونت فارسی باید Vazirmatn باشد؛ در صورت قطع CDN fallback سیستم بدون شکست layout کار کند.
3. اعداد، متن‌های فارسی و جدول‌ها باید خوانا و هم‌تراز باشند.
4. هیچ متن بریده یا مربع/کاراکتر خراب نباشد.

## A3 — Dashboard
- KPIهای اصلی به‌وضوح قابل اسکن باشند.
- کارت‌ها از هم تفکیک بصری داشته باشند، اما رنگ‌ها شلوغ نباشند.
- بخش‌های تحلیل مالی، کنترل و ریسک، وصول، پایان دوره و Aging همچنان کامل نمایش داده شوند.
- هیچ عدد یا محاسبه‌ای تغییر نکرده باشد.

## A4 — Tables
صفحات زیر را باز کن:
- حساب‌ها
- فاکتورها
- اسناد حسابداری
- گزارش‌ها

Expected:
- Header جدول واضح.
- hover ردیف روی دسکتاپ ملایم.
- اعداد خوانا.
- روی موبایل horizontal scroll درست کار کند.
- هیچ ستون یا action از دسترس خارج نشود.

## A5 — Forms / modals
حداقل این‌ها را باز کن:
- دریافت/پرداخت
- سند دستی
- فاکتور
- حساب جدید
- تغییر رمز

Expected:
- Focus ring واضح باشد.
- فیلدها و Selectها هم‌ارتفاع و منظم باشند.
- Modal در دسکتاپ و موبایل overflow بد نداشته باشد.
- Primary action از Secondary واضح‌تر باشد.

## A6 — Mobile navigation
- Bottom nav باید شناور و خوانا باشد.
- FAB ثبت سریع قابل لمس و واضح باشد.
- safe-area آیفون رعایت شود.
- هیچ overlap با محتوای آخر صفحه ایجاد نشود.

## A7 — Auth
- صفحه Login/Signup باید ظاهر جدید داشته باشد.
- فیلد ایمیل/رمز، تب ورود/ثبت‌نام و دکمه‌ها درست کار کنند.
- Forgot Password همچنان قابل استفاده باشد.

## A8 — Regression
- Dashboard باز شود.
- Draft journal save/delete کار کند.
- Invoice draft کار کند.
- Reports کار کند.
- User management و تغییر رمز کار کند.
- Rial/Toman preference کار کند.
- RLS cross-workspace isolation بدون تغییر باشد.
- Health orphan lines = 0.

## PASS
اگر ظاهر مورد تأیید است و A1 تا A8 پاس شد:

`Gate RC1.2-A پاس شد`
