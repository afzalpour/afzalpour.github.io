# RC1.5-C — Tax UX & VAT Reporting Gate Evidence

Status: **BACKEND PASS / FRONTEND ENGINEERING READY / LIVE GATE PENDING**  
Date: **2026-09-08**  
Governing ADR: `docs/adr/0007-versioned-tax-rules.md`

## Scope

RC1.5-C adds explicit Company tax configuration UX, item/invoice tax-profile UX, VAT snapshot visibility, and period-correct VAT reporting. Tax activation remains explicit and human-controlled.

## Applied database contract

Migration:
- `20260907214750 — rc1_5_c_tax_ux_reporting_contract`
- Evidence SQL: `APPLIED_RC1_5_C_TAX_UX_REPORTING_CONTRACT.sql`

Key changes:
- Historical invoice-line tax snapshot metadata: treatment/code/Persian profile name.
- `private.apply_invoice_tax_snapshot` preserves the profile/rule/rate/base/tax snapshot.
- Company tax configuration writes restricted to owner/manager.
- Browser `TRUNCATE/REFERENCES/TRIGGER` privileges removed from tax configuration tables where not required.
- `public.set_workspace_tax_settings(...)` = `SECURITY INVOKER`, authenticated-only execution.
- `public.report_vat_transactions(...)` = `SECURITY INVOKER`, authenticated-only execution.
- Reversal events are reported as negative amounts on the reversal journal date.

## Transactional backend rehearsal

The authenticated rehearsal was executed inside a transaction and rolled back completely.

Verified:
- Accountant cannot update Company tax settings.
- Owner can enable tax inside the rehearsal transaction.
- Standard profile: taxable base `10,005` Toman at `10%` => VAT `1,001` Toman, proving deterministic `.5` rounding.
- Exempt and zero-rate lines produce zero VAT.
- Sale report on invoice date: `+1,001` Toman VAT.
- Reversal report on reversal date: `-1,001` Toman VAT.
- Combined invoice+reversal period net: `0`.
- No rehearsal data retained after rollback.

## Frontend engineering

Staging runtime includes:
- `rc15-tax-ux.css`
- `rc15-tax-ux-v3.js`
- `src/domains/tax/vat-calculator.js`
- `src/application/tax/tax-service.js`
- `src/ui/tax/tax-workspace.js`

Implemented UX:
- Settings: tax enabled/disabled status, effective rule/rate, taxpayer metadata, explicit activation confirmation.
- Item form: default tax profile.
- Invoice rows: tax profile selection/defaulting and required-profile guard when tax is enabled.
- Live invoice totals: subtotal, VAT, final total in integer Toman.
- Posted invoice detail: profile/rate/taxable base/tax amount snapshot.
- VAT report: output VAT, input VAT, net period, invoice/reversal event rows.
- Existing unified print/export can include the rendered tax detail/report.
- All newly mapped tax errors have Persian user-facing messages.

## Architecture consolidation coupled to this gate

RC1.5-C is being finalized together with AC-1 architecture consolidation to prevent further patch-on-patch growth.

Quality gate:
- Syntax checks: PASS.
- Operation Pipeline unit test: PASS.
- VAT calculator unit test: PASS.
- Architecture audit: PASS.
- Unauthorized direct client method overwrites: `0`.
- One legacy settlement bridge remains explicitly quarantined and allowlisted until the integrated tax+settlement migration; any new overwrite fails CI.

See: `ARCHITECTURE_CONSOLIDATION_GATE_EVIDENCE.md`.

## Performance hardening

Applied migration:
- `rc1_5_performance_hot_path_indexes`
- Evidence SQL: `APPLIED_RC1_5_PERFORMANCE_HOT_PATH_INDEXES.sql`

Added targeted indexes for real Avan hot paths / important FK relationships, including Company parties, financial transaction ordering, document linkage, account roles, reversal linkage and tax settings.

The duplicate permissive `account_roles_select` policy was removed because `account_roles_access` already provides the same SELECT predicate through its `FOR ALL` policy.

Post-migration Performance Advisor no longer reports the duplicate permissive-policy warning and no longer reports the targeted FK gaps. Newly-created indexes may initially appear as `unused` until normal workload exercises them; they were not removed immediately.

## Post-gate database integrity

Verified after C and performance hardening:
- Ledger debit: `4,073,481,351` Toman.
- Ledger credit: `4,073,481,351` Toman.
- Orphan journal lines: `0`.
- Unbalanced Posted/Reversed journals: `0`.
- Companies with tax enabled: `0`.
- Public `SECURITY DEFINER` functions executable by authenticated: `0`.
- Dangerous authenticated tax-table privileges (`TRUNCATE/REFERENCES/TRIGGER`): `0`.
- Both public C tax APIs are `SECURITY INVOKER`; `anon`/`PUBLIC` cannot execute them.

## Security Advisor

No RC1.5-C security regression found.

Known notices remain:
- private deny-by-default tables with RLS and no direct policies (intentional internal boundary).
- `public.workspace_invitations` deny-by-default/helper-mediated state.
- `auth_leaked_password_protection` warning: provider feature is not available on the current zero-charge Supabase path; application compensating controls remain required.

## Activation state

**Tax remains disabled for every current Company.**

RC1.5-C does not reclassify historical invoices or silently activate VAT. Activation must be an explicit owner/manager action.

## Gate conclusion

Engineering status: **READY FOR STAGING LIVE TEST**.

This document does **not** claim Live PASS. Live acceptance requires explicit user confirmation after browser/PWA testing.
