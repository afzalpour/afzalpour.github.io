# Avan — RC1.3-D Status

Date: 2026-09-06

## Current status
- Automated/server-side Full Regression: **PASS**.
- RC1.3-D invoice reversal integrity defect: **FIXED / REGRESSION PASS**.
- User Live UI Gate: **AWAITING USER**.
- Final Polish visual gate: covered by the same remaining Live UI checks and still awaits explicit user confirmation.
- Next after user PASS: **RC1.3-RC / Feature Freeze**.

## Automated PASS evidence
- Multi-company/two-user RLS and multi-table isolation: PASS.
- Private Storage tenant isolation: PASS.
- Platform Admin / Company Admin / read-only Support separation: PASS.
- Company suspend/reactivate: PASS.
- New Company lifecycle/standard chart initialization: PASS.
- Journal Draft → Posted → Reversed: PASS.
- Invoice Draft → Posted → Reversed: PASS after reversal-link fix.
- Reversed invoice linkage: 4/4 valid; invalid/missing reversal links = 0.
- Reports, money unit and fiscal-period RPC smoke tests: PASS.
- Ledger totals: debit = credit = 201101351.
- Orphan journal lines = 0.
- Unbalanced Posted/Reversed = 0.
- public SECURITY DEFINER executable by authenticated = 0.
- No new Security Advisor warning after DDL fix.

## Relevant files
- `avan-staging/RC1_3_D_LIVE_GATE.md`
- `avan-staging/APPLIED_RC13_D_INVOICE_REVERSAL_INTEGRITY_FIX.sql`

## Relevant commits
- Invoice reversal integrity fix: `99c3ee7b7d21a8de003026081e350d41a852af89`
- Minimal Live Gate: `7b0e40fa5f5255dd3566edf5f5b3c39e9ce4de16`

## PASS phrase
After the remaining visual/browser checks pass:

`Gate RC1.3-D پاس شد`

Then move directly to RC1.3-RC Feature Freeze. Do not start new feature work before the freeze/promotion gate.