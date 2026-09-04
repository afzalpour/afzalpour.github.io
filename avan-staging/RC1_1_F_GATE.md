# Avan Core 1.0 — RC1.1-F UX Cleanup Gate

## هدف
- تغییر رمز شخصی برای هر کاربر با تأیید رمز فعلی.
- حذف Workspace شخصی خودکار و تکراری از تجربه کاربر وقتی عضو Workspace کاری دیگری است.
- حفظ چند-Workspace واقعی برای شرکت‌های متفاوت.
- ساده‌سازی متن و عنوان کارت‌های مدیریتی داشبورد بدون تغییر محاسبات.

## F1 — تغییر رمز شخصی
با Owner و سپس Accountant:
1. Settings → حساب کاربری.
2. دکمه «تغییر رمز من» باید دیده شود.
3. با رمز فعلی اشتباه، تغییر باید رد شود.
4. رمز جدید کمتر از ۸ کاراکتر باید رد شود.
5. رمز جدید و تکرار متفاوت باید رد شود.
6. با رمز فعلی صحیح و رمز جدید معتبر، پیام موفقیت بگیرید.
7. Logout کنید و با رمز جدید Login کنید؛ رمز قبلی نباید کار کند.

## F2 — Workspace تکراری حسابدار
برای User B که در Gateهای قبلی:
- یک Workspace شخصی خودکار با نام «فضای مالی من» دارد؛
- و عضو Workspace کاری User A با نقش Accountant است:

1. Login/Hard Refresh.
2. Workspace شخصی پیش‌فرض نباید به‌عنوان گزینه دوم در Header نمایش داده شود.
3. اگر فقط همان Workspace کاری مؤثر باقی مانده، کل Workspace Switcher باید مخفی باشد.
4. Settings باید فقط نقش «حسابدار» Workspace کاری را نشان دهد.
5. داده Workspace کاری درست باشد و داده‌ای با Workspace شخصی مخلوط نشود.

نکته: Workspace شخصی از دیتابیس حذف نمی‌شود؛ فقط bootstrap خودکارِ تکراری از UX حذف می‌شود.

## F3 — چند Workspace واقعی
اگر کاربری واقعاً عضو دو Workspace کاری متفاوت با نام‌های متفاوت است:
- Workspace Switcher باید همچنان نمایش داده شود.
- جابه‌جایی باید Ledger و گزارش‌های درست هر Workspace را بارگذاری کند.

## F4 — واحد پول
با User B حسابدار:
1. واحد را ریال انتخاب کنید و Refresh کنید.
2. همان Workspace باید ریال بماند.
3. Owner همان Workspace نباید تحت تأثیر قرار گیرد.
4. هیچ رجوعی به Workspace شخصی مخفی برای preference رخ ندهد.

## F5 — داشبورد
Expected titles/copy:
- `✦ Avan Intelligence` → «تحلیل مالی»
- متن CFO Autopilot حذف شود.
- متن «پاسخ از داده‌های واقعی Workspace...» حذف شود.
- `🛡 Business Risk Radar` → «کنترل و ریسک»
- متن Continuous Audit Lite حذف شود.
- `Continuous Audit` → «کنترل‌های مستمر» و متن Duplicate/Integrity حذف شود.
- `🎯 Smart Collection Agent` → «وصول مطالبات» و متن Aging/اثر نقدی حذف شود.
- `✓ Month-End Autopilot` → «آمادگی پایان دوره».
- متن طولانی Close Assistant حذف شود.
- «مطالبات و بدهی تجاری» → «سررسید مطالبات و بدهی‌ها» و متن `Aging مبتنی بر Ledger...` حذف شود.

KPIها، امتیاز ریسک، جداول Aging، Collection و Month-End باید همچنان نمایش داده شوند.

## F6 — Regression
- Dashboard بدون خطا باز شود.
- Draft journal save/delete کار کند.
- Reports باز شود.
- Invoice draft کار کند.
- Rial/Toman conversion بدون drift باشد.
- Health orphan lines = 0.
- RLS cross-Workspace isolation حفظ شود.
- Owner هنوز بتواند رمز Admin/Accountant فعال را از کاربران و دسترسی‌ها تغییر دهد.
- iPhone/mobile usable باشد.

## PASS
`Gate RC1.1-F پاس شد`
