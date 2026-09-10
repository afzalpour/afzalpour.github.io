# AVAN — RC1.6 Candidate Freeze

Candidate: **RC1.6-Candidate-1**  
Freeze date: **2026-09-10**  
Base main SHA before freeze marker: `4ddeb92643137eb5ef5cf01d09e36901e947da3a`

## Included Live-accepted scope

- RC1.6-A Bank Reconciliation Foundation — Engineering/Backend PASS.
- RC1.6-B Bank Statement Import + Reconciliation UI/refinements — Engineering PASS + Live PASS for implemented scope.
- RC1.6-C Party Ledger including PR #113 final presentation refinements — Engineering PASS + Full Live PASS.
- Accounting-negative presentation: visual red `(amount)` only; signed Core/DB values unchanged.
- Staging PWA cache baseline: `avan-staging-rc1-v101-accounting-negative-display`.

## Freeze rule

This candidate is a release-validation surface. No new feature work may be added to this branch. Only Blocker/Critical release fixes discovered by the Release Candidate Gate may modify it, and every such fix must receive its own regression evidence.

Financial Control Tower and Financial Digital Twin are explicitly excluded from this RC1.6 candidate and begin in the next Staging feature cycle under ADR-0023.

## Required candidate gates

- Full Staging Architecture/Regression Gate.
- PWA precache integrity.
- Read-only DB integrity.
- RLS/security baseline.
- `SECURITY DEFINER` public exposure = 0.
- one-Rial exactness / no sub-Rial silent rounding.
- Print/PDF unit + negative-accounting presentation regression.
- controlled Production promotion diff and separate Production Release Gate.
