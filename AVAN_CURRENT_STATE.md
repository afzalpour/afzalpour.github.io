# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-09 — RC1.5-D + Integrated Tax/Settlement ENGINEERING PASS (PR #82 / #83; Actions #95 / #99 / #100) — browser Live acceptance still pending**.

این فایل Source of Truth وضعیت جاری پروژه است. Gateهای Live فقط با تأیید صریح کاربر PASS می‌شوند؛ Engineering/Backend PASS جایگزین Live PASS نیست.

---

## 1) Current release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / release evidence / next-cycle workspace**.
- Supabase financial Source of Truth = project `Avan-production` (`dkyqsxnllvxypigxpygo`).
- Project cost policy = **zero-charge paths only**.
- Production URL = `https://afzalpour.github.io/`.
- Web/PWA remains the active release target; Windows/Desktop/true offline is deferred until Web/PWA final release.

### Current status

- **RC1.4 Inventory / Sales-Purchase / Settlement = Production Released**.
- Production promotion commit: `81b5c54643267842a8f225ee09668ade2fc95052`.
- Production Pages run: `34141884953` = **success**.
- Production Service Worker cache: `avan-prod-rc1-4-v1`.
- rollback branch: `prod-backup-20260907-rc1-4-pre`.
- **RC1.5-A — Versioned Tax Data Foundation = BACKEND PASS**.
- **RC1.5-B — VAT Calculation & Invoice Accounting Bridge = BACKEND PASS**.
- **AC-1 — Frontend Architecture Consolidation = ENGINEERING PASS**.
- **RC1.5-C — Tax UX & VAT Reports = BACKEND PASS / FRONTEND ENGINEERING READY / LIVE PENDING**.
- **RC1.5 Money Precision / Report/Settlement regression bundle = ENGINEERING PASS in Staging**.
- **RC1.5-D — e-Invoice pre-validation / adapter contract = ENGINEERING PASS** via PR #82, merge `4c11b73c44c0a4c54754179031be1eec94573d90`, Actions Run #95 = success.
- **Integrated Tax + Settlement precision gate = ENGINEERING PASS** via PR #83, merge `ec3ff364ef5fc07ad2152805d09607f38ed5b1db`; PR Actions Run #99 and post-merge main Run #100 = success.
- Production root runtime remains RC1.4. All recent RC1.5 runtime changes are Staging-only.
- Tax remains disabled for all current Companies unless explicitly activated by an authorized Company owner/manager.
- No e-Invoice submission/transmission is enabled; RC1.5-D is pre-validation + provider-neutral adapter boundary only.

### Next gates

1. **Full Staging regression**: accounting + inventory + sale/purchase invoice + VAT + settlement + print/export + PWA/mobile.
2. **Explicit browser/PWA Live acceptance** for RC1.5-C and the accumulated RC1.5 regression fixes; this is still pending user confirmation.
3. performance/mobile/PWA polish and final Release Candidate gate.
4. Production promotion only after the above gates and Production smoke/rollback checks.
5. Backup/Restore full external disaster restore remains an explicit zero-charge limitation unless a genuinely free isolated restore target becomes available.

---

## 2) Production baseline — RC1.4

Accepted Production facts:

- runtime commit: `81b5c54643267842a8f225ee09668ade2fc95052`.
- `config.js` remains production-specific and Auth redirect remains Production URL.
- Production is not used as the development workspace.
- RC1.5-A/B/C backend migrations were designed as backward-compatible; Tax defaults disabled.
- recent money/e-Invoice/settlement frontend work has not been promoted to root.

Release/evidence files:

- `PRODUCTION_RELEASE_RC1_4.md`
- `avan-staging/RC1_4_PROMOTION_READINESS.md`
- `avan-staging/RC1_5_A_GATE_EVIDENCE.md`
- `avan-staging/RC1_5_B_GATE_EVIDENCE.md`
- `avan-staging/RC1_5_C_GATE_EVIDENCE.md`
- `avan-staging/ARCHITECTURE_CONSOLIDATION_GATE_EVIDENCE.md`

