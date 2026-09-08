# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-08 — AC-1 Engineering PASS / RC1.5-C Backend PASS + Frontend STAGING READY / Live Gate pending**.

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
- **RC1.4 Inventory / Sales-Purchase / Settlement = Production Released**.
- Production promotion commit: `81b5c54643267842a8f225ee09668ade2fc95052`.
- Production Pages run: `34141884953` = **success**.
- Production Service Worker cache: **`avan-prod-rc1-4-v1`**.
- Rollback branch: **`prod-backup-20260907-rc1-4-pre`**.
- Production config remains production-specific and was preserved during promotion.
- New feature development remains in Staging; Production is not the development workspace.
- **RC1.5-A — Versioned Tax Data Foundation = BACKEND PASS**.
- **RC1.5-B — VAT Calculation & Invoice Accounting Bridge = BACKEND PASS**.
- **AC-1 — Frontend Architecture Consolidation = ENGINEERING PASS**.
- **RC1.5-C — Tax UX & VAT Reports = BACKEND PASS / FRONTEND ENGINEERING READY / LIVE PENDING**.
- Tax remains disabled for all current Companies. No legacy invoice/item was silently reclassified.
- Next user gate: **RC1.5-C Staging Live Gate**.
- Next development gate after C Live PASS: **RC1.5-D — e-Invoice pre-validation / adapter contract**.
- Windows/Desktop/Offline work is explicitly **deferred until the Web/PWA release is final**.

Release record:
- `PRODUCTION_RELEASE_RC1_4.md`

Promotion readiness evidence:
- `avan-staging/RC1_4_PROMOTION_READINESS.md`

RC1.5 / architecture evidence:
- `avan-staging/RC1_5_A_GATE_EVIDENCE.md`
- `avan-staging/RC1_5_B_GATE_EVIDENCE.md`
- `avan-staging/RC1_5_C_GATE_EVIDENCE.md`
- `avan-staging/ARCHITECTURE_CONSOLIDATION_GATE_EVIDENCE.md`

---

## 2) Production deployment baseline — RC1.4
Production runtime commit:
- `81b5c54643267842a8f225ee09668ade2fc95052`

Accepted runtime facts:
- root includes approved RC1.4 inventory, invoice, settlement, localization and money-input runtime.
- Production `config.js` remains `environment: 'production'`.
- Production Auth redirect remains `https://afzalpour.github.io/`.
- Production Service Worker cache = **`avan-prod-rc1-4-v1`**.
- Production Pages run `34141884953` = **completed / success**.
- rollback branch `prod-backup-20260907-rc1-4-pre` exists.

RC1.4 Backend migrations were applied before frontend promotion to the shared Production Supabase project and passed staged regression/rehearsal gates.

RC1.5-A/B/C backend migrations and the targeted performance migration are backward-compatible. Tax remains disabled for all Companies until explicit activation, so the stable Production runtime continues to follow RC1.4 behavior.

---

## 3) Explicit Live PASS / acceptance history
Prior accepted gates remain valid, including:
- B-4 Live — PASS
- B-4.1 — PASS
- RC1 + two-user RLS — PASS
- RC1.1-A/B/C/D/F — PASS
- RC1.2-B/CF/D/E/F/F.1 — PASS
- RC1.3-B/C/MT/D — PASS
- RC1.3 Final Accounting Polish — PASS
- RC1.3 Production Smoke Gate — PASS

RC1.4 user-accepted behavior includes:
- four-level accounts `کل / معین / تفصیلی ۱ / تفصیلی ۲`.
- inventory receipt hang fixed and accepted.
- inventory document workspace/modal UX accepted.
- invoice workspace/modal UX accepted.
- invoice party selection fixed and accepted.
- three-level product grouping + operational SKU accepted.
- minimum-stock semantics accepted.
- Persian dates in inventory documents/item card accepted.
- purchase receipt line → purchase invoice matching fixed and accepted.
- sale inventory issue/reversal tested by user.
- Persian-only user-visible terminology/error policy accepted.
- mixed/installment settlement money inputs use three-digit grouping in v64.

