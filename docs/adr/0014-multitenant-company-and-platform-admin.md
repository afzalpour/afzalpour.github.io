# ADR-0014 — Multi-tenant Company Model and Platform Administration

- Status: Accepted
- Date: 2026-09-05
- Extends: ADR-0011 Multi-workspace → Multi-company

## Context
آوان باید یک Core مشترک برای چند شرکت مستقل باشد، نه یک نرم‌افزار تک‌شرکتی با یک ادمین مرکزی. هر کاربر ممکن است هم‌زمان مالک شرکت خودش باشد و در شرکت دیگری نقش حسابدار/مدیر داشته باشد. داده مالی هر شرکت باید مستقل بماند، اما کاربران مجاز همان شرکت باید دفتر مالی مشترک همان شرکت را ببینند.

همچنین برای 운영 کل SaaS به یک سطح مدیریتی بالاتر از شرکت‌ها نیاز است؛ این سطح نباید با نقش Owner/Manager یک شرکت یکی باشد و نباید به‌طور پیش‌فرض به Ledger شرکت‌ها دسترسی داشته باشد.

## Decision

### 1. مدل محصول
آوان یک **Multi-tenant / Multi-company SaaS** است.

- هر `Workspace` در مسیر محصول به یک `Company` / `Business Context` تبدیل می‌شود.
- هر Company مرز مستقل داده، تنظیمات، چاپ، کاربران، Ledger و RLS است.
- یک User می‌تواند عضو چند Company باشد و در هر Company نقش متفاوت داشته باشد.
- User می‌تواند Owner شرکت خودش و Accountant/Manager شرکت دیگری باشد.

### 2. اشتراک اسناد داخل شرکت
اسناد مالی به Company تعلق دارند، نه به سازنده سند.

- Journal, Invoice, Document و سایر داده‌های مالی دارای `workspace_id/company_id` هستند.
- اعضای مجاز یک Company طبق Role/Permission باید دفتر مالی مشترک همان Company را ببینند.
- جداسازی اسناد بر اساس `created_by` داخل یک Company ممنوع است، مگر برای workflowهای مشخص مانند Assigned Task یا Personal Draft که در ADR جدا تعریف شوند.
- داده Company A هرگز نباید در Company B دیده شود.

### 3. مشخصات شرکت
`workspace_print_profiles` / Company Profile متعلق به Company است، نه User.

- Owner/Company Admin/Manager مجاز می‌توانند مشخصات Company فعال را ویرایش کنند.
- Accountant/Viewer در Company دیگر فقط Read-only هستند مگر Permission صریح جداگانه بعداً تعریف شود.
- هر User که Owner یک Company دیگر است، در Context همان Company می‌تواند نام و مشخصات شرکت خودش را کامل کند.
- Company Profile per-user داخل یک Company ایجاد نمی‌شود، چون هویت حقوقی/چاپی شرکت باید واحد باشد.

### 4. Company Selector
Context فعال باید صریح و همیشه قابل تشخیص باشد.

- UX باید همه Companyهایی را که User به آن‌ها دسترسی دارد نشان دهد؛ Workspace شخصیِ Owned صرفاً به‌خاطر عضویت در Company دیگر مخفی نمی‌شود.
- Selector با عنوان محصولی `شرکت فعال` جایگزین اصطلاح مبهم Workspace در UX می‌شود.
- تغییر Company فعال Session/UI preference است و نباید داده مالی را در LocalStorage نگه دارد.
- Header/Settings باید نام و Role در Company فعال را نمایش دهند.

### 5. نقش‌های سطح Company
حداقل نقش‌ها:

- `owner` — مالک Company؛ بالاترین اختیار داخل همان Company
- `manager` / Company Admin — مدیریت عملیاتی و کاربران طبق Guardrailها
- `accountant` — عملیات حسابداری مجاز و مشاهده دفتر مشترک Company
- `viewer` — مشاهده طبق Permissionها

