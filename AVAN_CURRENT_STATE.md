# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-MT-P1.1** و Merge شدن **RC1.3-MT-P2 SaaS Operations** در انتظار Live Gate.

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
- RC1.3-MT-B Company Lifecycle / Onboarding — PASS
- **RC1.3-MT-P1.1 Platform Admin session revalidation — PASS**

Not explicitly marked with the exact Gate phrase:
- RC1.2-D.1 Persian print polish — merged and retained.
- RC1.3-A1 — recovery email and password reset succeeded on desktop and iPhone web; sender branding deferred.
- RC1.3-MT-P1 baseline — functionally accepted, followed by P1.1 regression fix; P1.1 is explicit PASS.

Current phase:
- **RC1.3-MT-P2 — SaaS Operations — MERGED, awaiting Live Gate**

---

## 3) Latest Important Merges
- RC1.3-B Company / Operational Settings: `96915960a12575364cde0ad081e1ede6059fe1e1` (PR #26)
- RC1.3-C1 Security Definer + Audit UX: `2245b0c59ff7ac80f1de4424f7d231d453610f24` (PR #27)
- RC1.3-C1.1 Audit Role Boundary: `d8b31318e3bcc7f53730403fbcca726704a52bfe` (PR #28)
- ADR-0014 Multi-tenant Company + Platform Admin: `8a8723ba28f0bed82b39bbc1ade93e1361ef87b8` (PR #29)
- RC1.3-C1.2 Company Context & Isolation: `952fa37ba874da5f06630a23d1f80a8b012f3186` (PR #30)
- RC1.3-MT-A Central CompanyContext + Company Portfolio: `b11f2aeb25d9315adc6969607e4b5535a598bf39` (PR #31)
- RC1.3-MT-B Company Lifecycle / Onboarding: `d71cdd4f672e8283ec861b6ff230ce7b6d192e6f` (PR #32)
- RC1.3-MT-P1 Platform Admin Control Plane: `1b2106a28e8fa938c6d86fab8987f550943b72bc` (PR #33)
- RC1.3-MT-P1.1 Session Revalidation: `958f66e73df19eff9b604f7fa8db24b1efbf794e` (PR #34)
- **RC1.3-MT-P2 SaaS Operations: `c5473896cc6e90d9891e0da9a87fee2e59b5b492` (PR #35)**

PWA staging cache after MT-P2: **v39**.

---

## 4) Core Financial Invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Financial data is not stored in LocalStorage/SessionStorage.
- Auth + Company-based RLS active.
- Journal lifecycle: `Draft → Posted → Reversed`.
- Posted journal and lines are immutable; corrections use reversal/controlled workflow.
- Canonical Ledger currency storage = integer Toman; Rial/Toman is presentation/input only.
- Browser never receives Service Role.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger; documents are not private to creator.
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

## 5) Multi-tenant Authority Model
آوان رسماً **Multi-tenant / Multi-company SaaS** است.

Three distinct authority planes:
1. **Platform Owner / Platform Admin** — مالک/اپراتور خود آوان؛ Control Plane کل SaaS.
2. **Company Owner / Manager** — مدیر مالی/تنظیمات یک Company مشخص.
3. **Accountant / Viewer** — نقش عملیاتی داخل یک Company مشخص.

Rules:
- Platform Admin membership در Companyها خودکار نیست.
- Platform Admin به‌طور پیش‌فرض Ledger/Invoices/Documents/Accounts/Parties هیچ Company را نمی‌بیند.
- Company Owner/Manager فقط Company خودش را مدیریت می‌کند و از Platform Admin permission برخوردار نمی‌شود.
- حتی اگر یک شخص هر دو نقش را داشته باشد، permission plane و UI آن‌ها مستقل است.
- Support Access آینده فقط Explicit + Time-bounded + Reason-required + Audit-logged است.
- Service Role/secret هرگز وارد Browser نمی‌شود.

Application hierarchy:
`Auth → Company Portfolio → Active Company → Accounting / Sales / Inventory / Tax / Treasury / Reports`

Platform hierarchy:
`Auth → Platform Admin authorization → SaaS Control Plane → Tenant metadata/operations`

---

## 6) RC1.3-MT-A — LIVE PASS
Central CompanyContext:
- یک Provider مرکزی برای Active Company.
- Company نامعتبر/قدیمی رد می‌شود.
- حساب چندشرکتی بدون selection معتبر، Portfolio اجباری دارد.
- AvanCloud page-level singleton است.
- `شرکت‌های من` Portfolio روی desktop و iPhone کار می‌کند.
- Legacy `workspaces[0]` از compatibility facade عبور می‌کند و دیگر Tenant selector مستقل نیست.

---

## 7) RC1.3-MT-B — LIVE PASS
Migration: `rc1_3_mt_b_company_lifecycle`

Implemented:
- `public.create_avan_company(...)` برای Tenant جدید.
- `public.rename_avan_company(wid,p_name)` برای rename کنترل‌شده.
- هر Create Company یک Tenant مستقل می‌سازد و سازنده Owner می‌شود.
- ساخت اتمیک: Workspace/Owner membership + money setting + fiscal year + standard chart + roles + cash/bank + Company Profile + audit.
- Company Portfolio دکمه `ایجاد شرکت جدید` دارد.
- Owner/Manager rename را می‌بیند؛ Accountant-only نمی‌بیند.

Backend verification before merge:
- PUBLIC/anon execute=false برای lifecycle RPCs.
- private initializer برای Client roles executable نیست.
- transactional test: 1 Owner, 1 fiscal year, 19 standard accounts, 2 financial accounts, independent profile; rollback.

---

## 8) RC1.3-MT-P1 / P1.1 — Control Plane
P1 merge: `1b2106a28e8fa938c6d86fab8987f550943b72bc`.
P1.1 merge: `958f66e73df19eff9b604f7fa8db24b1efbf794e`.
P1.1 explicit Live PASS.

Private Control Plane model:
- `private.platform_admins`
- `private.platform_tenants`
- `private.platform_audit_logs`

Public browser wrappers are SECURITY INVOKER; privileged helpers remain private.
Normal Company Owner is rejected with `PLATFORM_ADMIN_REQUIRED`.
Control Plane contains no default tenant financial-data query.

P1.1 fixed session switching so `مدیریت سامانه آوان` is removed/re-added when the authenticated user changes in the same tab.

---

## 9) RC1.3-MT-P2 — MERGED / AWAITING LIVE GATE
PR #35 merge:
`c5473896cc6e90d9891e0da9a87fee2e59b5b492`

Migrations:
- `rc1_3_mt_p2_saas_operations`
- `rc1_3_mt_p2_member_limit_enforcement`

### Platform Admin operations
Each Tenant has:
- service status: `onboarding | active | suspended | archived`
- plan: `trial | core | pro | enterprise | custom`
- `member_limit`
- onboarding state
- support state
- last reason / changed by / changed at

`platform_admin_update_tenant(...)`:
- Platform Admin-only.
- reason is mandatory.
- archive requires `platform_owner`.
- writes platform-level before/after audit metadata.
- public wrapper is SECURITY INVOKER; anon EXECUTE=false.

### Tenant access enforcement
- `has_workspace_access(wid)` is now Tenant-status-aware.
- `workspace_role(wid)` returns NULL for suspended/archived Tenant.
- suspended/archived membership remains intact but operational Company access is blocked.
- `my_company_portfolio()` preserves metadata visibility so blocked Tenant remains visible to its member as suspended/archived.
- CompanyContext refuses selection of blocked Tenant.
- financial RLS paths using `has_workspace_access` return no Tenant financial rows while blocked.
- reactivation restores access to the same unchanged data.

### Member limit enforcement
DB trigger `private.enforce_tenant_member_limit()` blocks active member insertion/reactivation beyond Tenant limit and blocks member activation on suspended/archived Tenant.

### Verification before merge
Transactional suspension test:
- `has_workspace_access=false`
- `workspace_role=NULL`
- visible accounts=0
- visible journals=0
- blocked Company Portfolio row=1
- rollback performed.

Other tests:
- normal Company Owner platform mutation rejected with `PLATFORM_ADMIN_REQUIRED`.
- member-limit overrun rejected with `TENANT_MEMBER_LIMIT_REACHED`.
- all 5 real Tenant registry rows remained `active/core/member_limit=10/onboarding=completed/support=none` after tests.
- Platform Admin function references to Ledger/Invoice/Document/Account/Party/financial transactions = 0.
- `platform_admin_update_tenant` and `my_company_portfolio`: SECURITY DEFINER=false, anon EXECUTE=false, authenticated EXECUTE=true.

UI:
- Platform page named **مدیریت سامانه آوان**.
- Operations table allows status/plan/member limit/onboarding/support changes with mandatory reason.
- Company Portfolio shows suspended/archived Tenant but disables entry.
- PWA cache = v39.

Live Gate file:
- `avan-staging/RC1_3_MT_P2_GATE.md`

---

## 10) Authentication / Security Status
Working:
- Owner can change eligible other-user password via secure Edge Function.
- User can change own password after re-authentication.
- Forgot-password anti-enumeration/cooldown/invalid callback handling.
- Recovery email delivery and reset Live-confirmed desktop+iPhone.

Deferred before Production:
- Custom SMTP/sender branding and custom-domain redirect when domain exists.
- Leaked Password Protection remains disabled.
- Security Advisor still flags existing authenticated SECURITY DEFINER browser RPCs; hardening remains dependency-by-dependency, never bulk revoke.
- private Control Plane tables intentionally have RLS with no direct Browser policies/grants; access is through controlled helpers.

---

## 11) Company / Settings / Audit
Company Print Profile source:
- `public.workspace_print_profiles`
- `get_workspace_print_profile(wid)`
- `set_workspace_print_profile(wid,p_profile)`
- private bucket `avan-branding`

Settings UX target:
1. حساب کاربری — global User identity/password/session
2. مشخصات شرکت و چاپ — active Company
3. کاربران و دسترسی‌ها — Company admins only
4. Company financial/display/operational settings
5. گزارش فعالیت
6. security/operational controls

Audit boundary:
- Owner/Manager see admin/access company audit events.
- Accountant/Viewer do not.
- Platform Audit is independent of Company Audit.

---

## 12) Smart Documents / OCR
Browser-local OCR is Frozen under ADR-0013.
Supported workflow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

---

## 13) Immediate roadmap before Production
### Current
**RC1.3-MT-P2 — Live Gate pending**

### After P2 PASS: RC1.3-MT-P3 — Controlled Support Access
If tenant-data support access is required:
- explicit support session
- reason required
- short time limit
- least privilege/read-only by default
- complete audit trail
- visible/revocable semantics
- never implicit because user is Platform Admin

### RC1.3-MT-C — Module Boundary Cleanup
- directly inject CompanyContext into remaining legacy modules
- remove first-workspace assumptions
- progressively remove `ctx.workspace` compatibility alias
- retain physical DB `workspace_id` until justified migration

### Operational/Security completion
- backup/restore strategy
- session controls
- leaked-password protection review
- remaining SECURITY DEFINER dependency-by-dependency hardening

### RC1.3-D — Full Regression
- Platform Admin vs Company Role separation
- multi-company/two-user RLS
- CompanyContext/Portfolio/Company creation/Suspend-Reactivate
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
- custom domain + production SMTP/sender branding when domain exists.

---

## 14) Official Product Direction
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