---

## 3) Explicit Live PASS / acceptance history

Prior accepted gates remain valid:

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
- inventory receipt/document and invoice workspace fixes.
- invoice party selection.
- three-level product grouping + operational SKU.
- minimum-stock semantics.
- Persian inventory dates.
- purchase receipt → purchase invoice matching.
- sale inventory issue/reversal.
- Persian user-facing terminology/error policy.
- mixed/installment settlement grouped money inputs.

**Not Live PASS yet:** RC1.5-A/B/C/D, AC-1, one-Rial invoice precision/report fixes, settlement regression fixes, and PR #83 integrated Tax/Settlement gate are Engineering/Backend PASS unless the user explicitly accepts the corresponding browser/PWA gate.

---

## 4) Governing architecture / invariants

- PostgreSQL/Supabase = financial Source of Truth.
- browser never receives Service Role / secret/private keys.
- Company/RLS boundary is mandatory; cross-company leakage = Blocker/Critical.
- Avan is Multi-tenant / Multi-company SaaS.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines immutable.
- Canonical Ledger unit = **Toman with 0.1-Toman precision = 1 Rial** under ADR-0019.
- whole-Rial invoice values such as `1515 Rial` must persist exactly as `151.5 Toman` Canonical.
- no silent sub-Rial rounding is allowed.
- generic integer-money flows may retain their old integer contract until explicitly migrated, but may not reinterpret decimal Canonical values.
- Posted/Reversed Ledger must remain balanced and orphan journal lines must remain zero.
- Local/Session storage contains auth/security/UI state only; no financial Source of Truth.
- account hierarchy is structural; only valid leaves are postable.
- user-visible errors/UI must be fluent Persian except unavoidable standards such as PDF/CSV/SKU.
- Frontend migration follows Strangler Pattern; full rewrite is prohibited.
- new runtime extensions must not monkey-patch shared client methods; use Operation Pipeline / lifecycle composition.
- business calculations should be pure/domain-level and unit-testable where practical.
- AI/automation stays Human-controlled and explainable.

---

## 5) Current accounting / security integrity baseline

Latest read-only verification on 2026-09-09 after PR #83 engineering work:

- Posted/Reversed Ledger debit = credit = **4,073,483,384.7 Toman**.
- current Ledger is therefore balanced at one-Rial precision.
- settlement schedule total mismatches = **0** across **5** invoices with schedules.
- orphan settlement schedules = **0**.
- orphan financial checks = **0**.
- `invoices.subtotal_amount`, `invoices.tax_total`, `invoices.total_amount`, `invoice_settlement_schedule.amount`, `financial_checks.amount`, and `journal_lines.debit/credit` are all `numeric(20,1)`.
- orphan journal lines / unbalanced Posted-Reversed journals remain release blockers and must stay zero.
- `public SECURITY DEFINER` functions executable by `authenticated` = **0** at the latest security-hardening baseline.
- authenticated dangerous Tax table privileges (`TRUNCATE/REFERENCES/TRIGGER`) = **0**.
- Companies with Tax enabled = **0** at the RC1.5 tax baseline.

RC1.4 inventory reconciliation baseline remains accepted:

- all 6 Companies reconciled.
- active Company Movement Ledger value = `1,123,500,000`.
- active Company Inventory Ledger account balance = `1,123,500,000`.
- inventory difference = 0.
- issue Movement COGS = `32,500,000`.
- COGS Ledger balance = `32,500,000`.
- COGS difference = 0.

---

## 6) Multi-company / tenant lifecycle — LIVE PASS

Implemented and accepted:

- central `CompanyContext` + explicit active Company.
- Company Portfolio (`شرکت‌های من`).
- no hidden first-workspace tenant selection.
- CompanyBoundary over legacy Core reads.
- atomic Company creation; creator becomes Owner.
- suspend/reactivate/archive lifecycle at DB boundary.
- DB-enforced member limit.
- Platform Admin separated from Company Admin.
- controlled read-only Support access.
- active Company identity/logo drives branding.

