# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-06 — Production RC1.3 PASS / first Production release complete**.

این فایل Source of Truth وضعیت جاری پروژه است. Gateهای Live فقط با تأیید صریح کاربر PASS می‌شوند.

---

## 1) Current release state
Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / release evidence / next-cycle workspace**.
- Supabase financial Source of Truth = project `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Project cost policy = **zero-charge paths only**.
- Production URL = `https://afzalpour.github.io/`.

### Current status
- **RC1.3-D Full Regression = PASS**.
- **Final Accounting Polish = PASS**.
- **RC1.3 Production promotion = PASS**.
- **Production Smoke Gate = PASS** (`Production پاس شد`, user-confirmed 2026-09-06).
- **First RC1.3 Production release = COMPLETE**.
- **RC1.3 release-specific Feature Freeze = ENDED** after Production Smoke PASS.
- Normal change discipline remains: new feature work starts in Staging/new release cycle; Production is not the development workspace.
- Blocker/Critical Production defects always take priority.

Release record:
- `PRODUCTION_RELEASE_RC1_3.md`

Closed promotion gate:
- `avan-staging/RC1_3_RC_PROMOTION_GATE.md`

Rollback branch:
- `prod-backup-20260906-rc1-3-pre`

---

## 2) Production deployment baseline
Production runtime commit:
- `4bcf0d00538486ba610c179d123c6a7b0ae6b0c2`

Accepted runtime:
- root `index.html` SHA = `b7264c3760c3a1dfe7dde53ce0a8bb07c0e28698`.
- root `src` tree SHA = `755a60cb7c6f7d20dc6810e62d2f49c974b07d76`.
- Production `config.js` remains `environment: 'production'`.
- Production Auth redirect = `https://afzalpour.github.io/`.
- Production Service Worker cache = **`avan-prod-rc1-3-v1`**.
- Production `sw.js` SHA = `82d081c9134605fcfb279feb1a1f1cdf18aa4d6b`.

GitHub Pages:
- runtime deploy run `34034831152` = **success**.
- release-record deploy run `34034994373` = **success**.

The Promotion contained no database DDL/data migration.

---

## 3) Explicit Live PASS history
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
- **RC1.3-D Full Regression — PASS** (`Gate RC1.3-D پاس شد`)
- **RC1.3 Final Accounting Polish — PASS**
- **Production Smoke Gate — PASS** (`Production پاس شد`)

Retained but not exact Gate phrase: RC1.2-D.1 and RC1.3-A1 recovery success.

---

## 4) Core architecture / invariants
- PostgreSQL/Supabase = financial Source of Truth.
- Browser never receives Service Role / secret key.
- Company/RLS boundary is mandatory; cross-company leakage = Blocker/Critical.
- Avan is Multi-tenant / Multi-company SaaS.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines immutable.
- Canonical Ledger storage = integer **Toman**; Rial/Toman is presentation only.
- Posted/Reversed journal debit and credit totals must remain equal.
- orphan journal lines must remain zero.
- same-Company authorized users share the Company ledger.
- Local/Session storage contains only auth/security/UI state; no financial source data.
- Standard chart headings are structural/raw/non-postable; balances are Ledger-derived.

---

## 5) Final Production database baseline — 2026-09-06
Read-only verification after publication:
- Workspaces = **6**.
- Accounts = **393**.
- Journal entries = **30**.
- Journal lines = **67**.
- Invoices = **11**.
- Ledger debit = credit = **201581351** canonical Toman.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- reversed invoices with missing/invalid reversal link = **0**.
- Companies with incorrect 52-heading standard chart = **0**.

No financial mutation was performed for deployment verification.

---

## 6) Multi-company / tenant lifecycle — LIVE PASS
Implemented and accepted:
- central `CompanyContext` + explicit active Company.
- Company Portfolio (`شرکت‌های من`).
- explicit Company selection; no hidden first-workspace tenant choice.
- `CompanyBoundary` over legacy Core reads.
- create Company RPC initializes tenant atomically; creator becomes Owner.
- suspend/reactivate/archive lifecycle enforced at DB access boundary.
- member limit enforced in DB.
- Platform Admin / Company Admin separation.
- controlled read-only Support sessions.

Company Portfolio polish accepted:
- active Company shows `شرکت انتخاب‌شده`.
- misplaced active-card return action removed.
- owner/admin Company cards have stable layout for `تغییر نام` + `ورود به شرکت`.

---

## 7) Standard chart of accounts
- exactly **52 system level-2 (`معین`) headings per Company**.
- all standard level-2 headings are non-postable/raw.
- Assets / Liabilities / Equity / Income / Expenses covered.
- contra-account normal-balance exceptions validated.
- existing/custom account codes preserved.
- `private.ensure_standard_account_chart(...)` used by Company onboarding.

---

