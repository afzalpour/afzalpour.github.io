# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: 2026-09-05، پس از **Live PASS شدن RC1.3-MT-C** و Merge شدن **RC1.3 Final Accounting Polish + Operational/Security Hardening** در انتظار Live Gate.

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
- RC1.3-MT-P2 — PASS
- RC1.3-MT-P3 — PASS
- **RC1.3-MT-C — PASS**

Retained but not exact Gate phrase: RC1.2-D.1 and RC1.3-A1 recovery success.

Current status:
- **RC1.3-FINAL-POLISH — MERGED / awaiting Live Gate**
- **Operational / Security Completion — partially completed; provider/restore blockers remain**

## 3) Latest important merges
- PR #29 ADR-0014: `8a8723ba28f0bed82b39bbc1ade93e1361ef87b8`
- PR #30 C1.2: `952fa37ba874da5f06630a23d1f80a8b012f3186`
- PR #31 MT-A: `b11f2aeb25d9315adc6969607e4b5535a598bf39`
- PR #32 MT-B: `d71cdd4f672e8283ec861b6ff230ce7b6d192e6f`
- PR #33 MT-P1: `1b2106a28e8fa938c6d86fab8987f550943b72bc`
- PR #34 MT-P1.1: `958f66e73df19eff9b604f7fa8db24b1efbf794e`
- PR #35 MT-P2: `c5473896cc6e90d9891e0da9a87fee2e59b5b492`
- PR #36 MT-P3: `626e3a62a8cbd3f06a728ad86baf08b92927fd95`
- PR #37 MT-C: `c6d3194d4bc309f3d7357afb02b8f59444748f57`
- **PR #38 Final Polish + Operational/Security Hardening: `3b4ff1be18bcfdcfe54e4c77f09ac79ac907181e`**

PWA staging cache after PR #38: **v42**.

## 4) Core invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Browser never receives Service Role.
- Company/RLS boundary mandatory; cross-company leakage = Blocker/Critical.
- Journal lifecycle: `Draft → Posted → Reversed`; Posted immutable.
- Canonical Ledger storage = integer Toman; Rial/Toman presentation only.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger.
- Local/Session storage contains only auth/security/UI preferences, not financial data.

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

## 10) MT-P3 — LIVE PASS
PR #36 merge: `626e3a62a8cbd3f06a728ad86baf08b92927fd95`
Migration: `rc1_3_mt_p3_controlled_support_access`

Security model:
- `private.platform_support_sessions` with RLS and no direct Browser grant/policy.
- actor-bound + tenant-bound + reason-required; duration 5–60 minutes; fixed `read_only`.
- Support Session does not add Company membership and does not open ordinary Company RLS.
- dedicated allowlisted Support read only; no write/post/reverse/upload/private-file-download endpoint.
- every Support read is Platform Audit logged; create/revoke also visible in Company Audit.
- Platform Admin and Company Owner/Manager can revoke immediately.

User explicitly confirmed: `Gate RC1.3-MT-P3 پاس شد`.

## 11) MT-C — LIVE PASS
PR #37 merge: `c6d3194d4bc309f3d7357afb02b8f59444748f57`
Gate: `avan-staging/RC1_3_MT_C_GATE.md`

Implemented boundary cleanup:
- Added explicit `CompanyBoundary` on top of central `CompanyContext`.
- Legacy `select('workspaces', ...)` is active-Company-only projection.
- Multi-company without valid selection returns `COMPANY_SELECTION_REQUIRED`.
- No Company returns `COMPANY_REQUIRED`; old Core cannot silently bootstrap Tenant.
- deprecated Workspace switcher removed/guarded; Product selector is `شرکت فعال / شرکت‌های من` only.
- Currency/Profile/Access/Core legacy reads use same Active Company boundary.
- physical `workspace_id` remains per ADR-0015.

User explicitly confirmed: `Gate RC1.3-MT-C پاس شد`.

## 12) Final Accounting Polish — MERGED / AWAITING LIVE GATE
PR #38 merge: `3b4ff1be18bcfdcfe54e4c77f09ac79ac907181e`
Gate: `avan-staging/RC1_3_FINAL_POLISH_OPS_GATE.md`
PWA cache: v42.

Implemented:
- Active Company card in `شرکت‌های من` no longer shows misplaced `بازگشت به شرکت`; it shows non-action `شرکت انتخاب‌شده`.
- Journal detail now gets debit/credit `جمع کل` and explicit balanced/unbalanced indicator.
- financial pages/details annotate output with current Toman/Rial unit; cloned print/PDF/CSV output carries unit text/headers.
- standard default account chart expanded through app level 2 (`معین`) across Assets/Liabilities/Equity/Income/Expenses.
- Standard headings are non-postable/raw and create no balances.
- Existing/custom account codes are not overwritten. Existing legacy collision at code 220 was preserved; standard supplemental liability heading uses a free code.
- same standard chart is automatically added to future `create_avan_company` tenants.

