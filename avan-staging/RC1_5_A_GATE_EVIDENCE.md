# RC1.5-A — Versioned Tax Data Foundation — Engineering Gate Evidence

Status: **BACKEND PASS**

Date: 2026-09-08

## Applied migrations
- `rc1_5_a_versioned_tax_foundation`
- `rc1_5_a_tax_defaults_1405`

## Rehearsal / integrity results
- DDL rehearsal executed inside transaction and rolled back before permanent migration.
- 1405 general VAT effective-date lookup returned exactly one active rule at 10%.
- legacy invoice lines with tax snapshot fields populated = 0.
- item tax profiles automatically assigned to legacy items = 0.
- Ledger during/after Gate A = `4,073,481,351 = 4,073,481,351` Toman.
- unbalanced journal entries = 0.

## RLS rehearsal
Authenticated user test with a pair of Companies where the user has membership in only one:
- own Company tax profile visible = 1.
- other Company tax profile visible = 0.
- global read-only tax rule visible = 1.
- rehearsal data rolled back.

## Permanent baseline after migration
- tax rule versions = 1.
- workspace tax settings = 6.
- tax profiles = 18 (3 per Company).
- tax is disabled by default for all Companies until configured/activated.
- standard profiles: 1405 general 10%, exempt 0%, zero-rate 0%.
- public SECURITY DEFINER executable by authenticated = 0.

## Historical safety
- no existing invoice/item was silently reclassified.
- no historical Ledger values were rewritten.
- invoice tax snapshot columns are nullable for legacy rows.

## Next gate
RC1.5-B — VAT calculation + invoice accounting bridge, including deterministic integer-Toman rounding, tax payable/receivable roles and reversal integrity.
