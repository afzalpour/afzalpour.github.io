# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-MT-A Multi-tenant Application Architecture** و تثبیت مسیر Platform Admin / SaaS Control Plane.

این فایل وضعیت جاری پروژه است و پس از هر Gate پاس‌شده یا تصمیم معماری مهم باید به‌روزرسانی شود.

## Startup rule for every new chat
1. `AVAN_MASTER_PROMPT.md` را بخوان.
2. این فایل را بخوان.
3. `docs/adr/README.md` و ADRهای Accepted مرتبط را بخوان.
4. Repository/PRها، Supabase migrations و آخرین Live Gate را تطبیق بده.
5. از آخرین نقطه واقعی ادامه بده؛ هیچ Gate را بدون تایید صریح کاربر PASS نکن.

---

## 1) Repository / Release Workflow
Repository: `afzalpour/afzalpour.github.io`

- Root = Production/current public root.
- `avan-staging/` = Staging development + Gate environment.
- `docs/adr/` = Architecture Decision Records.
- Workflow: Branch → PR → Diff review → Merge → Live Gate.
- Production/root promotion فقط پس از Full Regression و RC freeze.

Source of Truth:
- `AVAN_MASTER_PROMPT.md`
- `AVAN_CURRENT_STATE.md`
- Accepted ADRs
- Repository / Supabase migration truth
- نتیجه Live Gate کاربر

---

## 2) Explicit Live PASS history
- Gate B-4 Live — PASS
- Gate B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A Money UX — PASS
- RC1.1-B Currency — PASS
- RC1.1-C Unit Density — PASS
- RC1.1-D User Administration — PASS
- RC1.1-F UX Cleanup — PASS
- RC1.2-B Premium visual polish — PASS
- RC1.2-CF OCR Freeze — PASS
- RC1.2-D Unified Print & Export — PASS
- RC1.2-E Professional A4 + Company Print Identity — PASS
- RC1.2-F Mobile/iPhone Final UX — PASS
- RC1.2-F.1 Complete Mobile Navigation — PASS
- RC1.3-B Company / Operational Settings — PASS
- RC1.3-C1 Security Definer + Audit UX — PASS
- RC1.3-C1.1 Audit Role Boundary — PASS
- RC1.3-C1.2 Company Context & Isolation — PASS
- **RC1.3-MT-A Multi-tenant Application Architecture — PASS**

Not explicitly marked with Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — recovery email and password reset succeeded on desktop and iPhone web; sender branding remains deferred.

Current phase:
- **RC1.3-MT-B — Company Lifecycle / Onboarding**

Next architectural priority after MT-B:
- **RC1.3-MT-P1 — Platform Admin Control Plane**

---

