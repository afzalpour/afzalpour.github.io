# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-MT-B Company Lifecycle / Onboarding**.

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
- RC1.3-MT-A Multi-tenant Application Architecture — PASS
- **RC1.3-MT-B Company Lifecycle / Onboarding — PASS**

Not explicitly marked with Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — recovery email and password reset succeeded on desktop and iPhone web; sender branding remains deferred.

Current phase:
- **RC1.3-MT-P1 — Platform Admin Control Plane Skeleton**

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
- RC1.3-MT-A Central CompanyContext + Company Portfolio: `b11f2aeb25d9315adc6969607e4b5535a598bf39` (PR #31)
- **RC1.3-MT-B Company Lifecycle / Onboarding: `d71cdd4f672e8283ec861b6ff230ce7b6d192e6f` (PR #32)**

PWA staging cache after MT-B: **v36**.

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
- Forgot-password request hardened with anti-enumeration response, email validation, cooldown, rate-limit handling and invalid/expired-link handling.
- Recovery email delivery and password reset Live-confirmed on desktop and iPhone web.

Still deferred before Production:
- Current sender appears as Supabase because default Supabase SMTP is used.
- Custom sender branding requires custom SMTP and verified sending identity/domain.
- Final custom-domain redirect configuration when a domain exists.
- Professional Auth templates finalized with custom SMTP/domain.

---

## 6) Multi-tenant Product Architecture — ADR-0014 + ADR-0015
آوان رسماً **Multi-tenant / Multi-company SaaS** است؛ نه نرم‌افزار تک‌شرکتی.

Three distinct authority planes:
1. **Platform Admin / System Admin** — مالک/اپراتور خود آوان؛ Control Plane کل SaaS.
2. **Company Owner / Manager** — مدیر یک Company مشخص.
3. **Accountant / Viewer** — نقش عملیاتی داخل یک Company مشخص.

این سه سطح نباید با یکدیگر ادغام شوند.

Platform Admin:
- عضو خودکار Companyها نیست.
- به‌طور پیش‌فرض Ledger/Invoices/Documents هیچ Company را نمی‌بیند.
- Company/Tenant lifecycle، پلن، وضعیت سرویس، محدودیت‌ها، سلامت سیستم و عملیات پشتیبانی را کنترل می‌کند.
- Support Access آینده فقط Explicit + Time-bounded + Reason-required + Audit-logged خواهد بود.
- Service Role/secret هرگز وارد Browser نمی‌شود.

Application hierarchy:
`Auth → Company Portfolio → Active Company → Accounting / Sales / Inventory / Tax / Treasury / Reports`

Platform Admin باید Shell/Route جداگانه Control Plane داشته باشد و از Company Portfolio کاربر عادی جدا بماند.

---

## 7) RC1.3-C1.2 — LIVE PASS
- Owned Company context دیگر به‌علت عضویت در Company دیگر مخفی نمی‌شود.
- `شرکت فعال` selector فعال است.
- Role کاربر در Company فعال نمایش داده می‌شود.
- Company Profile بر اساس Role قابل ویرایش/Read-only است.
- same-company shared Ledger رفتار صحیح است.
- cross-company isolation Live Gate پاس شد.

Company isolation DB hardening:
- خطای tautology در Draft RLS `journal_lines` اصلاح شد.
- Composite FKها journal line را به journal/account/party همان Company محدود می‌کنند.
- mismatchهای journal/account/party = 0.

---

## 8) RC1.3-MT-A — LIVE PASS
PR #31: `b11f2aeb25d31adc6969607e4b5535a598bf39`.

Central CompanyContext:
- یک Provider مرکزی برای Active Company.
- انتخاب Company ذخیره‌شده فقط Session/UI preference است.
- Company نامعتبر/قدیمی رد می‌شود.
- حساب چندشرکتی بدون انتخاب معتبر، Portfolio اجباری دارد.
- AvanCloud page-level singleton است.
- `شرکت‌های من` Portfolio روی desktop و iPhone کار می‌کند.
- Legacy `workspaces[0]` انتخاب Tenant مستقل انجام نمی‌دهد و از compatibility facade CompanyContext عبور می‌کند.

---

## 9) RC1.3-MT-B — LIVE PASS
User explicitly confirmed: `Gate RC1.3-MT-B پاس شد`.

PR #32 merge:
`d71cdd4f672e8283ec861b6ff230ce7b6d192e6f`

Supabase migration:
- `rc1_3_mt_b_company_lifecycle`

Implemented:
- `public.create_avan_company(...)` برای ایجاد صریح Tenant جدید.
- `public.rename_avan_company(wid,p_name)` برای rename کنترل‌شده.
- helper initialization در schema `private` و غیرقابل اجرا برای Client roles.
- هر Create Company یک Tenant تازه می‌سازد؛ legacy bootstrap idempotency برای Company دوم استفاده نمی‌شود.
- سازنده Company به‌صورت خودکار Owner می‌شود.
- ساخت Company اتمیک است: Workspace/Owner membership + money setting + fiscal year + standard chart of accounts + account roles + cash/bank financial accounts + Company Profile + audit event در یک transaction.
- Company Portfolio دکمه `ایجاد شرکت جدید` دارد.
- پس از creation، CompanyContext به Tenant تازه می‌رود.
- Owner/Manager rename را می‌بیند؛ Accountant-only آن را نمی‌بیند.
- Live Gate روی desktop/iPhone و cross-company isolation پاس شد.

Backend verification before merge:
- `PUBLIC EXECUTE=false`, `anon EXECUTE=false` برای public lifecycle RPCs.
- `authenticated EXECUTE=true` فقط برای public lifecycle RPCs.
- private initializer برای Client roles executable نیست.
- transactional test با Rollback: 1 Owner, 1 fiscal year, 19 standard accounts, 2 financial accounts, independent Company Profile.
- هیچ test tenant باقی نماند.

PWA cache: **v36**.

---

## 10) Company Print Identity / Operational Profile
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

## 11) Audit / Security
C1/C1.1 Live PASS:
- public SECURITY DEFINER functions have PUBLIC/anon execute revoked; authenticated retained where browser RPC requires it.
- Audit Log UX فعال است.
- `before_json/after_json` برای browser users قابل SELECT نیست.
- Owner/Manager admin/access events را می‌بینند.
- Accountant/Viewer admin/access events را نمی‌بینند.

Known security backlog:
- Security Advisor هنوز تعدادی `authenticated SECURITY DEFINER` browser RPC را هشدار می‌دهد؛ hardening باید dependency-by-dependency باشد، نه bulk revoke.
- Leaked Password Protection هنوز disabled است.

---

## 12) Settings UX target
1. **حساب کاربری** — global User identity/password/session
2. **مشخصات شرکت و چاپ** — active Company
3. **کاربران و دسترسی‌ها** — Company admins only
4. Company financial/display/operational settings
5. **گزارش فعالیت**
6. security/operational controls

---

## 13) Smart Documents / OCR
Browser-local OCR is Frozen under ADR-0013.

Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

---

## 14) Immediate roadmap before Production
### Current: RC1.3-MT-P1 — Platform Admin Control Plane Skeleton
Purpose: build the operator/admin experience for the owner of Avan SaaS, separate from Company accounting admins.

Targets:
- separate `platform_admin/system_admin` authorization model outside `workspace_members`.
- separate protected Platform Admin route/shell.
- Tenant/Company registry.
- Company lifecycle/status metadata: onboarding / active / suspended / archived as appropriate.
- identify Company owner and operational metadata without reading Company Ledger.
- high-level user/company counts and system health.
- platform-level audit events.
- no default tenant Ledger/Invoice/Document access.
- explicit authorization boundary between Control Plane and Tenant Plane.

### RC1.3-MT-P2 — SaaS Operations
- Plans/subscriptions/feature limits.
- tenant activation/suspension controls.
- onboarding/support status.
- quotas and operational limits where needed.
- controlled ownership/account recovery operations.
- system-wide metadata reporting without tenant Ledger content.

### RC1.3-MT-P3 — Controlled Support Access
If tenant-data support access is required:
- explicit support session.
- reason required.
- short time limit.
- least privilege/read-only by default.
- complete audit trail.
- visible/revocable semantics.
- never implicit because user is Platform Admin.

### RC1.3-MT-C — Module Boundary Cleanup
- directly inject CompanyContext into remaining legacy modules.
- remove first-workspace assumptions.
- progressively remove `ctx.workspace` compatibility alias.
- retain physical DB `workspace_id` until justified migration.

### Operational/Security completion
- backup/restore strategy.
- session controls.
- leaked-password protection review.
- remaining SECURITY DEFINER dependency-by-dependency hardening.

### RC1.3-D — Full Regression
- Platform Admin vs Company Role separation.
- multi-company/two-user RLS.
- CompanyContext/Portfolio/Company creation.
- Draft/Posted/Reversed immutability.
- invoices/reports/currency/fiscal periods.
- orphan lines zero.
- Smart Documents manual flow.
- print/export/company identity.
- mobile/iPhone/navigation.
- auth recovery.

### RC1.3-RC
- feature freeze.
- Blocker/Critical fixes only.

Then:
- approved Staging → Production/root promotion.
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