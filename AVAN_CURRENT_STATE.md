# AVAN — Current Project State

آخرین به‌روزرسانی مرجع: **2026-09-10 — RC1.5 = Production Released؛ RC1.6-A + RC1.6-B Bank Reconciliation = Engineering/Backend PASS؛ RC1.6 Live PASS هنوز اعلام نشده است.**

این فایل Source of Truth وضعیت جاری پروژه است. Engineering/Backend PASS جایگزین Live PASS نیست؛ Live فقط با تأیید صریح کاربر ثبت می‌شود.

---

## 1) Release state

Repository: `afzalpour/afzalpour.github.io`

- repository root = **Production**.
- `avan-staging/` = **Staging / next release workspace**.
- Supabase financial Source of Truth = `Avan-production` (`dkyqsxnllvxypigxpygo`).
- zero-charge policy remains binding.
- Web/PWA is the active release target; Windows/Desktop/true offline remains deferred.

### Production

- **RC1.5 = current Production release**.
- Production promotion PR: **#103 — Release RC1.5 to Production**.
- Production merge commit: `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- Production URL: `https://afzalpour.github.io/`.
- Production Service Worker cache: `avan-prod-rc1-5-v1`.
- Production Release Gate #1 on PR #103 = PASS.
- post-merge Production Release Gate #2 = PASS.
- GitHub Pages #332 = PASS.
- external Production HTTP Smoke #1 = PASS.
- formal release record: `PRODUCTION_RELEASE_RC1_5.md`.

### Staging / RC1.6

- **RC1.6-A — Bank Reconciliation Foundation = Engineering/Backend PASS; Live PASS not yet claimed.**
- PR #105 merged as `db6844b2ff1f273ed0d63ba906740d73e42cdf45`.
- PR Architecture Gate #156 = PASS.
- post-merge main Architecture Gate #157 = PASS.
- **RC1.6-B — Bank Statement Import + Reconciliation Workspace UI = Engineering/Backend PASS; Live PASS PENDING.**
- PR #106 merged as `ea787f6688fac84fc1c28907542d5a184f9f58fe`.
- RC1.6-B PR Architecture Gate #161 = PASS.
- post-merge main Quality = PASS; GitHub Pages build/deploy = PASS.
- Staging Service Worker cache = `avan-staging-rc1-v95-bank-reconciliation-ui`.
- RC1.6-A/RC1.6-B Backend migrations are applied; Production root Frontend/Runtime remains RC1.5.
- immediate next gate = **explicit RC1.6-B browser/PWA Live Gate**; no RC1.6 Production promotion is authorized yet.

### Rollback

- RC1.5 pre-promotion rollback branch: `prod-backup-20260910-rc1-5-pre-promotion`.
- rollback freeze SHA: `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`.
- historical RC1.4 rollback branch remains: `prod-backup-20260907-rc1-4-pre`.
- RC1.5 rollback is frontend/root rollback; do not perform destructive DB rollback.

---

## 2) Explicit Live acceptance

The user explicitly reported:

**«شش مورد پاس شد — RC1.5 Live PASS»**

This accepted the remaining RC1.5 Live gate covering:

1. one-Rial money;
2. VAT → final invoice → Settlement exactness;
3. sale/purchase and settlement modes;
4. reports/print money-unit contract;
5. iPhone/mobile usability;
6. PWA offline shell.

Earlier granular Live acceptances remain valid:

- Settings no-layout-shift;
- e-Invoice prevalidation/discoverability;
- Company Context post-auth hydration/company entry without manual refresh;
- Dashboard Risk presentation;
- Dashboard Financial Analysis title-above/value-below presentation.

No RC1.6 Live PASS has been reported yet.

---

## 3) Final RC1.5 fixes included in Production

### Invoice save latency

Normal sale/purchase invoice save no longer performs a full-page Auth/bootstrap reload. Before Production promotion the save path was further optimized:

- repeated Auth `/user` round-trips reduced;
- token refresh made single-flight;
- Company Context avoids redundant authenticated refresh when authoritative;
- redundant Settlement invoice-total readback removed while Backend exact-total validation remains authoritative;
- post-save refresh uses an RLS-governed authoritative snapshot instead of many independent reads.

Observed Backend execution times showed accounting RPCs themselves were in the low hundreds of milliseconds or less; the previous multi-second delay was primarily Frontend/Auth orchestration.

### Settlement presentation

All settlement modes — اعتباری / نقدی / چکی / اقساطی / ترکیبی — retain exact canonical money and now present:

