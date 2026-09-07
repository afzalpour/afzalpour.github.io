# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-08 — RC1.5-B Backend PASS / RC1.5-C Tax UX & Reports next**.

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
- Tax remains disabled by default for all current Companies, so RC1.4 Production invoice behavior is unchanged until RC1.5-C provides explicit Company activation/configuration UX.
- Next gate: **RC1.5-C — Tax UX & reports**, governed by ADR-0007.

Release record:
- `PRODUCTION_RELEASE_RC1_4.md`

Promotion readiness evidence:
- `avan-staging/RC1_4_PROMOTION_READINESS.md`

RC1.5 backend evidence:
- `avan-staging/RC1_5_A_GATE_EVIDENCE.md`
- `avan-staging/RC1_5_B_GATE_EVIDENCE.md`

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

RC1.5-A/B backend migrations are additive/backward-compatible. Tax remains disabled for all Companies until explicit RC1.5-C activation, so the stable Production runtime continues to follow RC1.4 behavior.

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

RC1.5-A/B are **engineering/backend PASS only**; they are not recorded as user Live PASS gates.

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

---

## 5) Current accounting integrity baseline
Read-only verification after RC1.5-B transactional rehearsal:
- Ledger debit = credit = **4,073,481,351 Toman**.
- orphan journal lines = **0**.
- unbalanced Posted/Reversed journals = **0**.
- postable accounts with active children = **0** at RC1.4 promotion baseline.
- `public SECURITY DEFINER` functions executable by `authenticated` = **0**.
- settlement schedule total mismatches = **0** at RC1.4 promotion baseline.
- orphan settlement schedules = **0** at RC1.4 promotion baseline.
- orphan financial checks = **0** at RC1.4 promotion baseline.
- duplicate check identities under current identity rule = **0** at RC1.4 promotion baseline.
- Companies with Tax enabled = **0**.
- RC1.5-B rehearsal invoices left behind = **0**.

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

RC1.5-B tax bridge:
- invoice Draft stores deterministic tax snapshots when Company Tax is enabled.
- invoice header stores `subtotal_amount`, `tax_total`, and final `total_amount`.
- standard-rate rule version/effective-date is validated before snapshotting.
- exempt/zero-rate lines preserve profile snapshots with zero tax.
- Sale VAT posts as output VAT payable credit.
- Purchase VAT posts as input VAT receivable debit.
- reversal reverses the VAT Ledger effect with the original journal.
- Posted/Reversed immutability includes tax totals.

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

RC1.5 tax amounts become part of final invoice `total_amount`, therefore settlement-plan equality continues to be enforced against the VAT-inclusive invoice total.

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

RC1.5-C must extend these same rules to all Tax/VAT settings, invoice tax fields, reports, print views and validation messages.

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
- `public` SECURITY DEFINER functions executable by `authenticated` = **0** after RC1.5-B Gate.

Security Advisor after RC1.5-B:
- no RC1.5-B public authenticated SECURITY DEFINER regression.
- INFO no-policy notices remain on deny-by-default/private boundaries; `public.workspace_invitations` also remains deny-by-default with no direct RLS policy.
- only standing WARN remains `auth_leaked_password_protection`.

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

## 18) Current operating mode after RC1.4 Production
- Production remains stable release target, not development workspace.
- all RC1.5 frontend work remains in `avan-staging/` / release branch.
- RC1.5-A/B backend changes are backward-compatible and Tax is still disabled for all Companies.
- relevant regression required before future Production promotion.
- Blocker/Critical Production defects take immediate priority.
- zero-charge policy remains binding.

---

## 19) RC1.5 — Tax / VAT / e-invoicing cycle — IN PROGRESS
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
- global Ledger after rehearsal remains `4,073,481,351 = 4,073,481,351` Toman.
- orphan lines = 0; unbalanced journals = 0.
- Tax remains disabled for all Companies until RC1.5-C activation UX.

Evidence:
- `avan-staging/RC1_5_B_GATE_EVIDENCE.md`
- `avan-staging/APPLIED_RC1_5_B_VAT_ACCOUNT_ROLES.sql`
- `avan-staging/APPLIED_RC1_5_B_VAT_INVOICE_ENGINE.sql`

### Remaining RC1.5 gates
1. **RC1.5-C — Tax UX & reports**: tax settings, item/service tax profile, invoice tax profile/visible VAT totals, VAT sales/purchase reports, Persian validation.
2. **RC1.5-D — e-Invoice pre-validation / adapter contract**: no paid dependency; no automatic legal submission without explicit user action.
3. Full regression + Staging Live Gate before any future Production promotion.

---

## 20) Product roadmap after RC1.5
Candidate future areas:
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
