# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-MT-P2** و Merge شدن **RC1.3-MT-P3 Controlled Support Access** در انتظار Live Gate.

این فایل Source of Truth وضعیت جاری پروژه است. Gate فقط با تایید صریح کاربر PASS می‌شود.

## 1) Repository / Release
Repository: `afzalpour/afzalpour.github.io`
- Root = Production
- `avan-staging/` = Staging + Live Gate
- Workflow: Branch → PR → Diff review → Merge → User Live Gate
- Production promotion فقط پس از Full Regression و RC freeze.

## 2) Explicit Live PASS history
- B-4 Live — PASS
- B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A/B/C/D/F — PASS
- RC1.2-B/CF/D/E/F/F.1 — PASS
- RC1.3-B — PASS
- RC1.3-C1 — PASS
- RC1.3-C1.1 — PASS
- RC1.3-C1.2 — PASS
- RC1.3-MT-A — PASS
- RC1.3-MT-B — PASS
- RC1.3-MT-P1.1 — PASS
- **RC1.3-MT-P2 — PASS**

Retained but not exact Gate phrase: RC1.2-D.1 and RC1.3-A1 recovery success.

Current phase:
- **RC1.3-MT-P3 — MERGED / awaiting Live Gate**

## 3) Latest important merges
- PR #29 ADR-0014: `8a8723ba28f0bed82b39bbc1ade93e1361ef87b8`
- PR #30 C1.2: `952fa37ba874da5f06630a23d1f80a8b012f3186`
- PR #31 MT-A: `b11f2aeb25d9315adc6969607e4b5535a598bf39`
- PR #32 MT-B: `d71cdd4f672e8283ec861b6ff230ce7b6d192e6f`
- PR #33 MT-P1: `1b2106a28e8fa938c6d86fab8987f550943b72bc`
- PR #34 MT-P1.1: `958f66e73df19eff9b604f7fa8db24b1efbf794e`
- PR #35 MT-P2: `c5473896cc6e90d9891e0da9a87fee2e59b5b492`
- **PR #36 MT-P3: `626e3a62a8cbd3f06a728ad86baf08b92927fd95`**

PWA staging cache after MT-P3: **v40**.

## 4) Core invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Browser never receives Service Role.
- Company/RLS boundary mandatory; cross-company leakage = Blocker/Critical.
- Journal lifecycle: `Draft → Posted → Reversed`; Posted immutable.
- Canonical Ledger storage = integer Toman; Rial/Toman presentation only.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger.
- Local/Session storage contains only session/UI preferences, not financial data.

## 5) Multi-tenant authority model
آوان = Multi-tenant / Multi-company SaaS.

Distinct authority contexts:
1. **Platform Owner / Platform Admin** — مدیریت SaaS آوان.
2. **Company Owner / Manager** — مدیریت مالی/تنظیمات همان Company.
3. **Accountant / Viewer** — نقش عملیاتی همان Company.
4. **Temporary Support Session** — دسترسی پشتیبانی موقت و فقط‌خواندنی؛ Company membership نیست.

Platform Admin عضو خودکار Companyها نیست و Ledger شرکت‌ها را به‌طور پیش‌فرض نمی‌بیند.
Company Owner بودن هیچ Platform Admin permission ایجاد نمی‌کند.

## 6) MT-A — LIVE PASS
- Central CompanyContext.
- Company Portfolio / explicit active Company.
- no independent first-workspace selection.
- AvanCloud page-level singleton.
- desktop + iPhone Company switching accepted.

## 7) MT-B — LIVE PASS
Migration: `rc1_3_mt_b_company_lifecycle`
- explicit `create_avan_company`.
- creator becomes Owner.
- atomic tenant initialization: workspace/member/money/fiscal year/chart/account roles/cash-bank/profile/audit.
- Company Portfolio create/rename UX.

## 8) MT-P1/P1.1 — LIVE PASS
Private Control Plane:
- `private.platform_admins`
- `private.platform_tenants`
- `private.platform_audit_logs`

Separate Platform route/shell. Normal Company Owner direct Platform access rejected. P1.1 fixed authorization re-check after session/user switching.

## 9) MT-P2 — LIVE PASS
Migrations:
- `rc1_3_mt_p2_saas_operations`
- `rc1_3_mt_p2_member_limit_enforcement`

