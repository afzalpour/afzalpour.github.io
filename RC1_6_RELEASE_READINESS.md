# AVAN — RC1.6 Release Readiness

Status: **FINAL LIVE PASS RECORDED — RELEASE CANDIDATE CONSOLIDATION STARTED — Production promotion NOT authorized**

Date: **2026-09-10**

This checklist governs the step after RC1.6 feature completion. It does not release or copy Staging runtime to Production.

## Current release boundary

- Production root remains **RC1.5**.
- RC1.6 work remains under `avan-staging/`.
- Current Staging functional merge head before architecture-only follow-up: `781ce0418c86a492a656080ac45681b6251804cb`.
- Staging PWA cache: `avan-staging-rc1-v101-accounting-negative-display`.
- RC1.5 rollback branch remains `prod-backup-20260910-rc1-5-pre-promotion`.
- User explicitly confirmed final PR #113 presentation checks with: **«۴ اصلاح نهایی Live PASS»**.

## Feature readiness

### RC1.6-A — Bank Reconciliation Foundation

- [x] Engineering/Backend Gate PASS.
- [x] Company/RLS boundary covered.
- [x] one-Rial exactness covered.
- [x] Human-controlled matching/finalization.
- [x] no public anon/authenticated executable `SECURITY DEFINER` regression.

### RC1.6-B — Bank Statement Import + Reconciliation UI

- [x] Engineering Gate PASS.
- [x] real ESC bank statement import confirmed Live.
- [x] exact one-Rial receipt/payment/transfer confirmed Live.
- [x] candidate/operation-account scope confirmed Live.
- [x] pair-level Void suppression confirmed Live.
- [x] accumulated implemented RC1.6-B scope accepted Live.

### RC1.6-C — Party Ledger

- [x] Party Ledger accounting model uses exact `party_id` and AR/AP control accounts.
- [x] Engineering Gate PASS.
- [x] PR #112 UX/Print/Jalali polish explicitly accepted Live.
- [x] PR #113 Architecture Gate #184 PASS.
- [x] PR #113 post-merge Gate #185 PASS.
- [x] PR #113 Pages #350 PASS.
- [x] **PR #113 final presentation Live Gate PASS by explicit user report.**

## PR #113 Live checks

- [x] Reports launcher shows only Party selector + `مشاهده صورتحساب`.
- [x] Statement keeps Jalali from/to controls and no redundant Jalali instruction.
- [x] Party Ledger detail headings and values are centered on screen.
- [x] Party Ledger detail headings and values are centered in Print/PDF.
- [x] Negative financial outputs display visually as red `(amount)` with no visible minus.
- [x] Signed numeric truth/calculations remain unchanged.

## Release Candidate consolidation

The current step is now **RC1.6 Release Candidate consolidation**.

Before any Production promotion PR is allowed:

- [ ] freeze an explicit RC1.6 candidate branch/SHA from current `main` after architecture/state synchronization;
- [ ] run full Staging architecture/quality gate at frozen release candidate head;
- [ ] run PWA precache integrity gate;
- [ ] run fresh read-only DB integrity verification: balanced Posted/Reversed Journals, zero orphan lines, invoice/settlement invariants, inventory reconciliation, RC1.6 bank-reconciliation referential/amount/direction checks;
- [ ] verify Company/RLS cross-tenant boundaries and security baseline;
- [ ] verify public executable `SECURITY DEFINER` exposure remains zero;
- [ ] preserve one-Rial canonical precision and no sub-Rial silent rounding;
- [ ] verify Print/PDF active money-unit contract and accounting negative presentation;
- [ ] freeze a new pre-RC1.6 Production rollback branch/SHA;
- [ ] build a controlled Staging → Production promotion diff that preserves Production-only configuration;
- [ ] execute Production Release Gate before merge;
- [ ] execute post-merge Release Gate + Pages + external HTTP smoke + read-only DB integrity check.

## Post-RC1.6 strategic start

ADR-0023 adds nine strategic modules to the official architecture. The first two are Early Priority:

1. **Avan Financial Control Tower**;
2. **Financial Digital Twin**.

Their Foundation work begins in the first Staging development cycle after the RC1.6 release boundary is frozen. They must not be mixed into the RC1.6 Production promotion diff.

## Release rule

**No automatic promotion.** RC1.6 may reach Production only after a separate explicit Production Release Gate. Database rollback must never be destructive; frontend rollback and additive database compatibility rules remain in force.
