# Avan — RC1.4-M Backend Migration / Staging Enablement Status

Date: 2026-09-06
Branch: `rc1-4-inventory`
Supabase project: `dkyqsxnllvxypigxpygo`

## Status
**BACKEND MIGRATION PASS / SERVER REGRESSION PASS / LIVE UI GATE PENDING**

The Production frontend/root was not promoted or modified by this Gate. The connected Supabase backend is now additively RC1.4-enabled and remains backward-compatible with the existing frontend contracts.

## Applied migrations
1. `rc1_4_m_inventory_backend_enablement`
2. `rc1_4_m_inventory_fk_index_hardening`

PostgREST schema cache was explicitly reloaded after the DDL.

## Source integrity
The main migration executed the seven reviewed RC1.4 candidates in dependency order from immutable GitHub commit:
`50161dbcaceeab63862d6e9ebc3d0a6765c892b0`

Each fetched file was required to return HTTP 200 and match its pinned SHA-256 before execution:

1. `RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`
   `e72c65c49b6b18af1174031fa65edebf4d1d2d6f63d91ab7490608a84dc19e2d`
2. `RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql`
   `bd98d2bab7db259a0cbab5577be323e1a299be0fc4ab43fd82812f8b87f7cf59`
3. `RC1_4_C_WEIGHTED_AVERAGE_LEDGER_BRIDGE_DRAFT.sql`
   `4bb9a7e9d4647caf451f14a3ae1d3aa0bfb93e4ba67d715f92f6ee5caa60cfa4`
4. `RC1_4_C1_WEIGHTED_AVERAGE_HARDENING.sql`
   `65d084653cad31f8cb93a8a3722dc514b69f028ad999f307de1a2874c3af4cbc`
5. `RC1_4_D0_INVOICE_QUANTITY_PRECISION.sql`
   `a83543e1b9affff74890b7e5fa8e56f885b412fd7e7ea2b71c9620420df83466`
6. `RC1_4_D_SALES_PURCHASE_INVENTORY_INTEGRATION_DRAFT.sql`
   `c2967a5de74e417a98b73b8cc84012e2ea062e7d24a66d2b0f892e533b0ed9f4`
7. `RC1_4_D1_INVOICE_INVENTORY_HARDENING.sql`
   `3daba75d77be3af6934c5def61239a41c18174df879b30d3eb9f2ea1336284c0`

The exact loader and follow-up index statements are retained in `RC1_4_M_BACKEND_MIGRATION_MANIFEST.sql`.
The temporary PostgreSQL `http` extension used only to fetch the immutable source was dropped before Gate completion.

## Final pre-apply rehearsal
All seven pinned SQL files were executed against the current Production schema inside a single transaction and rolled back.

PASS assertions after the temporary install:
- 6 Companies covered.
- 30 inventory account-role mappings = exactly 5 per Company.
- `invoice_lines.quantity` widened losslessly to scale 6.
- Journal entries remained 30.
- Journal lines remained 67.
- Debit = Credit = `201581351` canonical Toman.
- all three new public inventory transaction tables had RLS enabled.
- public SECURITY DEFINER functions executable by `authenticated` = 0.

A first rehearsal attempt stopped only in a test assertion using `GROUP BY null`, which PostgreSQL 17 rejects. The transaction rolled back completely; the assertion was corrected and the full rehearsal then passed. No migration defect was involved.

## Permanent backend result
Enabled:
- `public.inventory_documents`
- `public.inventory_document_lines`
- `public.inventory_movements`
- `public.inventory_on_hand`
- `public.inventory_valuation`
- `public.inventory_financial_reconciliation`
- six-decimal invoice quantity storage
- five standard inventory accounting roles per Company
- inventory-aware invoice save/post/reversal contracts

Public command RPCs remain SECURITY INVOKER wrappers. Privileged implementations remain in `private` and enforce Company financial-write authority.

## Transaction-scoped functional regression
The following complete workflow was executed against the migrated backend and rolled back:

1. Receipt 10 @ 100 Toman.
2. Receipt 10 @ 200 Toman.
3. Moving weighted average = 150.
4. Issue 5; stock/value = 15 / 2250; COGS = 750.
5. Exact issue reversal; stock/value restored to 20 / 3000.
6. Transfer 2 to a second warehouse and exact reversal.
7. Oversized issue blocked with `NEGATIVE_STOCK_FORBIDDEN`; Draft remained Draft and no movement leaked.
8. Six-decimal receipt `10.123456` units.
9. Stock sale `0.123456` units retained exact quantity and reduced stock to exactly 10.
10. Financial-only sale reversal blocked with `INVOICE_INVENTORY_REVERSAL_REQUIRED`.
11. Atomic `reverse_invoice` restored stock to `10.123456` and populated the inventory reversal link.
12. Second receipt 5 @ 200 raised stock to `15.123456`.
13. Matched purchase invoice posted Dr GRNI 1000 / Cr AP 1000 without increasing stock again.
14. A second purchase invoice against the same receipt line was blocked with `PURCHASE_RECEIPT_ALREADY_INVOICED` and remained Draft.
15. Purchase invoice reversal left the original receipt and stock unchanged.
16. Inventory ↔ Financial Ledger reconciliation passed.
17. Generated Posted/Reversed journals remained balanced.

No permanent regression test data was retained.

## RLS / immutability regression
A separate authenticated-role transaction proved:
- own Company inventory documents visible;
- foreign Company inventory documents hidden;
- direct UPDATE against a Posted inventory document matched zero rows;
- browser role has no direct INSERT privilege on `inventory_movements`;
- required public inventory/invoice RPC surface is executable.

The RLS test data was rolled back.

## Security Advisor
After both DDL migrations:
- no new RC1.4 security WARN/ERROR;
- `private.inventory_document_number_sequences` reports RLS-with-no-policy INFO intentionally because the private table is deny-by-default and direct browser access is revoked;
- existing private/platform deny-by-default INFO notices remain;
- the existing `auth_leaked_password_protection` WARN remains unavailable on the current Free plan and is not falsely marked fixed.

## Performance hardening
The first post-migration advisor run identified RC1.4 foreign keys without covering indexes. `rc1_4_m_inventory_fk_index_hardening` added covering/partial indexes for:
- inventory document/warehouse links;
- inventory journal link;
- movement line/reversal/warehouse links;
- invoice unit/warehouse links.

A second advisor run no longer reports those RC1.4 unindexed-FK findings. Fresh indexes may appear as unused until real inventory traffic exists; they are intentionally retained.

## Final Production database baseline after RC1.4-M
- Inventory items: 0
- Inventory documents: 0
- Inventory document lines: 0
- Inventory movements: 0
- Inventory account roles: 30
- `invoice_lines.quantity` scale: 6
- Journal entries: 30
- Journal lines: 67
- Debit = Credit = `201581351`
- public authenticated SECURITY DEFINER functions: 0
- RC1.4 transaction tables with RLS: 3/3
- temporary `http` extension installed: no

## Frontend state
RC1.4-E assets already exist on Staging and are schema-aware. With the backend now present, their transaction/report paths should activate without another frontend rewrite.

No frontend asset changed during RC1.4-M, so the Staging service-worker cache remains `avan-staging-rc1-v51`.

## Next gate
**RC1.4-L — Live Staging Inventory Acceptance**

User acceptance is still required for the browser-facing inventory workflows and mobile layout. No Production frontend promotion occurs until a later explicit release gate.