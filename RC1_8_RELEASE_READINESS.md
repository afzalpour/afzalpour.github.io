# AVAN — RC1.8 Release Readiness

Status: **READINESS PASS — Production promotion NOT authorized**

Date: **2026-09-14**

This checklist governs the release candidate that promotes the already accepted Staging scope of Modules 4, 5, 7 and 9 to Production. It does not itself copy Staging runtime to Production and does not authorize a Production merge.

## Release boundary

- Production root remains **RC1.7**.
- Modules 4, 5, 7 and 9 remain under `avan-staging/` only.
- Frozen accepted Staging runtime merge: `8b4da9fddd782b11e5b92e96ca37e8bbafbb2e69`.
- Source-of-Truth closure merge: `6dc872e98124c4312f2c2462a192c46a6098c662`.
- Current Staging cache: `avan-staging-rc1-v121-module9-live-layout-polish`.
- Pre-promotion Production rollback branch: `prod-backup-20260914-rc1-8-pre-promotion`.
- Production Service Worker remains `avan-prod-rc1-7-v1`.

## Accepted feature scope

### Module 4 — Continuous Close + Continuous Audit

- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] Read-only intelligence; no silent ledger mutation.
- [x] readable evidence and Jalali Print/PDF accepted.

### Module 5 — Iran Compliance Radar

- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] no fabricated legal deadlines.
- [x] payroll/insurance remain explicit non-coverage without authoritative data.
- [x] ADR-0025 Persian user-facing contract applied.

### Module 7 — Smart Procurement & Spend Control

- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] purchase/receipt matching, reused-receipt detection, quantity/price mismatch and stock/supplier controls accepted.
- [x] purchase request / PO / budget / approval workflow remain explicit non-coverage until authoritative sources exist.
- [x] Live usage remained mutation-free.

### Module 9 — Avan Connect / Automation Marketplace

- [x] Engineering PASS.
- [x] Authenticated Staging Live PASS / CLOSED.
- [x] final layout correction explicitly accepted with `«چیدمان ماژول ۹ نهایی PASS»`.
- [x] registry/marketplace/preview remain truthful; disconnected providers are not fabricated as connected.
- [x] workflow execution, connection mutation and financial writes remain disabled in Foundation v1.
- [x] ADR-0026 idempotency/audit/human-approval execution boundary accepted.

## Frozen runtime gates

- [x] Module 9 pre-merge Architecture Gate #317 = PASS.
- [x] Module 9 post-merge Architecture Gate #318 = PASS.
- [x] Module 9 runtime Pages #429 = PASS.
- [x] Source-of-Truth closure Pages #430 = PASS.
- [x] full Staging quality suite includes Modules 4/5/7/9 regressions.
- [x] PWA precache integrity covered by the Architecture Gate.
- [x] Runtime Parity contract ADR-0024 covered by the Architecture Gate.
- [x] strict Persian presentation contract ADR-0025 covered by regression.
- [x] canonical Toman / one-Rial precision regressions remain in the full gate.

## Fresh read-only database integrity — 2026-09-14

- [x] journal_entries = **94**; latest `2026-09-12 19:32:07.685779+00`.
- [x] financial_transactions = **24**; latest `2026-09-10 21:16:55.697626+00`.
- [x] invoices = **42**; latest `2026-09-10 16:37:20.676074+00`.
- [x] documents = **23**; latest `2026-09-07 21:11:31.272166+00`.
- [x] inventory_documents = **9**; latest `2026-09-07 12:44:33.272324+00`.
- [x] orphan journal lines = **0**.
- [x] cross-workspace journal-line mismatch = **0**.
- [x] unbalanced Posted journals = **0**.
- [x] orphan invoice lines = **0**.
- [x] cross-workspace invoice-line mismatch = **0**.
- [x] public `SECURITY DEFINER` functions executable by `anon` or `authenticated` = **0**.

## Promotion preparation

- [x] Production rollback branch frozen before promotion: `prod-backup-20260914-rc1-8-pre-promotion`.
- [ ] build controlled Staging → Production runtime diff while preserving Production-only configuration/secrets boundary.
- [ ] run Production Release Gate on the promotion branch before merge.
- [ ] obtain separate explicit user approval for RC1.8 Production promotion.
- [ ] merge Production promotion only after approval.
- [ ] run post-merge Architecture/Release Gate + Pages.
- [ ] perform Production authenticated smoke and read-only DB mutation/integrity verification.
- [ ] update `AVAN_CURRENT_STATE.md` to RC1.8 only after Production acceptance.

## Promotion exclusions / preservation rules

The controlled promotion must not blindly copy the entire `avan-staging/` directory. In particular:

- preserve Production environment configuration and secrets boundary;
- do not copy Staging-only quality tooling (`package.json`, tests, scripts) into Production runtime;
- create a new Production Service Worker cache identity rather than copying the Staging cache name;
- remove Staging runtime-divergence metadata from the Production runtime;
- copy only runtime files required by the accepted next-release scope and shared accepted fixes;
- do not introduce any database migration solely for the four modules unless separately reviewed and required;
- no connector credentials, Service Role secrets, automatic posting, payment, approval or external submission may be activated by promotion.

## Release rule

**RC1.8 is technically ready for construction of a controlled Production promotion PR, but Production promotion is not authorized by this document.** A separate explicit user approval is mandatory before the promotion PR may be merged.