---

## 7) Chart of accounts

Hierarchy:

- Level 1 = `کل`
- Level 2 = `معین`
- Level 3 = `تفصیلی ۱`
- Level 4 = `تفصیلی ۲`

Rules:

- only leaves are postable.
- parent with active child is non-postable.
- browser cannot create root Level 1.
- account code is assigned authoritatively by DB trigger.
- existing/custom codes are preserved.
- standard chart is provisioned per Company.

RC1.5-B VAT account roles:

- `vat_input_receivable` = اعتبار مالیاتی ارزش افزوده خرید.
- `vat_output_payable` = مالیات بر ارزش افزوده فروش پرداختنی.

---

## 8) Journal / invoice / tax integrity

Journal:

- Draft → Posted → Reversed = PASS baseline.
- Posted immutability and reversal integrity are mandatory.

Invoice:

- Draft → Posted → Reversed = PASS baseline.
- sale item invoice atomically bridges to Inventory issue + COGS.
- purchase item invoice can bind to posted receipt lines without duplicate stock receipt.
- receipt item/quantity mismatch is Backend-blocked.

Tax bridge:

- Draft stores deterministic tax snapshots when Tax is enabled.
- header stores `subtotal_amount`, `tax_total`, final `total_amount`.
- rule version/effective date is validated.
- exempt/zero-rate lines preserve zero-tax snapshots.
- Sale VAT → output VAT payable credit.
- Purchase VAT → input VAT receivable debit.
- reversal reverses VAT with the original journal.
- Posted/Reversed immutability includes tax totals.

Money precision:

- invoice price/discount/line/invoice/journal monetary persistence supports 0.1 Toman.
- UI uses decimal-safe one-tenth-Toman BigInt boundaries.
- `1515 Rial ↔ 151.5 Toman` is exact.
- no DB migration was required for the 2026-09-09 invoice precision UI fix because Backend columns already supported the precision.

---

## 9) Inventory / Warehouse / Costing — RC1.4 Production baseline

- Inventory Movement Ledger is stock quantity/value source.
- posted movement immutable; correction by reversal.
- quantity supports controlled decimals; core quantity up to 6 decimals.
- moving weighted-average costing.
- released RC1.4 inventory valuation remains its established integer-Toman boundary until explicitly migrated.
- Company-scoped FK/RLS boundaries.
- browser does not write stock movements directly.
- product model: `گروه اصلی → زیرگروه → مدل/خانواده → SKU واقعی`.
- receipt / issue / transfer / adjustment / opening are supported.

---

## 10) Sales / Purchase Settlement

Supported plan types:

- اعتباری
- نقدی
- چکی
- اقساطی
- ترکیبی

Accounting model:

- invoice recognizes receivable/payable first.
- settlement separately clears receivable/payable.
- checks use dedicated receivable/payable check accounts.
- schedule total must exactly equal final invoice total.
- installment rows have independent due/status.

### RC1.5 exact settlement ownership

- `src/domains/settlement/settlement-plan-contract.js` owns canonical exact parsing and schedule-total validation.
- `settlement-save-boundary-v3.js` delegates persisted invoice total and schedule validation to that domain contract.
- deterministic integration regression covers VAT-inclusive final total at one-Rial precision.
- locked example: `151.5 Toman subtotal + 15.2 Toman VAT = 166.7 Toman final`.
- credit/cash/check/installment/mixed plans are tested against exact `166.7` total.
- a 0.1-Toman mismatch is rejected; sub-Rial amounts are rejected rather than rounded.
- current DB read-only audit shows schedule mismatches = 0 and orphan schedules/checks = 0.

Legacy compatibility note:

- architecture audit reports **direct shared-client overwrites = 0**.
- the old v61 Settlement operation fallback remains source-level compatibility code but is **inert at runtime** because `settlement-save-boundary-v3` owns `settlement:invoice-plan` first; it is not counted as an active monkey patch.
- `settlement-workspace-v2` owns the modern Settlement UI lifecycle before the v61 compatibility handler.
- any future physical removal of dead compatibility code must be done as a controlled shell-extraction change, not a risky minified bulk edit.

