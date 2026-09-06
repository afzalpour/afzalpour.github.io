# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-06 — پس از PASS صریح RC1.3-D و ورود به RC1.3-RC / Feature Freeze**.

این فایل Source of Truth وضعیت جاری پروژه است. Gateهای Live فقط با تأیید صریح کاربر PASS می‌شوند.

---

## 1) Repository / Release model
Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / accepted RC candidate**.
- Supabase financial Source of Truth = project `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Production promotion فقط با تصمیم صریح جداگانه انجام می‌شود؛ PASS شدن RC1.3-D به‌تنهایی مجوز تغییر root نیست.
- Project cost policy: **zero-charge paths only**.
  - هیچ Paid Supabase branch/project/feature نباید بدون تغییر صریح این سیاست وارد مسیر پروژه شود.
  - Built-in Leaked Password Protection و true isolated hosted restore در وضعیت فعلی به‌عنوان محدودیت provider/free-tier مستند می‌شوند، نه اینکه به‌زور PASS اعلام شوند.

Current PWA baselines:
- accepted Staging cache: **`avan-staging-rc1-v49`**.
- current Production root cache before RC promotion: **`avan-prod-core-1-0-v11`**.

---

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
- RC1.3-MT-C — PASS
- **RC1.3-D Full Regression — PASS** (`Gate RC1.3-D پاس شد`, user-confirmed 2026-09-06)
- **RC1.3 Final Accounting Polish visual gate — PASS**, closed by the same completed RC1.3-D Live checks.

Retained but not exact Gate phrase: RC1.2-D.1 and RC1.3-A1 recovery success.

### Current status
- **RC1.3-D = PASS**.
- **Final Accounting Polish = PASS**.
- **Operational / Security free-scope hardening = COMPLETE**.
- **Free Transactional Recovery Rehearsal = PASS**.
- **Full external logical dump + Storage isolated restore = OPEN / NOT FULL PASS**.
- **Current phase = RC1.3-RC / FEATURE FREEZE**.
- Freeze rule: **no new features; Blocker/Critical fixes only** until first Production release smoke is accepted.

Promotion gate:
- `avan-staging/RC1_3_RC_PROMOTION_GATE.md`

---

## 3) Core architecture / invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Browser never receives Service Role / secret key.
- Company/RLS boundary mandatory; cross-company leakage = Blocker/Critical.
- Avan is Multi-tenant / Multi-company SaaS.
- Journal lifecycle: `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical Ledger storage = integer **Toman**; Rial/Toman is presentation only.
- Journal debit and credit totals must remain equal for Posted/Reversed.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger.
- Local/Session storage contains only auth/security/UI state; no financial source data.
- Standard chart headings are structural/raw/non-postable; balances are Ledger-derived, not stored on headings.

---

## 4) Authority model
Distinct authority contexts:
1. **Platform Owner / Platform Admin** — SaaS control plane.
2. **Company Owner / Manager / Financial Manager** — Company-local management.
3. **Accountant / Viewer** — Company-local operating roles.
4. **Temporary Support Session** — time-limited read-only support boundary; not Company membership.

Rules:
- Platform Admin is not automatically a Company member and does not receive ordinary Ledger access.
- Company Owner does not receive Platform Admin permissions.
- Support Session does not open ordinary Company RLS and cannot post/edit/delete financial data.

---

## 5) Multi-company / tenant lifecycle — LIVE PASS
Implemented and accepted:
- central `CompanyContext` + explicit active Company.
- Company Portfolio (`شرکت‌های من`).
- explicit Company selection; no hidden first-workspace tenant choice.
- `CompanyBoundary` over legacy Core reads.
- legacy `select('workspaces',...)` is active-Company-only projection.
- create Company RPC initializes tenant atomically.
- creator becomes Owner.
- suspend/reactivate/archive lifecycle enforced at DB access boundary.
- member limit enforced in DB.
- Platform Admin / Company Admin separation.
- controlled read-only Support sessions.

Company Portfolio polish accepted in final RC:
- active Company shows `شرکت انتخاب‌شده`.
- old misplaced active-card return action removed.
- owner/admin Company cards have stable action layout for `تغییر نام` + `ورود به شرکت`.

---

