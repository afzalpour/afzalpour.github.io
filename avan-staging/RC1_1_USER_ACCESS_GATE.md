# Avan Core 1.0 — RC1.1-D User Access Gate

## هدف
مدیریت امن کاربران Workspace بدون service-role در مرورگر و بدون شکستن RLS دوکاربره.

## مدل این Gate
- نقش‌های UI: **مالک / مدیر (Admin) / حسابدار**.
- تغییر عضویت فقط از RPCهای کنترل‌شده انجام می‌شود.
- حذف دسترسی Soft است (`is_active=false`)؛ تاریخچه مالی حذف نمی‌شود.
- کاربر فعلی نمی‌تواند دسترسی خودش را از پنل تغییر دهد.
- آخرین Owner فعال قابل حذف/تنزل نیست.
- Admin فقط حسابدارها را مدیریت می‌کند؛ Owner می‌تواند همه نقش‌ها را مدیریت کند.
- در این Gate ایمیل دعوت ارسال نمی‌شود. برای ایمیل بدون حساب، دعوت Pending ذخیره می‌شود و بعد از ساخت و تأیید حساب با همان ایمیل در ورود بعدی Claim می‌شود.

---

## D0 — نصب Migration
یک بار فایل زیر را در همان Supabase پروژه Staging اجرا کن:

`RC1_1_USER_ACCESS_PATCH.sql`

Expected:
- بدون Error تمام شود.
- ستون‌های `workspace_members.is_active` و `updated_at` وجود داشته باشند.
- جدول `workspace_invitations` ساخته شده باشد.
- RPCهای زیر وجود داشته باشند:
  - `list_workspace_access`
  - `invite_workspace_member`
  - `manage_workspace_member`
  - `cancel_workspace_invitation`
  - `claim_workspace_invitations`

بعد Staging را Hard Refresh یا Private/Incognito باز کن.

---

## D1 — Owner UI
با User A (مالک اصلی):
1. Settings را باز کن.
2. کارت **کاربران و دسترسی‌ها** باید دیده شود.
3. ردیف خود User A باید:
   - نقش «مالک» داشته باشد؛
   - فعال باشد؛
   - برچسب «شما» داشته باشد؛
   - کنترل تغییر نقش/غیرفعال‌سازی خودش disabled باشد.
4. هیچ خطای Console جدید نباشد و تایپ داخل فیلد ایمیل نباید به‌علت re-render پاک شود.

---

## D2 — افزودن کاربر موجود به عنوان Accountant
از همان ایمیل User B که در Gate دوکاربره قبلی حساب Supabase تأییدشده دارد استفاده کن:
1. User A → Settings → کاربران و دسترسی‌ها.
2. ایمیل User B را وارد کن.
3. نقش «حسابدار» را انتخاب و **دعوت / افزودن** را بزن.
4. Expected: پیام موفقیت و User B در لیست اعضا به‌صورت فعال دیده شود.

سپس User B در یک Session مستقل:
5. Login/Refresh کند.
6. چون User B قبلاً Workspace شخصی خودش را دارد، بالای برنامه **انتخاب‌گر فضای کاری** باید ظاهر شود.
7. Workspace مربوط به User A را انتخاب کند.
8. بعد از reload باید داده Workspace A را ببیند.
9. Workspace شخصی User B همچنان از انتخاب‌گر قابل انتخاب باشد.

**P0:** انتخاب یک Workspace نباید رکوردهای Workspace دیگر را با آن مخلوط کند.

---

## D3 — Accountant permissions
در Workspace A با User B (Accountant):
1. Settings را باز کن.
2. کارت **کاربران و دسترسی‌ها** نباید برای Accountant نمایش داده شود.
3. داده‌های مالی Workspace A مطابق RLS قابل مشاهده باشد.
4. Workspace دیگری که User B عضو آن نیست نباید قابل مشاهده شود.

---

## D4 — Role change to Admin
User A:
1. نقش User B را از «حسابدار» به **مدیر (Admin)** تغییر دهد.
2. User B refresh/login کند و Workspace A را انتخاب کند.
3. Settings → کارت کاربران و دسترسی‌ها باید برای User B نمایش داده شود.
4. Admin باید بتواند یک Accountant را مدیریت کند.
5. Admin نباید بتواند Owner را تغییر نقش یا غیرفعال کند.
6. Admin نباید بتواند Owner/Admin جدید بسازد؛ گزینه دعوت او فقط Accountant است.

سپس برای ادامه تست، User A می‌تواند User B را دوباره Accountant کند.

---

## D5 — Deactivate / Reactivate و RLS واقعی
User A، User B را غیرفعال کند.

در Session User B:
1. Refresh کند.
2. Workspace A باید از Workspaceهای قابل انتخاب حذف شود.
3. User B نباید داده Workspace A را ببیند.
4. Workspace شخصی خودش همچنان قابل استفاده باشد.

User A دوباره User B را فعال کند.

User B:
5. Refresh/Login کند.
6. Workspace A باید دوباره ظاهر شود و قابل انتخاب باشد.

**P0:** غیرفعال‌سازی فقط مخفی‌کردن UI نیست؛ `has_workspace_access` باید دسترسی واقعی RLS را قطع کند.

---

## D6 — Pending Invitation
User A:
1. یک ایمیل تستی که هنوز حساب Supabase ندارد وارد کند.
2. نقش Accountant را بزند.
3. Expected: در بخش **دعوت‌های در انتظار** ظاهر شود.
4. هیچ ادعایی مبنی بر ارسال ایمیل نباید نمایش داده شود.
5. «لغو دعوت» را بزند؛ دعوت باید از لیست Pending حذف شود.

---

## D7 — Owner safety
- User A نباید بتواند خودش را از UI غیرفعال یا تنزل نقش دهد.
- Workspace باید همیشه حداقل یک Owner فعال داشته باشد.
- هیچ مسیر UI نباید بتواند آخرین Owner را قفل کند.

---

## D8 — Workspace switching regression
با User B که حداقل دو Workspace دارد:
1. بین Workspace شخصی و Workspace A چند بار جابه‌جا شو.
2. بعد از هر تغییر صفحه reload می‌شود.
3. نام Workspace، حساب‌ها، اسناد، گزارش‌ها و Health باید متعلق به Workspace انتخاب‌شده باشند.
4. Preference فقط در Session مرورگر است؛ هیچ داده مالی در LocalStorage/SessionStorage ذخیره نمی‌شود.

---

## D9 — Accounting/RLS Regression
روی Workspace A حداقل این‌ها را smoke-test کن:
- Dashboard باز شود.
- یک Draft سند دستی باز/ذخیره/حذف شود.
- Reports باز شود.
- Currency switch ریال/تومان همچنان درست باشد.
- Health: orphan line = 0.
- داده Workspaceهای دیگر cross-visible نباشند.

---

## D10 — Mobile / iPhone
- Workspace switcher overflow نداشته باشد.
- کارت کاربران responsive باشد.
- فیلد ایمیل و Role قابل استفاده باشند.
- Console خطای جدید نداشته باشد.

## PASS
اگر D0 تا D10 پاس شد:

`Gate RC1.1-D پاس شد`
