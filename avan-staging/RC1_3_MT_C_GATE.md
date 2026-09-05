# RC1.3-MT-C — Module Boundary Cleanup Gate

هدف: اثبات اینکه Active Company فقط از CompanyContext/CompanyBoundary تعیین می‌شود و هیچ ماژول Legacy نمی‌تواند Tenant را با الگوی «اولین Workspace» مستقل انتخاب کند.

## تغییر معماری
- `CompanyContext` همچنان Source of Truth انتخاب Company است.
- `CompanyBoundary` API صریح برای `requireActiveCompany / activeCompany / listCompanies` اضافه شده است.
- Legacy `select('workspaces', ...)` دیگر فهرست Workspaceها را به ماژول‌های تجاری برنمی‌گرداند؛ فقط Company فعالِ از قبل Resolve‌شده را به‌صورت projection تک‌ردیفی نشان می‌دهد.
- اگر چند Company وجود داشته باشد و انتخاب معتبر وجود نداشته باشد، `COMPANY_SELECTION_REQUIRED` صادر می‌شود.
- اگر هیچ Company وجود نداشته باشد، `COMPANY_REQUIRED` صادر می‌شود؛ Core قدیمی اجازه bootstrap ضمنی Tenant ندارد.
- Workspace switcher قدیمی حذف/Guard شده است. Company Portfolio تنها selector محصول است.
- physical `workspace_id` در DB طبق ADR-0015 دست‌نخورده باقی مانده است.

## Live Gate
1. Hard Refresh؛ با User چندشرکتی وارد شو.
2. از «شرکت‌های من» Company A را انتخاب کن. Dashboard، حساب‌ها، فاکتورها، اسناد، گزارش‌ها، Currency، Company Profile، کاربران/دسترسی‌ها و Audit باید متعلق به A باشند.
3. به Company B سوییچ کن. همان بخش‌ها باید همگی B را نشان دهند؛ هیچ داده A نباید باقی بماند.
4. در Topbar/Settings نباید selector قدیمی «فضای کاری» دیده شود. فقط `شرکت فعال / شرکت‌های من` مجاز است.
5. واحد پول Company A و B را متفاوت کن و بین آن‌ها سوییچ کن؛ Preference باید با Company فعال عوض شود.
6. Company Profile و کاربران/دسترسی‌ها را در هر دو Company باز کن؛ نام/Role/Member list باید با Company فعال هماهنگ باشد.
7. یک Tenant تعلیق‌شده را بررسی کن: در Portfolio دیده شود ولی قابل ورود نباشد.
8. Create Company / Rename Company از MT-B همچنان کار کند و پس از ایجاد، Company جدید Context فعال شود.
9. Platform Admin و Support Viewer مستقل باقی بمانند؛ این Cutover نباید به آن‌ها Company membership بدهد.
10. iPhone: Company switch و Settings/Currency/Profile بدون selector قدیمی و بدون stale data.

## Pass criteria
- هیچ mismatch بین Company فعال و ماژول‌های Company-scoped.
- هیچ Workspace selector مستقل در UI.
- هیچ انتخاب ضمنی first-workspace.
- هیچ cross-company leakage.
- Core مالی، Posting/Reversal و داده DB بدون تغییر رفتاری.

عبارت PASS:
`Gate RC1.3-MT-C پاس شد`