Implemented:
- Tenant status: onboarding/active/suspended/archived.
- Plan: trial/core/pro/enterprise/custom.
- member limit, onboarding state, support state, reason/audit.
- suspension/archival enforced at DB boundary: `has_workspace_access=false`, `workspace_role=NULL`.
- blocked Tenant remains visible in Portfolio but cannot be entered.
- DB-enforced member limit.
- Platform Admin and Company Admin remain independent.

User explicitly confirmed: `Gate RC1.3-MT-P2 پاس شد`.

## 10) MT-P3 — MERGED / AWAITING LIVE GATE
PR #36 merge: `626e3a62a8cbd3f06a728ad86baf08b92927fd95`
Migration: `rc1_3_mt_p3_controlled_support_access`

Security model:
- `private.platform_support_sessions` with RLS and no direct Browser grant/policy.
- actor-bound + tenant-bound + reason-required.
- duration 5–60 minutes.
- access mode fixed to `read_only`.
- archived Tenant cannot receive new Support session.
- Support Session does **not** add `workspace_members` membership and does not open ordinary Company RLS.
- dedicated allowlisted `platform_support_read` only.
- no Support create/update/delete/post/reverse/upload/private-file-download endpoint.
- reads are limited and column-reduced; no OCR raw text/file path in Support Viewer.
- every Support read is Platform Audit logged.
- create/revoke is also visible in Company Audit.
- Platform Admin and Company Owner/Manager can revoke immediately.

Public P3 wrappers are SECURITY INVOKER; anon EXECUTE=false.

Backend verification:
- Platform Admin with zero membership: ordinary accounts rows = 0.
- dedicated Support read: `read_only=true`, limited rows returned.
- Platform revoke → active=false.
- Company Owner saw active session and revoked → active=false.
- all verification tests rolled back; active test sessions = 0.
- public P3 SECURITY DEFINER wrappers = 0; anon executable = 0.

UI:
- Platform Admin creates/opens/revokes Support session from `مدیریت سامانه آوان`.
- dedicated `support-viewer.html`.
- Owner/Manager sees `دسترسی پشتیبانی آوان` in Company Settings and can revoke.
- Gate: `avan-staging/RC1_3_MT_P3_GATE.md`.
- PWA cache v40.

## 11) Auth / Security backlog before Production
Working:
- owner-managed eligible other-user password change via secure Edge Function.
- self password change + reauth.
- recovery email/reset Live-confirmed desktop+iPhone.

Remaining:
- Leaked Password Protection is still disabled.
- authenticated SECURITY DEFINER backlog must be hardened dependency-by-dependency, never bulk revoke.
- custom SMTP/sender branding and final custom-domain redirects when a domain exists.
- private Control Plane tables intentionally have RLS with no direct browser policies/grants.

## 12) Smart Documents
Browser-local OCR frozen under ADR-0013.
Supported flow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

## 13) Immediate roadmap before Production
### Current
**RC1.3-MT-P3 — Live Gate pending**

### After P3 PASS: RC1.3-MT-C — Module Boundary Cleanup
- inject CompanyContext into remaining legacy modules.
- remove first-workspace assumptions.
- progressively remove `ctx.workspace` compatibility alias.
- keep physical `workspace_id` until justified migration.

### Operational / Security completion
- backup/restore strategy and restore drill.
- session controls.
- leaked-password protection review.
- remaining SECURITY DEFINER dependency-by-dependency hardening.

### RC1.3-D — Full Regression
- Platform Admin / Company Admin / Support separation.
- multi-company/two-user RLS.
- Company Portfolio/create/suspend/reactivate.
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
- custom domain + production SMTP/sender branding when domain exists.

## 14) Product roadmap after first Production release
The complete Avan vision is multi-release, not one RC:
- Inventory Stock Ledger / multi-warehouse / costing.
- Sales & Purchase lifecycle.
- Versioned Tax/VAT + electronic invoicing based on current Iranian law at implementation time.
- Treasury / cheque / bank reconciliation.
- Bank AI / transaction matching.
- Payroll.
- Fixed Assets.
- Budgeting / rolling forecast / scenarios.
- Workflow & Approval.
- Consolidated multi-company reporting.
- External integrations/API/Excel/POS/banks.
- stronger server/provider Document AI.
- CFO Autopilot / Continuous Audit / Collections / Close Autopilot.
- Persian Voice AI with explicit consent and human-controlled financial actions.

Governing principle:
**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**
