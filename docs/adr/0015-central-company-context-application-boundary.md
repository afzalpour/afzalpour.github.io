# ADR-0015 — Central CompanyContext as the Application Tenant Boundary

- Status: Accepted
- Date: 2026-09-05
- Extends: ADR-0014 Multi-tenant Company Model and Platform Administration

## Context

ADR-0014 مشخص کرد که آوان یک SaaS چندشرکتی است، اما Application Shell تاریخی هنوز از الگوی تک‌شرکتی رشد کرده بود: چند ماژول به‌صورت مستقل جدول `workspaces` را می‌خواندند و در نهایت به اولین ردیف تکیه می‌کردند. تا زمانی که فقط یک Company وجود داشت این رفتار پنهان می‌ماند، اما در مدل واقعی Multi-tenant باعث چند مشکل می‌شود:

- هر ماژول می‌تواند Company فعال را جداگانه Resolve کند.
- تغییر Company ممکن است در یک ماژول اعمال شود ولی ماژول دیگر روی Context قبلی بماند.
- نبود انتخاب صریح در حسابی با چند Company می‌تواند به انتخاب ضمنی اولین Workspace منجر شود.
- چند بار اجرای bootstrap کلاینت Cloud می‌تواند State موازی در Browser بسازد.
- اصطلاح Workspace در Application UX مرز محصولی Company را مبهم می‌کند.

این وضعیت برای افزودن Inventory, Tax, Treasury, Payroll, AI و Platform Control Plane قابل ادامه نیست.

## Decision

### 1. یک CompanyContext واحد برای کل Application

آوان یک Provider مرکزی با مفهوم `CompanyContext` دارد.

وظایف آن:
- فهرست Companyهای مجاز User را Resolve کند.
- Company فعال را نگه دارد.
- اعتبار دسترسی Company انتخاب‌شده را بررسی کند.
- نام نمایشی و Role همان User را در هر Company Resolve کند.
- تغییر Company را از یک مسیر واحد انجام دهد.
- State لازم برای Portfolio / Company Selector را ارائه کند.

هیچ ماژول جدید تجاری اجازه ندارد برای تعیین Tenant مستقیماً `workspaces[0]` یا معادل آن را انتخاب کند.

### 2. Cloud Client در هر صفحه Singleton است

`installAvanCloud()` باید در یک page lifecycle همان Client موجود را بازگرداند.

- چند Supabase client موازی برای ماژول‌های UI ممنوع است.
- `CompanyContext` روی همان Client singleton نصب می‌شود.
- Service Role/secret همچنان هرگز وارد Browser نمی‌شود.

### 3. رفتار انتخاب Company

- اگر User فقط یک Company مجاز داشته باشد، همان Company می‌تواند به‌صورت خودکار Context فعال شود.
- اگر User چند Company داشته باشد و Session یک Company معتبر انتخاب نکرده باشد، UI باید **Company Portfolio** را اجباری کند و User پیش از ادامه یک Company را انتخاب کند.
- انتخاب فعال فقط شناسه Company در Session/UI preference است؛ هیچ داده مالی در SessionStorage/LocalStorage ذخیره نمی‌شود.
- Company ذخیره‌شده اگر دیگر برای User مجاز نباشد باید رد و پاک شود.

### 4. Company Portfolio یک سطح بالاتر از Company App است

Application hierarchy:

`Auth → Company Portfolio → Active Company → Accounting / Sales / Inventory / Tax / Treasury / Reports`

Portfolio متعلق به یک Company خاص نیست و فقط Companyهایی را نشان می‌دهد که User مجاز است وارد آن‌ها شود.

در RC1.3-MT-A:
- Portfolio انتخاب Company را انجام می‌دهد.
- ایجاد Company جدید هنوز در MT-B پیاده می‌شود.

### 5. Compatibility Facade برای Core فعلی

Database schema فعلاً `workspace_id` را نگه می‌دارد و Core مالی بازنویسی نمی‌شود.

