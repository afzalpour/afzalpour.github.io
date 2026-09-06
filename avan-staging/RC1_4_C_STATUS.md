# Avan — RC1.4-C Moving Weighted Average + Ledger Bridge Status

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**TRANSACTIONAL PASS / NOT APPLIED TO PRODUCTION**

Production RC1.3 remains unchanged. RC1.4-C exists only as repository candidates and transaction-scoped rehearsals.

## Candidate artifacts
- `RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`
- `RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql`
- `RC1_4_C_WEIGHTED_AVERAGE_LEDGER_BRIDGE_DRAFT.sql`
- `RC1_4_C1_WEIGHTED_AVERAGE_HARDENING.sql`

## Accounting model
Dedicated postable inventory control accounts are provisioned below the existing standard level-2 headings:
- `1301` — موجودی کالا (`inventory_asset`)
- `5201` — بهای تمام‌شده کالای فروش‌رفته (`inventory_cogs`)
- `2251` — کالای دریافت‌شده فاکتورنشده / GRNI (`inventory_grni`)
- `4251` — سود تعدیل موجودی (`inventory_adjustment_gain`)
- `5701` — زیان تعدیل موجودی (`inventory_adjustment_loss`)

Mappings:
- Opening: Dr Inventory / Cr Opening Equity
- Receipt: Dr Inventory / Cr GRNI
- Issue: Dr COGS / Cr Inventory
- Positive adjustment: Dr Inventory / Cr Adjustment Gain
- Negative adjustment: Dr Adjustment Loss / Cr Inventory
- Transfer: no financial journal

## Canonical Toman boundary
Inventory quantities and unit costs retain numeric precision. Financial journal amounts remain canonical integer Toman.

For exact reconciliation at the financial boundary:
- movement economic value = `quantity_delta * unit_cost` with decimal precision;
- Ledger control value = `round(value_delta, 0)` per immutable movement;
- reconciliation explicitly reports sub-Toman rounding delta instead of hiding it.

## Transactional weighted-average test — PASS
Scenario:
1. Receipt 10 units @ 100 Toman.
2. Receipt 10 units @ 200 Toman.
3. Moving weighted average resolved to exactly **150**.
4. Issue 5 units used cost **150**.
5. After issue:
   - quantity on hand = 15
   - inventory value = 2250
   - COGS = 750
6. Exact issue reversal:
   - movement inventory value restored to 3000
   - Inventory control Ledger balance = 3000
   - COGS Ledger balance = 0
   - Inventory reconciliation = PASS
   - COGS reversal reconciliation = PASS

All financial journals generated during the rehearsal were Posted through the existing hardened journal engine and rolled back with the transaction.

## Hardening discovered during test
A first role-validation assumption was intentionally rejected during testing: category + normal balance alone is insufficient because, for example, Cash is also an active postable debit Asset.

C1 therefore requires both:
- correct category/normal balance, and
- correct standard parent heading (`130`, `520`, `225`, `425`, `570`).

The corrected guard passed: attempting to map `inventory_asset` to Cash was rejected.

## Chronology hardening — PASS
Moving weighted average is posting-order sensitive. RC1.4-C1 blocks a movement dated earlier than the latest already-posted movement for the same Company/item/warehouse state.

Test:
- movement dated 2026-09-06 inserted;
- movement for same state dated 2026-09-05 rejected with `INVENTORY_BACKDATED_POSTING_FORBIDDEN`;
- another movement dated 2026-09-06 accepted.

This avoids silently recosting later perpetual-inventory movements. Same-day posting remains deterministic through posting sequence.

## Supabase compatibility note
RC1.4 continues to use explicit Data API grants plus RLS for new public tables because current Supabase platform changes are moving existing projects toward explicit table/function exposure. Views use `security_invoker = true`.

## Production rollback verification
After all rehearsals:
- RC1.4 new Production tables = 0
- Inventory role accounts = 0
- Inventory account roles = 0
- Journal entries = 30
- Journal lines = 67
- Debit = Credit = 201581351 canonical Toman

## Next phase
**RC1.4-D — Sales/Purchase Inventory Integration**

Next work:
1. invoice lines gain item/quantity/unit references where stock-affecting;
2. purchase invoice + receipt clears GRNI into Accounts Payable without double-counting inventory;
3. sales invoice posts Revenue/Receivable and stock issue posts COGS/Inventory atomically;
4. invoice reversal restores both financial and inventory links atomically;
5. service/non-inventory invoice lines remain stock-neutral;
6. full RLS/immutability/reconciliation regression before UI work.