---

## 11) Persian UX / Money / Print contract

- numeric money inputs use three-digit grouping where applicable.
- invoice `unit_price` / `discount` provide Persian amount-in-words projection.
- reports/tables/prints show active money unit in monetary headings.
- prepared report monetary cells do not repeat `تومان/ریال` next to every number.
- prepared report headings/titles use the centralized presentation contract and are centered where required.
- receipt/payment/transfer financial detail views follow heading-only money-unit presentation.
- Rial/Toman display switching never rewrites Canonical history.

---

## 12) Auth / Session / password policy

Stable behavior:

- existing-user login and recovery flow.
- signup/recovery password guard: minimum 12 chars + letter + number + symbol + local common-password denylist.
- session guard: 60-minute inactivity + 12-hour maximum browser session + clock-skew protection.
- revoked-session auto-recovery experiment remains excluded from stable runtime.

Leaked Password Protection:

- Supabase built-in leaked-password screening remains unavailable/disabled under the current zero-charge path.
- application strength/common-password checks are the compensating control.
- provider control is not falsely marked fixed.

---

## 13) SECURITY DEFINER / RLS hardening

Completed baseline:

- `public.has_workspace_access` and `public.workspace_role` are SECURITY INVOKER.
- browser-facing privileged command RPCs use SECURITY INVOKER wrappers.
- privileged implementations live in `private` where required.
- critical public tables use RLS.
- authenticated-executable public SECURITY DEFINER functions = 0 at latest verified baseline.
- Tax settings mutation is owner/manager-only with UPDATE `USING` + `WITH CHECK`.
- Tax APIs use explicit authenticated execution boundaries.
- `workspace_invitations` remains intentional deny-by-default/helper-mediated.

---

## 14) Backup / Restore

Runbook:

- `avan-staging/BACKUP_RESTORE_RUNBOOK.md`

State:

- Free Transactional Recovery Rehearsal = PASS.
- full external disaster restore = **OPEN / NOT FULL PASS** because no genuinely free isolated restore target is available in the connected environment.
- never restore against `Avan-production` itself.
- no paid Supabase branch/project workaround is allowed under current zero-charge policy.
- if unresolved at release, this must be documented explicitly as a known zero-charge limitation.

---

## 15) Platform Admin / Support

Accepted:

- Platform Admin authority is separate from Company Ledger authority.
- Support access is actor-bound, Company-bound, reason-required, time-limited and read-only.
- Support does not create Company membership.
- read-only allowlisted viewer and audit logging are required.

---

## 16) Smart Documents

ADR-0013 keeps browser-local OCR frozen.

Supported flow:

`Upload → Private original → Internal Viewer → Manual Review → Accounting Draft → Human Approval → Ledger Link`

---

## 17) AC-1 — Frontend Architecture Consolidation — ENGINEERING PASS

Governing ADR: `docs/adr/0016-modular-runtime-no-monkey-patching.md`.

- Strangler Pattern; no full rewrite.
- `app.js` remains Compatibility Shell while features are extracted.
- deterministic named Operation Pipeline is the shared-operation extension point.
- centralized UI lifecycle adapter replaces competing body-wide mutation logic feature-by-feature.
- pure Domain modules hold calculation/validation logic where practical.
- syntax + unit/regression tests + architecture audit run in GitHub Actions.
- architecture audit currently reports unauthorized/direct shared-client overwrites = **0**.
- new direct monkey patches are CI-blocked.
- dead compatibility code may remain temporarily only when runtime ownership is explicit and tested.

Latest relevant CI:

- RC1.5-D PR #82: Actions Run #95 = success.
- Integrated Tax/Settlement PR #83: Actions Run #99 = success.
- PR #83 post-merge `main`: Actions Run #100 = success.

---