- three-digit grouping;
- Persian amount-in-words;
- one-Rial precision.

### PWA integrity

Before Production, stale precache references to retired files were removed:

- `src/ui/money/live-money-inputs.js`;
- `src/documents/document-viewer-v2.js`.

A permanent regression guard now verifies every declared Staging precache asset exists. The guard is version-tolerant and rejects regressions behind the accepted precache-integrity baseline instead of hardcoding every legitimate future cache bump.

---

## 4) Governing invariants

- PostgreSQL/Supabase is the financial Source of Truth.
- browser never receives Service Role/private secrets.
- Company/RLS boundary is mandatory; cross-company leakage is Blocker/Critical.
- Journal lifecycle = `Draft → Posted → Reversed`; Posted entries/lines are immutable.
- Canonical money = **Toman with 0.1 Toman = 1 Rial** under ADR-0019.
- `1515 Rial` persists losslessly as `151.5 Toman`; the old divisible-by-10 rule is obsolete.
- sub-Rial values are rejected rather than silently rounded.
- browser Local/Session storage is not a financial datastore.
- account hierarchy is structural; only valid leaves are postable.
- Persian-first / RTL.
- no new shared-client monkey patching; named Operation Pipeline / central Lifecycle are extension boundaries.
- AI/automation remains Human-controlled and explainable.
- applied DB migration history is immutable; compatibility corrections are additive follow-up migrations rather than rewrites of already-applied migration files.

---

## 5) Production integrity baseline — 2026-09-10

Read-only verification after RC1.5 Production deployment:

- workspaces: 7;
- membership rows: 8;
- accounts: 546;
- journal entries: 75;
- journal lines: 171;
- invoices: 35;
- storage objects: 25;
- Posted/Reversed Ledger debit = **4,081,615,836.9 Toman**;
- Posted/Reversed Ledger credit = **4,081,615,836.9 Toman**;
- unbalanced Posted/Reversed journals = 0;
- orphan journal lines = 0;
- authoritative invoice total mismatch = 0;
- Posted/Reversed invoices without journal = 0;
- settlement schedule total mismatch = 0;
- orphan settlement schedules = 0;
- orphan financial checks = 0;
- unreconciled inventory companies = 0;
- anon/authenticated-executable public `SECURITY DEFINER` = 0.

Legacy note: 25 historical pre-Tax invoices have `subtotal_amount IS NULL`; they are not current integrity mismatches and no backfill/destructive mutation was performed during release.

---

## 6) Security / RLS / backup state

- public financial access remains RLS-governed.
- authenticated-executable public `SECURITY DEFINER` = 0.
- anon-executable public `SECURITY DEFINER` = 0.
- prior real authenticated one-Company rehearsal showed authorized Company/accounts visible and unrelated Companies/accounts hidden.
- Session guard: 60-minute inactivity + 12-hour max + clock-skew protection.
- password guard: minimum 12 chars + letter + number + symbol + common-password denylist.
- Supabase built-in Leaked Password Protection remains unavailable under the current zero-charge/provider posture; application controls remain compensating controls and provider protection must not be falsely marked fixed.
- Free Transactional Recovery Rehearsal = PASS.
- full external disaster restore to an isolated fresh target remains OPEN because no genuinely free isolated restore target is available; never restore against `Avan-production` itself.
- Supabase Security Advisor after RC1.6-B added no RC1.6-specific warning; existing known warnings remain the private-table no-policy informational findings and provider Leaked Password Protection warning.

---

## 7) Money / Tax / Settlement

Money:

- canonical Toman with one-Rial precision;
- amount-in-words supported;
- display-unit switching never rewrites canonical history.

VAT:

- versioned/date-effective rules with deterministic line snapshots;
- Sale VAT → output VAT payable;
- Purchase VAT → input VAT receivable;
- reversal preserves original accounting effect in reverse.

Settlement:

- اعتباری / نقدی / چکی / اقساطی / ترکیبی;
- exact schedule sum must equal persisted final invoice total;
- locked reference: `151.5 + 15.2 = 166.7 Toman`;
- installment reference: `55.6 + 55.6 + 55.5 = 166.7`; `166.6` mismatch rejected.

---

## 8) UX / Reports / Dashboard / Settings

