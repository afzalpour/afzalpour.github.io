# RC1.5-B — VAT Calculation & Invoice Accounting Bridge — Engineering Gate Evidence

Status: **BACKEND PASS**

Date: 2026-09-08

## Applied migrations
- `20260907211545 — rc1_5_b_vat_account_roles`
- `20260907212157 — rc1_5_b_vat_invoice_engine`

The migrations had already been applied to `Avan-production` when this gate resumed. Their exact applied statements were recovered from `supabase_migrations.schema_migrations` and recorded in this repository as:
- `APPLIED_RC1_5_B_VAT_ACCOUNT_ROLES.sql`
- `APPLIED_RC1_5_B_VAT_INVOICE_ENGINE.sql`

## Implemented backend contract
- Company-scoped account roles exist for both VAT directions:
  - `vat_output_payable`
  - `vat_input_receivable`
- all 6 current Companies have both VAT account roles.
- Draft invoice save applies a tax snapshot only when `workspace_tax_settings.tax_enabled = true`.
- tax-disabled Companies retain legacy-compatible invoice behavior.
- item tax profile is used when available; an explicit line tax profile is required otherwise.
- standard-rate profiles must reference an active rule version effective on the invoice date.
- exempt and zero-rate profiles calculate zero tax while preserving their profile snapshot.
- tax calculation is deterministic at the integer-Toman boundary: `round(line_total * rate / 100, 0)`.
- invoice totals are separated into `subtotal_amount`, `tax_total`, and final `total_amount`.
- posting verifies the stored snapshot totals before creating Ledger entries.
- Sale VAT posts to `vat_output_payable` (credit).
- Purchase VAT posts to `vat_input_receivable` (debit).
- invoice reversal reverses the VAT journal effect with the original financial journal.
- Posted/Reversed invoice immutability now explicitly covers `subtotal_amount` and `tax_total`.

## Transactional VAT / accounting rehearsal
A full authenticated-user rehearsal was executed inside a database transaction and rolled back.

### Sale test
Three invoice lines:
- standard 10% base = `10,005` Toman → VAT = `1,001` Toman (tests deterministic `.5` rounding).
- exempt base = `20,000` Toman → VAT = `0`.
- zero-rate base = `30,000` Toman → VAT = `0`.

Expected and observed:
- subtotal = `60,005`.
- tax total = `1,001`.
- invoice total = `61,006`.
- posted journal debit = credit = `61,006`.
- VAT output credit = `1,001`.
- reversal journal debit = credit = `61,006`.
- reversal VAT output debit = `1,001`.

### Purchase test
The same standard/exempt/zero-rate bases were exercised on a non-inventory purchase invoice.

Expected and observed:
- subtotal = `60,005`.
- tax total = `1,001`.
- invoice total = `61,006`.
- posted journal debit = credit = `61,006`.
- VAT input debit = `1,001`.
- reversal journal debit = credit = `61,006`.
- reversal VAT input credit = `1,001`.

Result: **PASS**.

The transaction was rolled back. No rehearsal invoices or Tax enablement changes remain.

## Global integrity after rehearsal
- Ledger debit = `4,073,481,351` Toman.
- Ledger credit = `4,073,481,351` Toman.
- orphan journal lines = `0`.
- unbalanced Posted/Reversed journals = `0`.
- Companies with Tax currently enabled = `0`.
- RC1.5-B rehearsal invoices left behind = `0`.
- `public SECURITY DEFINER` executable by `authenticated` = `0`.

## Security Advisor
No RC1.5-B security regression was introduced.

Standing notices remain outside this gate:
- INFO no-policy notices on deny-by-default/private boundaries, plus the existing `public.workspace_invitations` deny-by-default table.
- WARN `auth_leaked_password_protection` remains the known Free-plan provider limitation with existing application compensating controls.

## Compatibility / activation rule
RC1.5-B is backend-enabled but tax remains **disabled by default for all Companies**. Production RC1.4 invoice behavior therefore remains unchanged until a Company explicitly enables Tax through the RC1.5-C UX.

## Next gate
**RC1.5-C — Tax UX & reports**:
- Company Tax/VAT settings UI.
- product/service tax profile assignment.
- invoice line tax profile and visible VAT calculation.
- VAT sales/purchase reporting.
- Persian validation/error mapping.
