# Avan — RC1.4-B Inventory Posting Engine Status

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**B1 Posting Engine candidate: TRANSACTIONAL PASS / NOT APPLIED TO PRODUCTION**

Production RC1.3 remains unchanged. No RC1.4 table, RPC, trigger or test row was committed to the Production database.

## Candidate artifacts
- `avan-staging/RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`
- `avan-staging/RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql`

## Architecture validated
- Existing Production foundation is reused: inventory units, items, settings and warehouses.
- New stock state is movement-ledger derived; there is no editable `current_stock` field.
- Public posting/reversal RPCs are SECURITY INVOKER wrappers.
- Privileged implementations remain in `private` and check authenticated Company financial-write authority.
- New browser tables use explicit Data API grants plus RLS instead of relying on Supabase default grants.
- Posted inventory movements are append-only/immutable.
- Company identity is enforced again at composite FK boundaries, not only through RLS.
- Posting locks the full affected item/warehouse set in deterministic advisory-lock order.

## Transactional lifecycle test — PASS
All operations below ran inside a transaction and were rolled back.

1. Receipt: 10 units @ 100 Toman.
   - on-hand = 10
   - inventory value = 1000
2. Issue: 4 units.
   - weighted outgoing cost resolved to 100
   - on-hand = 6
   - inventory value = 600
3. Transfer: 2 units from warehouse A to warehouse B.
   - source on-hand = 4
   - destination on-hand = 2
4. Exact transfer reversal.
   - source restored to 6
   - destination restored to 0
   - both generated reversal movements linked to their source movements
5. Negative-stock protection.
   - attempted issue of 999 with company policy disallowing negative stock
   - rejected with `NEGATIVE_STOCK_FORBIDDEN`
   - source draft remained Draft
   - no movement leaked from the failed post

## Immutability / boundary tests — PASS
- Browser UPDATE against a Posted inventory document matched 0 rows under RLS.
- Direct privileged mutation of a Posted document was blocked by trigger.
- Direct privileged mutation of a line under a Posted document was blocked by trigger.
- Direct privileged UPDATE of a movement was blocked by the movement immutability trigger.
- A deliberately cross-Company warehouse reference was rejected by the composite FK even when RLS was bypassed for the DB-level test.

## Test-correction notes
Two test-harness assumptions were corrected during validation:
- Posted browser UPDATE is stopped by RLS before the immutability trigger, so the expected result is 0 updated rows, not an exception.
- Cross-Company browser insertion is stopped by RLS before the FK; a separate DB-owner test was therefore used to prove the FK independently.

These were test expectation corrections, not Posting Engine defects.

## Production post-test baseline
After rollback:
- RC1.4 new tables in Production: absent
- RC1.4 public posting RPC in Production: absent
- Production inventory items: 0
- Journal entries: 30
- Journal lines: 67
- Debit = Credit = 201581351 canonical Toman
- Orphan journal lines: 0

## Still open before RC1.4 can be released
RC1.4-B1 is not a Production gate. The following remain:
1. Apply schema/engine only after the next RC migration gate is reached.
2. Add postable inventory and COGS account roles under the standard chart.
3. Build the exact Inventory ↔ Financial Ledger bridge.
4. Integrate sales/purchase invoice lines with inventory movements.
5. Add UI and inventory reports.
6. Run full multi-user RLS/regression and a user Live Gate before any Production promotion.