## 8) Journal / invoice integrity
Journal lifecycle:
- Draft → Posted → Reversed = PASS.
- original/reversal entries balanced.
- Posted immutability protections PASS.

Invoice lifecycle:
- Draft → Posted → Reversed = PASS.
- RC1.3-D fixed reversal-link integrity.
- trigger authoritatively links reversed invoice to posted reversal journal.
- historical repair completed where deterministic.

Evidence:
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`
- fix commit `99c3ee7b7d21a8de003026081e350d41a852af89`.

---

## 9) Final Accounting / UX polish — LIVE PASS
Accepted:
- journal detail debit/credit `جمع کل`.
- explicit balanced/unbalanced state.
- print/PDF includes Company identity + money unit.
- `واحد مبالغ: تومان/ریال` formatting.
- journal/invoice list alignment polish.
- useless `اقدام` column removed from print.
- technical implementation subtitles removed from user/print output.
- list print/PDF works.
- single journal print/PDF works.
- single invoice print/PDF works.
- Toman/Rial output follows Company preference.
- iPhone/mobile gate accepted.

---

## 10) Auth / Session
Accepted stable behavior:
- existing-user login.
- signup/recovery password guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- recovery flow reachable.
- session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.

RC blocker history:
- an experimental revoked/missing `session_id` auto-recovery caused startup wait loop on desktop/iPhone.
- it was fully rolled back before final RC PASS.
- accepted Production does **not** include that experimental behavior.

Stable rollback commits:
- `38500077cc2fb9c3a055c4d53f4f69e0f20ac21e` — stable `supabase-auth.js`.
- `c8f1f13004d1e4a41bb4bf4c73b298f847026140` — stable `rc13-session-security.js`.

---

## 11) SECURITY DEFINER / RLS hardening
Completed:
- `public.has_workspace_access` and `public.workspace_role` are SECURITY INVOKER.
- browser-facing privileged command RPCs use public SECURITY INVOKER wrappers.
- privileged implementation functions live in `private` where required.
- direct unsafe broad browser execution revoked.
- critical public tables have RLS enabled.

Final RC/security contract:
- critical public tables without RLS = **0**.
- `public` SECURITY DEFINER functions executable by `authenticated` = **0**.

Security Advisor:
- no new public authenticated SECURITY DEFINER warning.
- INFO-only no-policy notices for deny-by-default/private control-plane boundaries remain intentional.
- only WARN remains `auth_leaked_password_protection`.

---

## 12) Leaked Password Protection — Free-tier limitation
Supabase built-in leaked-password screening remains disabled on current Free plan.

Policy:
- no paid upgrade is part of the project path.
- application password-strength/common-password controls remain compensation.
- this provider control is not falsely marked fixed.

---

## 13) Backup / Restore
Runbook:
- `avan-staging/BACKUP_RESTORE_RUNBOOK.md`

### Free Transactional Recovery Rehearsal — PASS
Reusable SQL:
- `avan-staging/FREE_TRANSACTIONAL_RECOVERY_REHEARSAL.sql`

Evidence:
- 26 public/private base tables copied to TEMP recovery set.
- 841 rows at rehearsal point.
- deterministic count/content-hash 26/26 PASS.
- recovered-copy accounting integrity PASS.
- RLS tenant isolation PASS.
- permanent Production data not modified.

### Full external disaster restore — OPEN / NOT FULL PASS
Not completed:
- materialized external logical DB dump + Storage bytes restored into a genuinely isolated target.

Reason:
- no genuinely free isolated target is currently available in connected environment.

Rules:
- never restore against `Avan-production` itself.
- never use a paid Supabase branch/project workaround under current policy.

---

## 14) Platform Admin / Support
Private Control Plane includes:
- `private.platform_admins`
- `private.platform_tenants`
- `private.platform_audit_logs`
- `private.platform_support_sessions`

Accepted:
- Platform Admin separate from Company Ledger authority.
- Support access actor-bound, Company-bound, reason-required, time-limited and read-only.
- Support does not create Company membership.
- dedicated allowlisted Support viewer exposes read-only resources only.
- support reads/create/revoke audit logged.

---

## 15) Smart Documents
Browser-local OCR path remains frozen under ADR-0013.

Supported flow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Any new Smart Document work belongs to a future release cycle and must begin in Staging.

---

## 16) Operating mode after first Production release
The RC1.3 release-specific Feature Freeze is closed.

Current operating rules:
- Production remains stable release target, not development branch/workspace.
- New features start in `avan-staging/` or a new release branch/cycle.
- Relevant regression is required before every future Production promotion.
- Production promotion always requires an explicit release decision.
- Blocker/Critical Production defects are handled immediately with focused regression.
- zero-charge policy remains binding unless the user explicitly changes it.

---

## 17) Product roadmap for next release cycles
Candidate areas:
- Inventory / warehouse / costing.
- expanded Sales & Purchase lifecycle.
- current-law Tax/VAT/e-invoicing when that release begins.
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