DB migration:
- `rc1_3_final_polish_standard_chart_security_hardening`
- `rc1_3_operational_close_legacy_company_bootstrap`

Verification at migration point:
- workspaces = 6.
- accounts changed from 117 to 279 only due new raw headings.
- journals = 29 unchanged.
- journal lines = 65 unchanged.
- account roles = 48 unchanged; broken account roles = 0.
- financial accounts = 12 unchanged.
- invoices = 11 unchanged.
- total debit = total credit = 201101351 canonical Toman unchanged.
- new standard level-2 headings referenced by journal lines = 0.
- transactional new Company test: 46 accounts / 33 system level-2 / 8 roles / 2 financial accounts; rollback confirmed temp Company persisted = 0.

Do not mark Final Polish PASS until user explicitly confirms the Live Gate.

## 13) Operational / Security Completion — PARTIAL, BLOCKERS RECORDED
### Completed / hardened
- `BACKUP_RESTORE_RUNBOOK.md` added with DB + Storage + configuration backup set and isolated restore validation checklist.
- current pre-drill baseline: DB 13 MB; Storage objects 23; orphan journal lines 0; unbalanced Posted/Reversed 0; Posted/Reversed invoices without journal 0.
- Free-plan application session guard: 60-minute inactivity logout and 12-hour maximum browser session; security timestamps only, no financial data locally.
- new Signup compensating password policy: minimum 10 chars including letter + digit; existing-user Login is not blocked by this UI rule.
- 7 internal SECURITY DEFINER trigger/helper functions are no longer executable by authenticated Browser users.
- 10 safe read-only report/integrity RPCs changed to SECURITY INVOKER; `v_posted_ledger` is `security_invoker=true`.
- direct browser EXECUTE revoked from legacy `bootstrap_avan_workspace` and `create_workspace`; lifecycle stays through `create_avan_company`.
- authenticated regression: authorized report returns rows; unrelated Company report returns 0.
- remaining authenticated public SECURITY DEFINER count = 26; inventory shows all have visible Auth/Company/Role guard signals and authenticated/public have no CREATE privilege on public/auth schemas. These are intentional command/RPC boundaries and must not be bulk-revoked.

### Provider / restore blockers
Current Supabase organization plan = **Free**.
- Built-in Supabase **Leaked Password Protection remains disabled**; current Security Advisor still reports the warning. This provider feature is not being falsely marked complete.
- Advanced hosted Auth session controls are not available on the current plan; Avan uses the application guard above as a compensating control.
- Supabase managed daily backup retention is not available on current Free plan; Free requires regular off-site logical `supabase db dump` plus separate Storage object backup.
- A **true isolated restore drill has NOT been executed** because the connected environment currently has neither a downloadable dump artifact nor a no-cost isolated restore target. A restore drill must never run against live Production.

Operational / Security Completion remains open until the provider/restore blockers are resolved and verified.

## 14) Auth / Security status before Production
Working:
- owner-managed eligible other-user password change via secure Edge Function.
- self password change + reauth.
- recovery email/reset Live-confirmed desktop+iPhone.
- application inactivity/max-session guard installed on staging.

Remaining before Production readiness:
- enable/verify provider leaked-password protection when supported production plan is available.
- execute actual off-site backup + isolated restore drill and record checksums/results.
- custom SMTP/sender branding and final custom-domain redirects when domain exists.
- keep remaining command SECURITY DEFINER RPCs under dependency-aware review; never bulk revoke.

## 15) Smart Documents
Browser-local OCR frozen under ADR-0013.
Supported flow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

## 16) Immediate roadmap before Production
### Current
1. User Live Gate: **RC1.3-FINAL-POLISH**.
2. Resolve Operational/Security provider/restore blockers:
   - provider leaked-password protection,
   - real off-site backup + isolated restore drill.

### Then RC1.3-D — Full Regression
- Platform Admin / Company Admin / Support separation.
- multi-company/two-user RLS.
- Company Portfolio/create/suspend/reactivate.
- Draft/Posted/Reversed immutability.
- invoices/reports/currency/fiscal periods.
- orphan lines zero.
- standard chart and Company lifecycle.
- Smart Documents manual flow.
- print/export/company identity/units.
- mobile/iPhone/navigation.
- auth recovery/session behavior.

### RC1.3-RC
- feature freeze.
- Blocker/Critical fixes only.

Then:
- approved Staging → Production/root promotion.
- custom domain + production SMTP/sender branding when domain exists.

## 17) Product roadmap after first Production release
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