نام UX `ادمین شرکت` می‌تواند برای Manager استفاده شود، اما Role دیتابیس تا مهاجرت رسمی تغییر نام نمی‌کند.

### 6. Platform Admin / System Admin
سطحی جدا از Company roles ایجاد می‌شود:

- `platform_admin` / `system_admin` متعلق به Control Plane آوان است، نه `workspace_members`.
- وظایف: مدیریت Tenant/Company lifecycle، Subscription/Plan، سلامت سیستم، محدودیت‌ها، پشتیبانی و عملیات پلتفرم.
- Platform Admin **به‌طور پیش‌فرض حق خواندن Ledger/Invoices/Documents شرکت‌ها را ندارد**.
- هر Support Access به داده Company باید Explicit، Time-bounded، Reason-required و Audit-logged باشد.
- هیچ Service Role/secret در Browser قرار نمی‌گیرد.

### 7. تنظیمات UX
ترتیب استاندارد Settings:

1. `حساب کاربری` — تنظیمات شخصی User، رمز و Session
2. `شرکت فعال / مشخصات شرکت و چاپ`
3. `کاربران و دسترسی‌ها` — فقط نقش‌های مجاز Company
4. تنظیمات مالی/نمایش/عملیاتی Company
5. `گزارش فعالیت`
6. امنیت و کنترل‌های عملیاتی

## Consequences
- رفتار فعلی که Accountant همان Company اسناد Owner را می‌بیند، در اصل صحیح است.
- مشکل UX فعلی این است که Owned Workspace شخصی User ممکن است به‌دلیل Suppression مخفی شود؛ این باید اصلاح شود.
- Company isolation باید همچنان در DB/RLS enforce شود، نه فقط UI.
- Company Profile برای Accountant یک Company read-only می‌ماند، ولی همان User در Company خودش Owner است و Profile آن Company را ویرایش می‌کند.
- Platform Admin به‌صورت Control Plane جدا طراحی می‌شود و با Company Owner ادغام نمی‌شود.

## Guardrails / Invariants
- هر رکورد مالی باید به Company/Workspace صحیح Scope شود.
- Cross-company data leakage = Blocker/Critical security defect.
- `created_by` جایگزین Company boundary نیست.
- Company identity داخل یک Company واحد است؛ per-user company identity در همان Company ممنوع است.
- Platform Admin نباید implicit tenant-ledger access داشته باشد.
- Active Company باید صریح، قابل Audit و در تمام ماژول‌ها یکسان Resolve شود.
- Consolidated Reporting فقط لایه بالاتر است و Ledger شرکت‌ها را ادغام فیزیکی نمی‌کند.

## Rejected Options
### Single-company product
رد شد؛ با مسیر Multi-company، RLS و SaaS آینده آوان سازگار نیست.

### Per-user isolated accounting inside one Company
رد شد؛ دفتر مالی مشترک Company را تکه‌تکه می‌کند و گزارش‌های شرکت را ناسازگار می‌سازد.

### Platform Admin as Owner of every Company
رد شد؛ Least Privilege و Tenant Privacy را نقض می‌کند.

## Implementation / Gates
### RC1.3-C1.2 — Company Context & Settings UX
- stop suppressing owned personal/company workspace
- Company selector visible when >1 company
- label `شرکت فعال`
- Settings reorder per this ADR
- Company profile edit based on role in active Company
- verify same-company shared documents + cross-company isolation

### RC1.3-C1.3 — Company Creation / Rename
- explicit Create Company flow
- owner assignment
- company rename / profile initialization
- no hidden bootstrap ambiguity

### RC1.3-C2 — Platform Control Plane Skeleton
- platform admin data model in non-tenant control plane
- tenant/company registry and status
- no default ledger access
- audited support-access design

### RC1.3-C3 — Backup / Restore / Operational Controls
- backup strategy
- restore procedure
- session controls
- operational safety checks

All above require two-user / multi-company RLS Gate before RC freeze.