RC1.5-A/B/C and AC-1 are **engineering/backend PASS states only** unless separately listed above; RC1.5-C is not recorded as user Live PASS yet.

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
- user-visible UI/errors must be fluent Persian; unavoidable standards such as PDF/CSV/SKU may remain Latin.
- Frontend migration follows Strangler Pattern; full rewrite is prohibited.
- new runtime extensions may not monkey-patch shared client methods; use the named Operation Pipeline.
- new business calculation logic must be separated from DOM where practical and unit-testable.

---

## 5) Current accounting / security integrity baseline
Read-only verification after RC1.5-C and performance hardening:
- Ledger debit = credit = **4,073,481,351 Toman**.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- postable accounts with active children = **0** at RC1.4 promotion baseline.
- `public SECURITY DEFINER` functions executable by `authenticated` = **0**.
- authenticated dangerous Tax table privileges (`TRUNCATE/REFERENCES/TRIGGER`) = **0**.
- `set_workspace_tax_settings` = SECURITY INVOKER, authenticated-only execute.
- `report_vat_transactions` = SECURITY INVOKER, authenticated-only execute.
- Companies with Tax enabled = **0**.
- settlement schedule total mismatches = **0** at RC1.4 promotion baseline.
- orphan settlement schedules = **0** at RC1.4 promotion baseline.
- orphan financial checks = **0** at RC1.4 promotion baseline.
- duplicate check identities under current identity rule = **0** at RC1.4 promotion baseline.
- RC1.5 authenticated tax rehearsal data left behind = **0** because the rehearsal was rolled back.

Inventory/financial reconciliation at RC1.4 promotion baseline:
- all **6 Companies** reconciled.
- active Company Movement Ledger value = **1,123,500,000**.
- active Company Inventory Ledger account balance = **1,123,500,000**.
- inventory difference = **0**.
- issue Movement COGS = **32,500,000**.
- COGS Ledger balance = **32,500,000**.
- COGS difference = **0**.

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
- active Company identity/logo drives sidebar branding; Avan logo is fallback.

---

## 7) Chart of accounts — current hierarchy
Account hierarchy is now:
- Level 1 = `کل`
- Level 2 = `معین`
- Level 3 = `تفصیلی ۱`
- Level 4 = `تفصیلی ۲`

Rules:
- only leaf accounts are postable.
- parent with active child is non-postable.
- browser cannot create root Level 1.
- account code is assigned authoritatively by DB trigger.
- Level2→Level3 uses short numeric suffix; Level3→Level4 uses exactly 3 digits.
- standard chart remains provisioned for every Company; existing/custom codes are preserved.

RC1.5-B added Company-scoped VAT account roles without changing existing Company account codes or historical Ledger postings:
- `vat_input_receivable` = اعتبار مالیاتی ارزش افزوده خرید.
- `vat_output_payable` = مالیات بر ارزش افزوده فروش پرداختنی.
- both roles exist for all 6 current Companies.

---

## 8) Journal / invoice integrity
Journal lifecycle:
- Draft → Posted → Reversed = PASS.
- original/reversal entries balanced.
- Posted immutability protections PASS.

Invoice lifecycle:
- Draft → Posted → Reversed = PASS.
- reversal journal link integrity enforced.
- sale item invoices atomically bridge to Inventory issue + COGS.
- purchase item invoices can bind to posted Inventory receipt lines and must not duplicate stock receipt.
- purchase receipt item/quantity mismatch is blocked by Backend.

RC1.5 tax bridge:
- invoice Draft stores deterministic tax snapshots when Company Tax is enabled.
- invoice header stores `subtotal_amount`, `tax_total`, and final `total_amount`.
- standard-rate rule version/effective-date is validated before snapshotting.
- exempt/zero-rate lines preserve profile snapshots with zero tax.
- Sale VAT posts as output VAT payable credit.
- Purchase VAT posts as input VAT receivable debit.
- reversal reverses the VAT Ledger effect with the original journal.
- Posted/Reversed immutability includes tax totals.
- RC1.5-C preserves tax treatment/code/Persian profile-name snapshots for historical reporting.

---

## 9) RC1.4 Inventory / Warehouse / Costing — Production
Architecture:
- inventory movement ledger is source of stock quantity/value.
- posted movement is immutable; correction uses reversal.
- quantity supports controlled decimal precision; core quantity column supports up to 6 decimals.
- moving weighted-average costing.
- deterministic integer-Toman Ledger boundary.
- composite Company-scoped FK/RLS boundaries.
- browser does not write stock movements directly.