## 3) Latest Important Merges
- RC1.2-D.1 Print polish: `307a65f96293fc89b621ed68bf1078f0474d921b`
- RC1.2-E Company Print Identity: `106e1b1e0ada840b2a6ae5f397f9b388c4980496`
- RC1.2-E.2 Company Profile UI stability: `99f291805f6bdb75ff7184787c687451b761d90d`
- RC1.2-F Mobile/iPhone final UX: `6123ac86a178556f74c228fc592c28769d5fbda3`
- RC1.2-F.1 Complete Mobile Navigation: `00d15b061983d5f1afdf4e9de165a292dac404b1`
- RC1.3-A1 Auth Recovery Hardening: `8807f117918dd4e25d31f8c758c3d591b3e8681d`
- RC1.3-B Company / Operational Settings: `96915960a12575364cde0ad081e1ede6059fe1e1` (PR #26)
- RC1.3-C1 Security Definer + Audit UX: `2245b0c59ff7ac80f1de4424f7d231d453610f24` (PR #27)
- RC1.3-C1.1 Audit Role Boundary: `d8b31318e3bcc7f53730403fbcca726704a52bfe` (PR #28)
- ADR-0014 Multi-tenant Company + Platform Admin: `8a8723ba28f0bed82b39bbc1ade93e1361ef87b8` (PR #29)
- RC1.3-C1.2 Company Context & Isolation: `952fa37ba874da5f06630a23d1f80a8b012f3186` (PR #30)
- **RC1.3-MT-A Central CompanyContext + Company Portfolio: `b11f2aeb25d9315adc6969607e4b5535a598bf39` (PR #31)**

PWA staging cache after MT-A: **v35**.

---

## 4) Core Financial Invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Financial data is not stored in LocalStorage/SessionStorage.
- Auth + Workspace/Company-based RLS active.
- Journal lifecycle: `Draft → Posted → Reversed`.
- Posted journal and lines are immutable.
- Corrections use Reversal/controlled workflow.
- Canonical Ledger currency storage = integer Toman.
- Rial/Toman is presentation/input preference only.
- Browser never receives Service Role.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger; documents are not private to their creator.
- Cross-company leakage is a Blocker/Critical defect.

Relevant ADRs:
- ADR-0001 Canonical Toman
- ADR-0002 Journal immutability
- ADR-0003 Workspace/RLS boundary
- ADR-0007 Versioned Tax Rules
- ADR-0008 Unified Print/Export
- ADR-0011 Multi-workspace → Multi-company
- ADR-0013 Freeze Browser OCR
- ADR-0014 Multi-tenant Company + Platform Admin
- ADR-0015 Central CompanyContext Application Boundary

---

## 5) Authentication — RC1.3-A status
Working:
- Owner changes eligible other-user password via secure Edge Function.
- User changes own password after re-authentication.
- Forgot-password request hardened with generic anti-enumeration response, email validation, cooldown, rate-limit handling and expired/invalid callback handling.
- Recovery email delivery and password reset Live-confirmed on desktop and iPhone web.

Still deferred before Production:
- Current sender appears as Supabase because default Supabase SMTP is used.
- Custom sender branding requires custom SMTP and verified sending identity/domain.
- Final custom-domain redirect configuration when a domain exists.
- Professional Auth templates finalized with custom SMTP/domain.

---

## 6) Multi-tenant Product Architecture — ADR-0014 + ADR-0015
آوان رسماً **Multi-tenant / Multi-company SaaS** است؛ نه نرم‌افزار تک‌شرکتی.

### Three distinct authority planes
1. **Platform Admin / System Admin** — مالک/اپراتور خود آوان؛ Control Plane کل SaaS.
2. **Company Owner / Manager** — مدیر یک Company مشخص.
3. **Accountant / Viewer** — نقش عملیاتی داخل یک Company مشخص.

این سه سطح نباید با یکدیگر ادغام شوند.

### Platform Admin principle
Platform Admin همان نقش مالک SaaS است؛ یعنی کسی که نرم‌افزار را به چند شرکت ارائه می‌کند ولی الزاماً حسابدار هیچ‌یک از آن شرکت‌ها نیست.

Platform Admin:
- عضو خودکار Companyها نیست.
- به‌طور پیش‌فرض Ledger/Invoices/Documents هیچ Company را نمی‌بیند.
- Company/Tenant lifecycle، پلن، وضعیت سرویس، محدودیت‌ها، سلامت سیستم، عملیات پشتیبانی و مدیریت تجاری SaaS را کنترل می‌کند.
- Support Access به داده Tenant در آینده فقط Explicit + Time-bounded + Reason-required + Audit-logged خواهد بود.
- Service Role/secret هرگز وارد Browser نمی‌شود.

### Company membership and data
- User می‌تواند Owner یک Company و Accountant/Manager Company دیگر باشد.
- Journal / Invoice / Document / Account / Party / Report به Company تعلق دارند، نه سازنده سند.
- Company Profile متعلق به Company است، نه User.
- Owner/Manager Company آن را ویرایش می‌کنند؛ Accountant/Viewer Read-only هستند.

### Application hierarchy
`Auth → Company Portfolio → Active Company → Accounting / Sales / Inventory / Tax / Treasury / Reports`

Company Portfolio یک سطح بالاتر از Company App است و Ledger چند Company را ترکیب نمی‌کند.

Platform Admin در آینده Shell/Route جداگانه Control Plane خواهد داشت و از Company Portfolio کاربر عادی جدا می‌ماند.

---

## 7) RC1.3-C1.2 — LIVE PASS
User explicitly confirmed: `Gate RC1.3-C1.2 پاس شد`.

Implemented and retained:
- owned/personal Company context is no longer suppressed merely because User is a member of another Company.
- explicit `شرکت فعال` selector.
- Role shown for the active Company.
- Settings order improved.
- Company Profile editability follows Role of active Company.
- same-company shared Ledger behavior retained intentionally.
- cross-company isolation Gate passed.

### Company isolation DB hardening
Legacy `journal_lines` Draft RLS tautology `e.workspace_id = e.workspace_id` was fixed.

Composite Company constraints enforce that a journal line and referenced parent entities belong to the same Company:
- journal line → journal entry `(id, workspace_id)`
- journal line → account `(id, workspace_id)`
- journal line → optional party `(id, workspace_id)`

Before and after migration:
- journal workspace mismatch = 0
- account workspace mismatch = 0
- party workspace mismatch = 0

This finding is resolved.

---

## 8) RC1.3-MT-A — LIVE PASS
User explicitly confirmed: `Gate RC1.3-MT-A پاس شد`.

PR #31 merge:
`b11f2aeb25d9315adc6969607e4b5535a598bf39`

No database migration was needed in MT-A.
No Ledger/journal lifecycle/RLS semantics were changed.

### Central CompanyContext
Source:
- `avan-staging/src/application/company/company-context.js`

Rules:
- one authoritative CompanyContext per browser page.
- active Company validated against complete RLS-authorized Company list.
- single accessible Company may auto-select.
- multiple Companies with no valid Session selection require explicit Company selection.
- stale/unauthorized stored Company ids are rejected and cleared.
- only active Company id is stored as Session/UI preference; financial data is not stored locally.

### AvanCloud singleton
`installAvanCloud()` now returns one page-level Cloud/Supabase client with `cloud.companyContext`.
Parallel page-level Supabase clients are not the intended architecture.

### Compatibility facade
Legacy `workspaces[0]` / `ctx.workspace` behavior is controlled by CompanyContext during transition:
- legacy full workspace reads are ordered to active Company.
- legacy `limit=1` reads are explicitly scoped to active Company.
- no active selection in a multi-Company account raises `COMPANY_SELECTION_REQUIRED` rather than silently choosing the first Company.

### Company Portfolio / Shell
- `شرکت فعال` selector.
- `شرکت‌های من` Portfolio.
- authorized Companies + User Role per Company.
- desktop overlay + mobile/iPhone bottom sheet.
- required selection is non-dismissible.
- Portfolio does not aggregate Company Ledgers.

### Modules already following Provider
- User money/display preference resolver.
- Audit Log.
- Company selector / Portfolio.
- remaining legacy modules are protected by compatibility facade pending MT-C cleanup.

MT-A Live Gate passed including multi-company synchronization, session/access behavior and mobile flow.

---

## 9) Company Print Identity / Operational Profile
Source of truth:
- `public.workspace_print_profiles`
- `get_workspace_print_profile(wid)`
- `set_workspace_print_profile(wid,p_profile)`
- private bucket `avan-branding`

Fields:
- display/legal name
- entity type
- registration/national/economic/tax IDs
- phone/email/postal code
- province/city/address
- invoice footer
- private logo

RC1.3-B = Live PASS.

---

## 10) Audit / Security — RC1.3-C1 + C1.1
### C1
- all 43 public SECURITY DEFINER functions: PUBLIC execute=0, anon execute=0, authenticated preserved.
- Audit Log UX added.

### C1.1
- `audit_logs` broad privileges removed from anon/authenticated.
- authenticated can SELECT only safe columns used by UI.
- `before_json/after_json` unavailable to browser users.
- Owner/Manager see admin/access audit events.
- Accountant/Viewer do not see admin/access events.
- Live two-user Gate passed.

Security Advisor still warns that many SECURITY DEFINER functions are callable by authenticated users; some are intentional browser RPCs. Further reduction must be dependency-by-dependency, not bulk.

Leaked Password Protection remains disabled and is pending Auth operational hardening where plan support allows.

---

## 11) Settings UX target
Settings order:
1. **حساب کاربری** — global User identity/password/session
2. **مشخصات شرکت و چاپ** — active Company
3. **کاربران و دسترسی‌ها** — Company admins only
4. Company financial/display/operational settings
5. **گزارش فعالیت**
6. security/operational controls

Future architecture should increasingly separate `تنظیمات حساب من` from `تنظیمات شرکت فعال`.

---

## 12) Mobile / iPhone
RC1.2-F, F.1 and MT-A mobile flow = Live PASS.

Bottom Nav:
- خانه
- حساب‌ها
- ثبت
- گزارش
- بیشتر

`بیشتر`:
- فاکتورها
- اسناد حسابداری
- اسناد هوشمند
- طرف‌حساب‌ها
- تنظیمات

MT-A adds mobile-safe Company Portfolio / Company switching.

---

## 13) Smart Documents / OCR
Browser-local OCR is Frozen under ADR-0013.

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Do not restart browser-local OCR tuning without a new ADR/benchmark decision.

---

## 14) Immediate roadmap before Production
### Current: RC1.3-MT-B — Company Lifecycle / Onboarding
Purpose: make a Company a real SaaS tenant lifecycle, not an implicit bootstrap Workspace.

Targets:
- explicit Create Company flow
- Company rename/display identity
- Owner assignment
- initial Company Profile setup
- initial fiscal/company setup
- remove bootstrap naming ambiguity
- Company Portfolio becomes entry point for Create/Enter Company lifecycle
- lifecycle primitives needed later by Platform Admin are designed so Control Plane can use them safely

### Next priority: RC1.3-MT-P1 — Platform Admin Control Plane Skeleton
This is the operator/admin experience for the owner of Avan SaaS, not Company accounting admin.

Targets:
- separate `platform_admin/system_admin` data model outside `workspace_members`
- separate protected Platform Admin route/shell
- Tenant/Company registry
- Company status: active / suspended / onboarding / archived as appropriate
- identify Company owner and operational metadata without reading Company Ledger
- high-level user/company counts and system health
- platform-level audit events
- no default tenant Ledger/Invoice/Document access
- explicit authorization boundary between Control Plane and Tenant Plane

### RC1.3-MT-P2 — SaaS Operations
After P1 foundation:
- Plans/subscriptions/feature limits
- tenant activation/suspension controls
- onboarding/support status
- operational limits/quotas where needed
- controlled ownership/account recovery operations
- system-wide operational reporting that uses metadata, not tenant Ledger content

### RC1.3-MT-P3 — Controlled Support Access
If support access to tenant data is required:
- explicit support session
- reason required
- short time limit
- least privilege/read-only by default
- complete audit trail
- visible/revocable access semantics
- never implicit access merely because user is Platform Admin

### RC1.3-MT-C — Module Boundary Cleanup
- directly inject CompanyContext into remaining legacy modules
- remove first-workspace assumptions
- progressively remove `ctx.workspace` compatibility alias
- retain physical DB `workspace_id` until a justified migration exists

### Operational/Security completion
- backup/restore strategy
- session controls
- leaked-password protection review
- remaining SECURITY DEFINER dependency-by-dependency hardening

### RC1.3-D — Full Regression
- Platform Admin vs Company Role separation
- multi-company/two-user RLS
- CompanyContext/Portfolio
- Draft/Posted/Reversed immutability
- invoices/reports/currency/fiscal periods
- orphan lines zero
- Smart Documents manual flow
- print/export/company identity
- mobile/iPhone/navigation
- auth recovery

### RC1.3-RC
- feature freeze
- Blocker/Critical fixes only

Then:
- approved Staging → Production/root promotion
- custom domain + production SMTP/sender branding finalized when domain exists.

---

## 15) Official Product Direction
آوان = حسابداری + انبار + فروش + مالیات + خزانه + اتوماسیون + AI + Voice + تصمیم‌یار مدیریتی.

Future pillars:
- CFO Autopilot / explainable KPIs / cash forecast / scenarios
- Continuous Audit / Collections / Close Autopilot
- stronger server/provider Document AI with human-controlled posting
- Inventory Stock Ledger / multi-warehouse / costing
- Sales & Purchase lifecycle
- Versioned Tax/VAT + electronic invoicing based on current law at implementation time
- Treasury / bank reconciliation / cheque lifecycle
- Payroll / Fixed Assets / Budgeting
- Approval workflows / Multi-company / integrations
- Persian Voice AI with explicit consent; never voice as financial authentication

Governing principle:
**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**