## 6) Standard chart of accounts
Current standard chart:
- exactly **52 system level-2 (`معین`) headings per Company**.
- all standard level-2 headings non-postable/raw.
- categories cover Assets / Liabilities / Equity / Income / Expenses.
- contra-account normal-balance exceptions validated.
- existing/custom account codes are preserved.
- `private.ensure_standard_account_chart(...)` is used by Company onboarding.

Latest verification:
- Workspaces = 6.
- Accounts = 393.
- Companies with incorrect 52-heading standard chart = 0.

---

## 7) Journal / invoice integrity
Journal lifecycle regression:
- Draft → Posted → Reversed: PASS.
- original/reversal entries balanced.
- Posted immutability protections PASS.

Invoice lifecycle regression:
- Draft → Posted → Reversed: PASS.
- RC1.3-D fixed invoice reversal-link integrity.
- trigger now authoritatively links reversed invoice to its posted reversal journal.
- historical reversed invoices were backfilled safely where deterministic.

Final baseline 2026-09-06:
- Journal entries = **30**.
- Journal lines = **67**.
- Invoices = **11**.
- Ledger debit = credit = **201581351** canonical Toman.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- reversed invoices with missing/invalid reversal link = **0**.

Important migration evidence:
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`
- fix commit: `99c3ee7b7d21a8de003026081e350d41a852af89`

---

## 8) Final Accounting / UX polish — LIVE PASS
Accepted behavior:
- journal detail shows debit/credit `جمع کل`.
- balanced document shows explicit balanced state.
- print/PDF output carries Company identity and money unit.
- money unit text normalized to `واحد مبالغ: تومان/ریال`.
- journal/invoice list alignment polished.
- printed list removes useless `اقدام` column.
- journal/invoice technical implementation subtitles removed from user/print output.
- list print/PDF works.
- single journal print/PDF works.
- single invoice print/PDF works.
- Toman/Rial display/print unit follows active Company preference.
- iPhone/mobile gate accepted within final RC1.3-D PASS.

Desktop detail-print recovery is deterministic and still uses the shared RC1.2 print engine as the single print implementation.

---

## 9) Auth / Session status in accepted RC
Working/accepted:
- existing-user login.
- signup / password recovery strength guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- recovery flow.
- application session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.

### RC blocker history
A later attempt to automatically recover from a missing/revoked Supabase `session_id` caused the app to remain in a startup wait state on desktop and iPhone.

This was treated as an **RC Blocker** and fully rolled back before final PASS.

Stable rollback commits:
- `38500077cc2fb9c3a055c4d53f4f69e0f20ac21e` — restored stable `supabase-auth.js`.
- `c8f1f13004d1e4a41bb4bf4c73b298f847026140` — restored stable `rc13-session-security.js`.

Accepted RC therefore does **not** include the experimental revoked-session auto-recovery behavior.

---

## 10) SECURITY DEFINER / RLS hardening
Completed:
- `public.has_workspace_access` and `public.workspace_role` are SECURITY INVOKER.
- browser-facing privileged command RPCs retain public signatures as SECURITY INVOKER wrappers.
- privileged implementation functions live in `private` where required for atomic accounting/tenant operations.
- direct unsafe broad browser execution remains revoked.
- critical public tables have RLS enabled.

Final RC verification:
- critical public tables without RLS = **0**.
- `public` SECURITY DEFINER functions executable by `authenticated` = **0**.

Security Advisor:
- no new public authenticated SECURITY DEFINER warning.
- INFO-only `RLS enabled/no policy` notices remain for private control-plane tables and `public.workspace_invitations`; these are intentional deny-by-default / controlled-RPC boundaries.
- only WARN remains `auth_leaked_password_protection`.

---

## 11) Leaked Password Protection — documented Free-tier limitation
Supabase built-in leaked-password screening remains disabled on the current plan.

Project policy:
- no paid upgrade is part of the current release path.
- application-level password-strength/common-password controls remain compensation.
- this control is not falsely marked fixed.
- provider controls may only be reassessed if the user explicitly changes the zero-charge policy in the future.

---

## 12) Backup / Restore
Runbook:
- `avan-staging/BACKUP_RESTORE_RUNBOOK.md`

### Free Transactional Recovery Rehearsal — PASS
Reusable SQL:
- `avan-staging/FREE_TRANSACTIONAL_RECOVERY_REHEARSAL.sql`

Evidence from rehearsal:
- public/private base tables copied to TEMP recovery set: 26.
- rows copied at rehearsal point: 841.
- deterministic count/content-hash validation: 26/26 PASS.
- recovered-copy accounting integrity: PASS.
- RLS tenant isolation: PASS.
- permanent Production data was not modified.

### Full external disaster restore — OPEN
Not completed:
- materialized external logical DB dump + Storage bytes restored into a genuinely isolated target.

Reason:
- no genuinely free isolated target is currently available in the connected environment.

Rules:
- never run a restore drill against `Avan-production` itself.
- never use a paid Supabase branch/project workaround under current policy.
- do not label this full disaster-recovery gate PASS until it is actually executed.

---

## 13) Platform Admin / Support
Private Control Plane includes:
- `private.platform_admins`
- `private.platform_tenants`
- `private.platform_audit_logs`
- `private.platform_support_sessions`

Accepted behavior:
- Platform Admin management is separate from normal Company Ledger authority.
- Support access is actor-bound, Company-bound, reason-required, time-limited and read-only.
- Support does not create Company membership.
- dedicated allowlisted Support viewer only exposes read-only resources.
- support reads/create/revoke are audit logged.

---

## 14) Smart Documents
Browser-local OCR path is frozen under ADR-0013.

Supported flow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

No new Smart Document feature work is permitted during RC1.3-RC.

---

## 15) RC1.3-RC — CURRENT
Feature Freeze is active.

Rules:
- no feature additions.
- Blocker/Critical fixes only.
- any RC fix must trigger focused re-regression in the impacted boundary.

Promotion gate:
- `avan-staging/RC1_3_RC_PROMOTION_GATE.md`

Current Production root is materially older than accepted Staging:
- root `index.html` still loads old Core runtime only.
- root Service Worker = `avan-prod-core-1-0-v11`.
- accepted Staging = `avan-staging-rc1-v49` and includes multi-company/security/print/mobile/platform/support runtime.

Promotion must therefore be controlled runtime sync, with these transformations:
- root `config.js` stays `environment: 'production'`.
- root `authRedirectUrl` stays `https://afzalpour.github.io/`.
- root Service Worker receives a new **Production** cache namespace/version, not the staging cache name.
- no DB migration/data mutation is part of frontend promotion.