Product model:
- `گروه اصلی → زیرگروه → مدل/خانواده → SKU واقعی`.
- grouping levels 1..3 are classification only.
- stock/purchase/sale is recorded on operational SKU only.
- existing legacy items remain compatible.

Operational flows:
- receipt / issue / transfer / adjustment / opening.
- Draft → Posted → Reversed.
- quantity/value reports, weighted average, item card, low-stock and reconciliation.
- inventory document and invoice forms use focused modal/workspace layout with internal scrolling.
- inventory dates displayed Jalali.

---

## 10) Sales / Purchase settlement — Production
Invoice settlement supports:
- اعتباری
- نقدی
- چکی
- اقساطی
- ترکیبی

Accounting model:
- invoice first recognizes receivable/payable.
- settlement separately clears receivable/payable.
- checks use dedicated `چک‌های دریافتنی` / `چک‌های پرداختنی` accounts.
- check lifecycle supports receipt/issue, clearance/pass, bounce and reversal of settlement.
- installment schedules have independent due date/status.
- settlement plan total must exactly equal invoice total.

Check identity rule:
- same Bank + same Check Number can coexist when Account Number differs.
- if Account Number is absent, same Company + direction + Bank + Check Number remains protected from duplicate registration.

RC1.5 tax amounts become part of final invoice `total_amount`; integrated Tax + Settlement regression is required before C Production promotion. The final legacy settlement RPC bridge remains quarantined until that migration is regression-tested against VAT-inclusive totals.

---

## 11) Persian UX / Money / Print contract
Frozen product rule:
- no raw English error code, Postgres/Supabase message or technical enum may be exposed directly to user.
- known errors map to specific fluent Persian messages.
- unknown technical errors show a safe general Persian message; detail is Console-only.
- exceptions only for unavoidable standard terms such as PDF/CSV/SKU.

Money UX:
- numeric money inputs use three-digit grouping where applicable, including mixed/installment settlement rows.
- reports/tables/prints include active money unit in monetary headings.
- Rial/Toman presentation follows workspace/user preference without rewriting canonical Toman history.

RC1.5-C extends the same rules to Tax/VAT settings, invoice tax fields, VAT reports, print-visible tax sections and validation messages.

---

## 12) Auth / Session
Accepted stable behavior:
- existing-user login.
- signup/recovery password guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- recovery flow reachable.
- session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.
- revoked-session auto-recovery experiment remains excluded from stable runtime.

---

## 13) SECURITY DEFINER / RLS hardening
Completed contract:
- `public.has_workspace_access` and `public.workspace_role` are SECURITY INVOKER.
- browser-facing privileged command RPCs use public SECURITY INVOKER wrappers.
- privileged implementation functions live in `private` where required.
- critical public tables use RLS.
- `public` SECURITY DEFINER functions executable by `authenticated` = **0** after RC1.5-C verification.
- Tax settings INSERT/UPDATE are owner/manager-only with UPDATE `USING` + `WITH CHECK`.
- C tax APIs are public-schema SECURITY INVOKER functions with explicit authenticated execute grants only.

Security Advisor after RC1.5-C:
- no RC1.5-C public authenticated SECURITY DEFINER regression.
- INFO no-policy notices remain on intentional deny-by-default/private boundaries.
- `public.workspace_invitations` remains deny-by-default/helper-mediated with no direct RLS policy.
- standing WARN remains `auth_leaked_password_protection`.

---

## 14) Leaked Password Protection — Free-tier limitation
Supabase built-in leaked-password screening remains disabled on current Free plan.

Policy:
- no paid upgrade is part of the project path.
- application password-strength/common-password controls remain compensation.
- this provider control is not falsely marked fixed.

---

## 15) Backup / Restore
Runbook:
- `avan-staging/BACKUP_RESTORE_RUNBOOK.md`

Free Transactional Recovery Rehearsal = PASS.

Full external disaster restore remains **OPEN / NOT FULL PASS** because no genuinely free isolated restore target is available in the connected environment.

Rules:
- never restore against `Avan-production` itself.
- never use a paid Supabase branch/project workaround under current policy.