- report/print monetary headings carry the active money unit without repeating the unit after every numeric cell.
- receipt/payment/transfer detail follows the same unit contract.
- Risk and Financial Analysis dashboard cards use title-above/value-below with overflow protection.
- Settings single layout owner: `src/ui/settings/settings-layout-v2.js`.
- deterministic Settings order: `Account/Money → Tax → Users/Access → Support → Activity → Company Profile`.
- zero-company onboarding is explicit.
- Company Context authoritative post-auth hydration prevents stale pre-login empty membership state.
- company selection avoids parallel focus/open refresh loops.

---

## 9) e-Invoice boundary

RC1.5 is provider-neutral prevalidation only. No external invoice submission is enabled and no provider credential exists in browser runtime. Missing seller tax identity remains a future readiness blocker when submission is introduced.

---

## 10) Quality / release evidence

Key RC1.5 evidence:

- PR #101 invoice save latency optimization = merged; Architecture Gate #144 PASS; main #145 PASS; Pages #330 PASS.
- PR #102 PWA precache integrity = merged `38fb915cfe98ecc82015c1f1e46fc4a7827a9613`; PR Gate #148 PASS; main #149 PASS; Pages #331 PASS.
- RC1.5 Production Promotion Builder v2 = PASS.
- PR #103 Production Release Gate #1 = PASS.
- Production merge commit = `d5f3c704e81d359ae86c505d12fbc9df8d8f0d14`.
- post-merge Production Release Gate #2 = PASS.
- Pages #332 = PASS.
- external Production HTTP Smoke #1 = PASS.
- post-deploy DB integrity = PASS.

**RC1.5 Final Engineering Gate = PASS.**  
**RC1.5 Full Live Gate = PASS by explicit user report.**  
**RC1.5 Production Release = PASS.**

RC1.6-A evidence:

- ADR-0022 = bank-statement reconciliation boundary.
- branch `rc1.6-a-bank-reconciliation` → PR #105.
- domain matcher requires same Company, bank account, exact one-Rial amount, correct bank-side direction, Posted receipt/payment/transfer and bounded date distance.
- Persian/Arabic digits in bank references normalize deterministically.
- Backend tables: `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliation_matches`.
- all three tables have RLS; writes are restricted to owner/manager/accountant and reads remain Company-scoped.
- candidate RPC `avan_bank_reconciliation_candidates` is `SECURITY INVOKER` and read-only; no autonomous financial DML.
- `financial_transactions.reference` was added as a nullable backward-compatible field; effective compat RPC does not depend on historical nonexistent `tx_no`.
- matching is Human-controlled; no auto-confirm and no automatic Journal/financial-transaction posting.
- void/audit lifecycle replaces destructive match deletion.
- unresolved lines block finalization; exact opening/closing bank balance equation is enforced when balances are provided.
- real authenticated transaction rehearsals with `ROLLBACK`: positive Match PASS; wrong direction REJECT; 0.1 Toman mismatch REJECT; cross-Company insert REJECT; unresolved finalize REJECT; closing-balance mismatch REJECT; valid finalize PASS.
- final read-only Backend integrity: 3/3 RC1.6 tables present; 4/4 bank monetary columns = `numeric(20,1)`; orphan statement lines = 0; orphan match refs = 0; duplicate active matches = 0; active amount mismatch = 0; active wrong-direction matches = 0; authenticated-executable public `SECURITY DEFINER` = 0.
- permanent CI tests: `rc16-bank-reconciliation.spec.mjs` + `rc16-bank-reconciliation-backend-contract.spec.mjs`.
- early Gate #150 found Persian reference normalization defect and failed correctly; fixed in matcher.
- Gate #154/#155 found static-contract false assumption / historical migration compatibility issue; final guard now respects immutable applied migration history and validates the effective compat contract.
- PR Architecture Gate #156 = PASS.
- PR #105 merge commit = `db6844b2ff1f273ed0d63ba906740d73e42cdf45`.
- post-merge main Architecture Gate #157 = PASS.

**RC1.6-A Engineering/Backend Gate = PASS.**  
**RC1.6-A Live Gate = PENDING.**

RC1.6-B evidence:

- branch `rc1.6-b-bank-reconciliation-ui` → PR #106.
- local CSV parser supports comma/semicolon/Tab, Persian/Arabic digits, Jalali/ISO date normalization, split debit/credit or amount/direction mappings, max 5,000 rows and local SHA-256 fingerprints.
- source file money unit is explicit (`rial` / `toman`) and canonical persistence remains one-Rial Toman precision.
- split-column parser preserves explicit `SUB_RIAL_VALUE` evidence instead of collapsing it into a generic invalid-amount message.
- Application service uses the existing bank financial-account master and RC1.6-A candidate RPC; it never invokes Journal posting APIs.
- atomic import RPC `avan_import_bank_statement` is `SECURITY INVOKER`, Company-scoped, role-gated and grants execute to `authenticated` but not `anon`.
- real authenticated `ROLLBACK` import rehearsal = PASS: one line inserted, import moved to `ready`, `row_count=1`, then rolled back.
- UI exposes bank selection, local CSV preview/mapping, import list, statement-line status, ranked candidates, explicit Match confirmation, Ignore with reason, Void with reason and explicit finalization.
- Persian Human-controlled warning states that even score 100 is a suggestion and no accounting document is posted automatically.
- no private `MutationObserver` and no shared-runtime monkey-patching are introduced by the RC1.6-B workspace.
- permanent tests: `rc16-bank-statement-csv.spec.mjs` + `rc16-bank-reconciliation-ui-contract.spec.mjs`, wired into `npm run quality`.
- Gate #158 correctly exposed a sub-Rial Persian validation-message defect; implementation fixed without weakening the test.
- Gate #159 = PASS.
- Staging PWA precache now includes the RC1.6-B Application/Domain/UI modules; cache identity = `avan-staging-rc1-v95-bank-reconciliation-ui`.
- Gate #160 then correctly exposed a stale hardcoded v94 cache assertion; the test was made version-tolerant while keeping duplicate/missing-asset and navigation-only fallback guards intact.
- PR Architecture Gate #161 = PASS.
- post-migration read-only integrity: orphan statement lines = 0; orphan reconciliation matches = 0; active amount mismatches = 0; public executable `SECURITY DEFINER` = 0; all 3 RC1.6 tables have RLS.
- Supabase Security Advisor introduced no RC1.6-specific warning.
- PR #106 merge commit = `ea787f6688fac84fc1c28907542d5a184f9f58fe`.
- post-merge main Quality = PASS; Pages build/deploy = PASS.

**RC1.6-B Engineering/Backend Gate = PASS.**  
**RC1.6-B Live Gate = PENDING.**

---

## 11) RC1.6 Bank Reconciliation contract

RC1.6 deliberately introduces a reconciliation evidence layer, not a second payment subsystem:

- bank master remains `financial_accounts(kind='bank')` and its existing `ledger_account_id`;
- statement imports support CSV as the first governed source format;
- CSV is parsed and mapped locally before any persistence;
- statement evidence is immutable after import except the controlled Ignore lifecycle;
- active Match requires exact canonical amount and the correct bank side of an existing Posted financial transaction;
- Draft, Cancelled and `opening_balance` financial transactions never become candidates;
- file SHA-256 prevents duplicate import of the same statement for the same bank account;
- ranked candidates are explainable Evidence only;
- a user must explicitly confirm a Match;
- confirmed reconciliation never edits Posted Ledger and never creates a financial document automatically;
- a wrong confirmed Match is corrected by Void with actor/time/reason evidence, not Delete;
- unresolved lines block finalization; opening/closing balance equation is exact when supplied;
- Company/RLS boundary is mandatory at tables, FKs, RPC, service and tests;
- Web/PWA presentation preserves Persian-first/RTL and one-Rial monetary contracts.

---

## 12) Next cycle

Production RC1.5 remains frozen except for governed hotfixes. RC1.6 feature work stays in `avan-staging/`.

Immediate next gate:

**RC1.6-B — Browser/PWA Live Gate**

Live acceptance must explicitly verify:

1. «خزانه‌داری → مغایرت بانکی» is discoverable and opens without shell/page regressions;
2. an existing bank account can be selected;
3. CSV is previewed and column-mapped locally before save;
4. Rial/Toman source-unit handling preserves one-Rial precision (reference: `1515 Rial = 151.5 Toman`);
5. persisted statement lines display correct date, direction, amount/reference and reconciliation status;
6. ranked candidate suggestions appear without creating any Journal automatically;
7. a Match is saved only after explicit user confirmation;
8. Ignore requires a reason and Void requires a reason;
9. unresolved lines block Finalize and a fully resolved valid statement can finalize;
10. mobile/PWA layout is usable and the updated precache loads without missing-module/MIME/white-screen errors.

No RC1.6 Production promotion may occur until explicit user Live PASS and a separate governed promotion approval.

Longer direction remains:

**Treasury / Bank Reconciliation → cash & cheque intelligence → advanced reconciliation → managerial dashboards/reporting.**

Desktop/true-offline remains deferred until a real local persistence/synchronization architecture exists.