### Required explicit authorization before root modification
Production/root must not be changed until the user gives a separate instruction equivalent to:

`Production را منتشر کن`

---

## 16) Production smoke after promotion
Minimum user smoke:
1. Login desktop + iPhone.
2. Active Company / Company switch.
3. Dashboard loads.
4. Open one journal + one invoice detail.
5. Print one detail; Company identity + unit correct.
6. Reports + settings open.
7. iPhone `بیشتر`, modal and bottom navigation usable.

Server post-promotion checks:
- ledger balanced.
- orphan lines = 0.
- unbalanced Posted/Reversed = 0.
- invoice reversal links valid.
- public authenticated SECURITY DEFINER = 0.

Rollback immediately to pre-promotion root commit for login/startup block, Company-boundary anomaly, accounting unusability, PWA reload/wait loop, critical mobile failure or Production config/redirect defect.

---

## 17) Product roadmap after first Production release
Post-release roadmap remains multi-release and is outside the current freeze:
- Inventory / warehouse / costing.
- expanded Sales & Purchase lifecycle.
- current-law Tax/VAT/e-invoicing implementation when that release is started.
- Treasury / cheque / bank reconciliation.
- Bank transaction matching.
- Payroll.
- Fixed Assets.
- Budgeting / forecast / scenarios.
- Workflow & Approval.
- Consolidated multi-company reporting.
- external integrations/API/Excel/POS/banks.
- stronger document intelligence using free/local paths where feasible.
- CFO Autopilot / Continuous Audit / Collections / Close automation.
- Persian Voice AI with explicit consent and human-controlled financial actions.

Governing principle:
**اعتماد مالی + UX حرفه‌ای + اتوماسیون + هوش توضیح‌پذیر + تصمیم‌سازی مدیریتی.**