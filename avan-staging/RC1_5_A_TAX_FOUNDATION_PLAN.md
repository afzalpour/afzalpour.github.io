# RC1.5-A — Versioned Tax Data Foundation

Status: STARTED

## Objective
Create a tax/VAT foundation that preserves historical reproducibility and does not hard-code changing law into invoice UI/business logic.

## Invariants
- Tax rules are versioned and date-effective.
- Existing posted invoices remain reproducible from stored tax snapshots.
- Tax rates are stored as explicit decimal percentages; Ledger postings remain integer Toman.
- Company/RLS boundary applies to tax profiles/settings.
- Global rule catalog is read-only to normal authenticated users.
- External tax/e-invoice submission is adapter-based and Human-controlled.
- No paid dependency.
- User-visible validation/errors are fluent Persian.

## Initial data model
1. `tax_rule_versions`
   - legal/rule version metadata, effective dates, status, source metadata, versioned payload.
2. `workspace_tax_settings`
   - Company tax enablement and identifiers/settings; no secrets.
3. `tax_profiles`
   - Company-scoped taxable/exempt/zero/custom profiles for goods/services and purchase/sale applicability.
4. Invoice historical snapshot fields
   - tax profile/rate/taxable base/tax amount retained on invoice lines at save/post time.
5. Future submission state
   - designed for adapter/pre-validation lifecycle, but no external submission enabled in Gate A.

## Gate A acceptance
- schema + constraints + RLS pass.
- historical invoices remain unchanged.
- tax rule effective-date lookup deterministic.
- no cross-Company profile leakage.
- posted invoice immutability remains intact.
- Ledger baseline unchanged by migration.