برای جلوگیری از Refactor پرریسک یک‌باره:
- queryهای legacy روی `workspaces` از یک compatibility facade عبور می‌کنند.
- اگر Company فعال معتبر وجود داشته باشد، Provider آن Company را در ردیف اول facade قرار می‌دهد.
- این فقط Compatibility است؛ انتخاب واقعی Tenant متعلق به CompanyContext است.
- کد جدید نباید بر این facade به‌عنوان API معماری تکیه کند.

`ctx.workspace` در Core فعلی می‌تواند موقتاً alias داخلی Active Company باقی بماند تا در Refactorهای بعدی حذف شود.

### 6. Context یکسان برای تمام ماژول‌ها

موارد زیر باید از یک Company فعال واحد نتیجه بگیرند:
- Ledger / Journals
- Invoices
- Smart Documents
- Accounts / Parties
- Reports
- Money/display preferences
- Company Profile / Print Identity
- Company members and roles
- Audit Log
- تمام ماژول‌های آینده

تغییر Company نباید ترکیبی از داده‌های Company قبلی و جدید در UI باقی بگذارد.

### 7. Terminology

- UX محصول: `شرکت`, `شرکت فعال`, `شرکت‌های من`
- Database legacy: `workspace_id` تا Migration برنامه‌ریزی‌شده آینده مجاز است.
- تغییر نام فیزیکی ستون‌ها صرفاً برای زیبایی اصطلاحات در این مرحله ممنوع است؛ ارزش امنیتی/عملیاتی ندارد و Migration پرریسک ایجاد می‌کند.

## Guardrails / Invariants

- Active Company فقط از CompanyContext Resolve می‌شود.
- Company انتخاب‌شده باید عضو فهرست مجاز همان User باشد.
- Cross-company leakage = Blocker/Critical defect.
- Company switch باید Context تمام ماژول‌های Company-scoped را با هم تغییر دهد.
- Portfolio نباید Ledger چند Company را بخواند یا تجمیع کند.
- Consolidated Reporting یک Feature مستقل آینده است، نه رفتار Portfolio.
- Platform Admin همچنان خارج از tenant membership است و این ADR به او دسترسی Ledger نمی‌دهد.
- `workspace_id` DB همان مرز RLS معتبر فعلی باقی می‌ماند.

## Rejected Options

### ادامه مدل `first workspace wins`
رد شد؛ Tenant resolution را ضمنی و پراکنده نگه می‌دارد.

### ذخیره تمام Company data در Browser هنگام Portfolio
رد شد؛ Portfolio فقط metadata مجاز Company را نیاز دارد و نباید داده مالی Tenantها را preload کند.

### Rename فوری تمام `workspace_id`ها به `company_id`
رد شد؛ در این مرحله ریسک Migration بالا و ارزش عملیاتی پایین دارد. Semantic migration ابتدا در Application انجام می‌شود.

### یک Supabase Client برای هر Company
رد شد؛ Session/Auth مشترک است و Company isolation باید با Context + RLS انجام شود، نه Clientهای موازی.

## Implementation / Gates

### RC1.3-MT-A
- add `src/application/company/company-context.js`
- make AvanCloud page-level singleton
- expose `cloud.companyContext`
- legacy workspace queries ordered by CompanyContext compatibility facade
- add `شرکت‌های من` Portfolio
- require explicit selection when multiple Companies and no valid active Session exists
- Company selector and Portfolio use same Provider
- user money preference resolver no longer picks first workspace independently
- Audit Log resolves Company from Provider
- PWA cache includes CompanyContext module
- multi-company synchronization Live Gate

### Next
- **RC1.3-MT-B — Company Lifecycle / Onboarding**: Create Company, rename, initial profile/fiscal setup, owner assignment.
- **RC1.3-MT-C — Module Boundary Cleanup**: migrate remaining legacy modules from compatibility facade to direct CompanyContext injection and remove `ctx.workspace` alias progressively.
- Platform Control Plane remains a later separate phase under ADR-0014.
