# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-C1.2** و Merge شدن **RC1.3-MT-A Multi-tenant Application Architecture** برای Live Gate.

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
- **RC1.3-C1.2 Company Context & Isolation — PASS**

Not explicitly marked with Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — recovery email and password reset succeeded on desktop and iPhone web; sender branding remains deferred.

Current phase:
- **RC1.3-MT-A — merged on Staging, awaiting explicit Live Gate PASS.**
- Do NOT mark MT-A passed until the user explicitly says `Gate RC1.3-MT-A پاس شد`.

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
- **ADR-0015 Central CompanyContext Application Boundary**

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

### Platform / Identity / Company planes
- Platform Admin/System Admin متعلق به Control Plane آوان است و عضو خودکار Companyها نیست.
- User identity جهانی است؛ یک User می‌تواند در چند Company Role متفاوت داشته باشد.
- هر Workspace فعلی از نظر محصول یک Company / Business Context مستقل است.
- `workspace_id` فعلاً نام فیزیکی DB باقی می‌ماند؛ تغییر نام صرفاً ظاهری فعلاً انجام نمی‌شود.

### Company membership and data
- User می‌تواند Owner یک Company و Accountant/Manager Company دیگر باشد.
- Journal / Invoice / Document / Account / Party / Report به Company تعلق دارند، نه سازنده سند.
- Company Profile متعلق به Company است، نه User.
- Owner/Manager Company آن را ویرایش می‌کنند؛ Accountant/Viewer Read-only هستند.

### Platform Admin
- Platform Admin برای Tenant lifecycle, plans, system health, support operations است.
- Platform Admin به‌طور پیش‌فرض Ledger/Invoices/Documents شرکت‌ها را نمی‌بیند.
- Support Access آینده باید Explicit + Time-bounded + Reason-required + Audit-logged باشد.

### Application hierarchy after ADR-0015
`Auth → Company Portfolio → Active Company → Accounting / Sales / Inventory / Tax / Treasury / Reports`

Company Portfolio یک سطح بالاتر از Company App است و نباید Ledger چند Company را ترکیب کند.

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

Composite Company constraints now enforce that a journal line and its referenced parent entities belong to the same workspace/Company:
- journal line → journal entry `(id, workspace_id)`
- journal line → account `(id, workspace_id)`
- journal line → optional party `(id, workspace_id)`

Before and after migration:
- journal workspace mismatch = 0
- account workspace mismatch = 0
- party workspace mismatch = 0

This finding is **resolved**, not pending.

---

## 8) RC1.3-MT-A — merged, awaiting Live Gate
PR #31 merge:
`b11f2aeb25d9315adc6969607e4b5535a598bf39`

No database migration was needed in MT-A.
No `app.js` rewrite was performed; existing Core uses a controlled compatibility facade during the transition.

### Central CompanyContext
New source:
- `avan-staging/src/application/company/company-context.js`

Rules:
- exactly one authoritative CompanyContext per browser page.
- active Company is validated against the complete RLS-authorized Company list.
- a single accessible Company may auto-select.
- when multiple Companies exist and no valid session selection exists, Company selection is required before Company-scoped legacy workspace reads proceed.
- invalid/stale stored Company ids are rejected and cleared.
- only active Company id is stored as a Session/UI preference; financial data is not stored locally.

### AvanCloud singleton
`installAvanCloud()` now returns one page-level Cloud/Supabase client with:
- `cloud.companyContext`
- `ACTIVE_COMPANY_KEY` compatibility alias
- existing `ACTIVE_WORKSPACE_KEY` retained temporarily.

Parallel Supabase clients per UI module are no longer the intended architecture.

### Compatibility facade
Legacy Core still has some `workspaces[0]` / `ctx.workspace` semantics.
MT-A prevents those modules from independently choosing a tenant:
- complete CompanyContext determines the valid active Company.
- full legacy workspace queries are reordered to active Company.
- legacy `limit=1` workspace queries are explicitly scoped to active Company before DB limit is applied.
- if several Companies exist but none is selected, legacy Company-scoped workspace queries raise `COMPANY_SELECTION_REQUIRED` rather than silently choosing the first Company.

`ctx.workspace` is temporarily tolerated as an internal compatibility alias for Active Company; new code must not introduce new first-workspace tenant selection.

### Company Portfolio / Shell
- topbar retains `شرکت فعال` selector.
- new **`شرکت‌های من`** Portfolio.
- Portfolio shows authorized Companies, active state and User Role per Company.
- desktop overlay + mobile/iPhone bottom-sheet behavior.
- if Company selection is required, Portfolio is non-dismissible until selection.
- Portfolio does not aggregate Company Ledgers.

### Modules moved to Provider in MT-A
- User money/display preference resolver no longer selects first Workspace independently.
- Audit Log resolves Company via CompanyContext.
- Company selector and Portfolio use the same Provider.
- Company Profile and remaining legacy modules are protected through the central compatibility facade pending MT-C cleanup.

Gate file:
- `avan-staging/RC1_3_MT_A_GATE.md`

MT-A remains **awaiting explicit user Live PASS**.

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

Future architecture should increasingly separate `تنظیمات حساب من` from `تنظیمات شرکت فعال` rather than mixing their ownership semantics.

---

## 12) Mobile / iPhone
RC1.2-F and F.1 = Live PASS.

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

MT-A adds mobile-safe Company Portfolio / Company switching. This new MT-A mobile behavior still awaits Live Gate.

---

## 13) Smart Documents / OCR
Browser-local OCR is Frozen under ADR-0013.

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Do not restart browser-local OCR tuning without a new ADR/benchmark decision.

---

## 14) Immediate roadmap before Production
### Current: RC1.3-MT-A — awaiting Live Gate
Validate:
- Company Portfolio
- one active Company at a time
- synchronized Company switch across Journals/Invoices/Documents/Accounts/Parties/Reports/Profile/Audit/Preferences
- session access validation
- desktop + iPhone
- core regression

### After MT-A PASS: RC1.3-MT-B — Company Lifecycle / Onboarding
- explicit Create Company flow
- Company rename/display identity
- Owner assignment
- initial Company Profile setup
- initial fiscal/company setup
- remove bootstrap naming ambiguity from UX
- Company Portfolio becomes entry point for Create/Enter Company lifecycle

### RC1.3-MT-C — Module Boundary Cleanup
- progressively inject CompanyContext directly into remaining legacy modules
- remove first-workspace assumptions
- reduce/remove `ctx.workspace` compatibility alias
- move terminology in business/application code toward Company while retaining physical DB `workspace_id` until a justified migration exists

### Platform Control Plane
Separate phase under ADR-0014:
- Platform Admin data model separate from Company membership
- Tenant registry/status
- plans/subscription/system health
- no default tenant Ledger access
- audited support access design

### Operational/Security completion
- backup/restore strategy
- session controls
- leaked-password protection review
- remaining SECURITY DEFINER dependency-by-dependency hardening

### RC1.3-D — Full Regression
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