## 18) RC1.5 Tax / VAT / e-Invoicing cycle

Governing ADRs:

- ADR-0007 — versioned Tax rules.
- ADR-0019 — one-Rial Canonical precision.
- ADR-0021 — electronic-invoice prevalidation/adapter boundary.

### RC1.5-A — BACKEND PASS

- versioned/effective-date Tax rule foundation.
- Company tax settings for all current Companies.
- standard/exempt/zero-rate profiles.
- no silent legacy reclassification.
- Tax default disabled.

### RC1.5-B — BACKEND PASS

- deterministic VAT calculation/persistence.
- sale/purchase VAT account bridge.
- reversal integrity.
- transactional rehearsal passed and rolled back.

### RC1.5-C — BACKEND PASS / FRONTEND ENGINEERING READY / LIVE PENDING

- Company tax activation/configuration UX.
- item and invoice tax profile/snapshot UX.
- live subtotal/VAT/final totals.
- posted invoice tax detail.
- VAT sales/purchase/net report.
- Persian validation and print-visible tax sections.
- Tax remains disabled until explicit authorized activation.

### Money / report / settlement regression fixes — ENGINEERING PASS

Implemented across PR #76/#77 and later report refinements:

- whole-Rial invoice precision with `1515 Rial → 151.5 Toman` exact.
- amount-in-words under invoice price/discount.
- settlement reads/persists decimal Canonical totals rather than integer-coercing them to zero.
- report unit appears in headings and not repeatedly in monetary cells.
- report headings/titles centralized/centered.
- receipt/payment/transfer detail unit repetition removed.

These fixes remain part of the pending browser/PWA Live acceptance unless explicitly accepted by the user.

### RC1.5-D — e-Invoice pre-validation / adapter contract — ENGINEERING PASS

PR #82 / merge `4c11b73c44c0a4c54754179031be1eec94573d90` / Actions #95 success.

Contract:

- normalized `avan.einvoice.preflight.v1` model.
- pure prevalidation returns all blockers/warnings.
- checks stable accounting/tax/money invariants.
- provider/template-dependent rules remain versioned outside Core.
- provider-neutral adapter exposes preflight/build-payload boundary.
- external `submit()` is deliberately disabled.
- no production transmission, no external provider credentials in browser, no Ledger mutation.

### Integrated Tax + Settlement — ENGINEERING PASS

PR #83 / merge `ec3ff364ef5fc07ad2152805d09607f38ed5b1db`.

- PR Run #99 = success.
- post-merge main Run #100 = success.
- deterministic VAT-inclusive one-Rial settlement regression added.
- centralized Settlement domain contract added.
- DB schema/read-only integrity verified at `numeric(20,1)` money precision.
- no migration and no Production data mutation were required.

---

## 19) Remaining Web/PWA release path

1. run full Staging regression over accounting, Inventory, invoices, VAT, Settlement, reports/print/export and PWA/mobile.
2. fix every Blocker/Critical regression in Staging and keep CI green.
3. obtain explicit user browser/PWA Live acceptance for pending RC1.5-C/money/settlement UX.
4. complete performance/mobile/PWA polish.
5. document final Backup/Restore disposition under zero-charge policy.
6. create final Release Candidate and Production promotion plan with rollback point.
7. promote to Production only after Live/RC acceptance; then run Production Smoke Gate.

No Production root promotion is authorized merely by Engineering PASS.

---

## 20) Product roadmap after final Web/PWA release

Desktop direction remains deferred.

Later platform phase:

- installable Windows `.exe`.
- true offline capability requires local persistence + conflict-aware synchronization; a web wrapper alone is not offline support.
- shared Domain/Application logic should remain platform-neutral.

Candidate future areas:

- Treasury / cheque / bank reconciliation expansion.
- Bank transaction matching.
- Payroll.
- Fixed Assets.
- Budgeting / forecast / scenarios.
- Workflow & Approval.
- Consolidated multi-company reporting.
- external integrations/API/Excel/POS/banks.