This remains a final Web/PWA readiness item; it must be documented as a known zero-charge limitation if no free isolated target becomes available before release.

---

## 16) Platform Admin / Support
Accepted:
- Platform Admin separate from Company Ledger authority.
- Support access actor-bound, Company-bound, reason-required, time-limited and read-only.
- Support does not create Company membership.
- dedicated allowlisted Support viewer exposes read-only resources only.
- support reads/create/revoke audit logged.

---

## 17) Smart Documents
Browser-local OCR path remains frozen under ADR-0013.

Supported flow:
`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

Any new Smart Document work belongs to a future release cycle and must begin in Staging.

---

## 18) Current operating mode / Web-PWA-first decision
- Production remains stable release target, not development workspace.
- all RC1.5 frontend and architecture work remains in `avan-staging/` / release branch until Live PASS.
- Tax remains disabled for all Companies unless explicitly activated by an authorized Company owner/manager.
- relevant regression is required before future Production promotion.
- Blocker/Critical Production defects take immediate priority.
- zero-charge policy remains binding.
- Web + PWA must be completed and stabilized before Windows/Desktop work begins.
- Windows `.exe` and true offline mode remain a later platform phase; current architecture should remain portable but no desktop runtime work is started now.

Web/PWA path to final release:
1. AC-1 + RC1.5-C Staging Live Gate.
2. RC1.5-D e-Invoice pre-validation / adapter contract.
3. final Security + Backup/Restore disposition.
4. full accounting/inventory/invoice/tax/settlement/print/PWA regression.
5. performance, mobile and PWA polish.
6. final Release Candidate and Production Smoke Gate.
7. final Web/PWA Production release.

---

## 19) AC-1 — Frontend Architecture Consolidation — ENGINEERING PASS
Governing ADR:
- `docs/adr/0016-modular-runtime-no-monkey-patching.md` — Accepted.

Migration model:
- Strangler Pattern; no full rewrite.
- `app.js` remains Compatibility Shell while features are extracted and tested.
- Domain/Application/Infrastructure/UI dependency direction from `AVAN_MIGRATION_MAP_V1.md` remains governing.

Implemented:
- deterministic named Operation Pipeline for shared client operations.
- transitional shared UI lifecycle adapter.
- VAT calculation extracted into pure Domain logic.
- automated syntax checks + unit tests + architecture audit in GitHub Actions.
- Service Worker staging cache includes new architecture/tax modules.

Migrated away from direct shared-client overwrites:
- Company/workspace projection.
- User Preferences.
- invoice/inventory bridge.
- purchase/receipt bridge.
- RC1.5 tax bridge.

Latest CI evidence:
- GitHub Actions run `34184751258` = **success**.
- Operation Pipeline test = PASS.
- VAT calculator test = PASS.
- unauthorized direct client overwrites = **0**.
- one legacy Settlement overwrite remains explicitly quarantined with exact-count allowlist.
- new direct monkey patches are CI-blocked.
- MutationObserver debt is measurable and will be reduced feature-by-feature rather than via unsafe bulk rewrite.

Evidence:
- `avan-staging/ARCHITECTURE_CONSOLIDATION_GATE_EVIDENCE.md`

---

## 20) RC1.5 — Tax / VAT / e-invoicing cycle — IN PROGRESS
Governing ADR:
- `docs/adr/0007-versioned-tax-rules.md` — Accepted.

Verified regulatory direction at cycle start (2026-09-08):
- current general VAT rate for 1405 is 10%, but tax values must never be permanently hard-coded in scattered UI/business logic.
- Tax/VAT rules must be versioned by effective date.
- electronic-invoice / taxpayer-system integration must be adapter-based.
- item/service/party tax profiles and invoice tax snapshots are required for historical reproducibility.
- tax submission is sensitive and Human-controlled.
- official/current regulations and technical API specifications must be re-verified before enabling actual external submission.

### RC1.5-A — Versioned Tax Data Foundation — BACKEND PASS
Applied migrations:
- `rc1_5_a_versioned_tax_foundation`
- `rc1_5_a_tax_defaults_1405`

Current foundation:
- 1 active 1405 general VAT rule version (10%) with effective dates/source metadata.
- workspace tax settings for all 6 Companies.
- 3 default tax profiles per Company: standard / exempt / zero-rate.
- invoice-line snapshot fields are nullable for historical compatibility.
- no legacy invoice/item was silently reclassified.
- Tax default = disabled.

Evidence:
- `avan-staging/RC1_5_A_GATE_EVIDENCE.md`

### RC1.5-B — VAT Calculation & Invoice Accounting Bridge — BACKEND PASS
Applied migrations:
- `20260907211545 — rc1_5_b_vat_account_roles`
- `20260907212157 — rc1_5_b_vat_invoice_engine`

Verified behavior:
- deterministic integer-Toman VAT calculation.
- standard / exempt / zero-rate line handling.
- date-effective rule validation and line snapshots.
- VAT-inclusive invoice total with separate subtotal/tax total.
- sale VAT → output payable.
- purchase VAT → input receivable.
- sale and purchase reversal integrity.
- transactional authenticated-user rehearsal PASS and rolled back.
- global Ledger remains `4,073,481,351 = 4,073,481,351` Toman.
- orphan lines = 0; unbalanced journals = 0.

Evidence:
- `avan-staging/RC1_5_B_GATE_EVIDENCE.md`
- `avan-staging/APPLIED_RC1_5_B_VAT_ACCOUNT_ROLES.sql`
- `avan-staging/APPLIED_RC1_5_B_VAT_INVOICE_ENGINE.sql`

### RC1.5-C — Tax UX & VAT Reports — BACKEND PASS / FRONTEND STAGING READY
Applied migration:
- `20260907214750 — rc1_5_c_tax_ux_reporting_contract`

Backend verified:
- owner/manager-only Tax settings mutation.
- line snapshot stores treatment/profile code/Persian profile name.
- deterministic standard VAT rehearsal: base `10,005` → tax `1,001` Toman at 10%.
- exempt/zero rates = zero VAT.
- VAT report posts original event on original journal date and reversal as negative on reversal date.
- combined invoice/reversal net = zero in rehearsal.
- rehearsal fully rolled back.
- dangerous authenticated tax-table privileges = 0.
- public authenticated SECURITY DEFINER exposure = 0.

Frontend engineering ready:
- explicit Company tax activation/configuration UX.
- item tax profile.
- invoice tax profile/defaulting/validation.
- live subtotal/VAT/final totals.
- posted invoice tax detail.
- VAT sales/purchase/net report.
- Persian validation and print-visible tax sections.
- Tax remains disabled for all current Companies until explicit activation.

Evidence:
- `avan-staging/RC1_5_C_GATE_EVIDENCE.md`
- `avan-staging/APPLIED_RC1_5_C_TAX_UX_REPORTING_CONTRACT.sql`

### RC1.5 performance hardening
Applied migration:
- `rc1_5_performance_hot_path_indexes`

Implemented:
- targeted Company/transaction/document/account/reversal/tax hot-path indexes.
- duplicate permissive `account_roles_select` policy removed; existing `account_roles_access` retains identical SELECT authorization predicate through `FOR ALL`.
- post-migration Ledger integrity unchanged.
- Performance Advisor duplicate-policy warning cleared.
- remaining INFO FK advisories are not blindly indexed; index additions require real query/referential benefit.

Evidence:
- `avan-staging/APPLIED_RC1_5_PERFORMANCE_HOT_PATH_INDEXES.sql`

### Remaining RC1.5 gates
1. **RC1.5-C Staging Live Gate** — explicit user browser/PWA acceptance; not yet PASS.
2. **RC1.5-D — e-Invoice pre-validation / adapter contract** — no paid dependency; no automatic legal submission without explicit user action.
3. integrated Tax + Settlement regression and removal of the last quarantined Settlement monkey patch.
4. full regression + final Staging Live/Release Candidate gate before any Production promotion.

---

## 21) Product roadmap after final Web/PWA release
Desktop direction is intentionally deferred until the Web/PWA release is final.

Later platform phase:
- installable Windows `.exe`.
- true offline-capable mode requires local persistence (e.g. SQLite/local repository adapter) plus a conflict-aware sync engine; a web wrapper alone is not considered offline support.
- shared Domain/Application logic should remain platform-neutral so Windows does not duplicate accounting logic.

Candidate future product areas:
- Treasury / cheque / bank reconciliation expansion.
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
