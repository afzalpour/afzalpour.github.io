# AVAN — Production Release RC1.4

Release status: **Production Released**

Release date: **2026-09-08**

## Runtime
- Production commit: `81b5c54643267842a8f225ee09668ade2fc95052`
- Production URL: `https://afzalpour.github.io/`
- GitHub Pages run: `34141884953` — completed / success
- Production Service Worker cache: `avan-prod-rc1-4-v1`
- Rollback branch: `prod-backup-20260907-rc1-4-pre`
- Production-specific config/auth redirect were preserved.

## Promoted scope
- Inventory / warehouse movement ledger and weighted-average costing.
- Inventory receipt / issue / transfer / adjustment / opening lifecycle.
- Inventory ↔ financial Ledger reconciliation.
- Sales inventory issue + COGS and reversal.
- Purchase receipt → GRNI → AP bridge without duplicate stock receipt.
- Product grouping: Group → Subgroup → Model/Family → operational SKU.
- Four-level chart hierarchy: کل / معین / تفصیلی ۱ / تفصیلی ۲.
- Invoice settlement: credit / cash / cheque / installment / mixed.
- Financial cheque lifecycle and settlement reversal.
- Persian-only user-visible error/terminology policy.
- Jalali inventory dates, currency labels in reports/prints, company branding.
- Live thousands grouping for settlement money inputs.

## Final readiness baseline
- Ledger debit = credit = `4,073,481,351` Toman.
- unbalanced Posted/Reversed journals = 0.
- orphan journal lines = 0.
- postable accounts with active children = 0.
- public SECURITY DEFINER executable by authenticated = 0.
- all 6 Companies reconciled for Inventory ↔ Ledger.
- active Company inventory value = `1,123,500,000`; difference = 0.
- active Company COGS = `32,500,000`; difference = 0.
- settlement plan mismatches = 0.
- orphan schedules/checks = 0.
- duplicate cheque identities under current identity rule = 0.

## Security / free-only constraints
- zero-charge policy remains binding.
- Supabase Leaked Password Protection remains unavailable under current Free plan and is not falsely marked fixed.
- free application password controls remain compensating controls.
- full external isolated restore remains OPEN because no genuinely free isolated restore target is currently available.

## Next cycle
RC1.5 starts in Staging under ADR-0007:
**Tax / VAT / e-invoicing with versioned, date-effective rules and human-controlled external submission.**
