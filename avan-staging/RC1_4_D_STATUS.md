# Avan — RC1.4-D Sales/Purchase Inventory Integration Status

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**TRANSACTIONAL PASS / NOT APPLIED TO PRODUCTION**

Production RC1.3 remains unchanged. RC1.4-D is repository-only plus transaction-scoped database rehearsals.

## Candidate artifacts
- `RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`
- `RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql`
- `RC1_4_C_WEIGHTED_AVERAGE_LEDGER_BRIDGE_DRAFT.sql`
- `RC1_4_C1_WEIGHTED_AVERAGE_HARDENING.sql`
- `RC1_4_D0_INVOICE_QUANTITY_PRECISION.sql`
- `RC1_4_D_SALES_PURCHASE_INVENTORY_INTEGRATION_DRAFT.sql`
- `RC1_4_D1_INVOICE_INVENTORY_HARDENING.sql`

## Integration model
### Stock sale
A stock-aware sales invoice line carries:
- `item_id`
- base `unit_id`
- source `warehouse_id`

Posting creates a linked Inventory Issue in the same transaction.

Accounting remains separated and auditable:
1. Sales invoice journal: Receivable / Revenue (+ Sales Discount where applicable).
2. Linked Inventory Issue journal: COGS / Inventory.

If either side fails, the whole database call rolls back.

### Stock purchase
A stock-aware purchase invoice line carries:
- `item_id`
- base `unit_id`
- `receipt_line_id`

Goods must already have a Posted Inventory Receipt.

Receipt accounting:
- Dr Inventory
- Cr GRNI (`کالای دریافت‌شده فاکتورنشده`)

Supplier invoice accounting for the matched stock line:
- Dr GRNI
- Cr Accounts Payable

Therefore the supplier invoice does **not** debit Inventory a second time.

Current RC1.4-D contract intentionally requires the invoice stock-line value to equal the rounded Receipt value. Purchase-price variance handling is deferred to a later extension rather than silently altering inventory value.

## Reversal contract
New `public.reverse_invoice(...)` is the authoritative reversal API for stock-aware invoices.

### Stock sale reversal
1. exact Inventory Issue reversal;
2. exact COGS/Inventory journal reversal;
3. sales invoice financial journal reversal;
4. invoice links both reversal journal and reversal inventory document.

Direct reversal of the sales financial journal while its linked Inventory document is still Posted is rejected with:
`INVOICE_INVENTORY_REVERSAL_REQUIRED`.

### Purchase invoice reversal
The Goods Receipt is **not** reversed.

Only the AP/GRNI financial invoice is reversed, restoring GRNI as an unmatched received-goods liability. Stock quantity/value stays unchanged.

## Backward compatibility
Existing public signatures are preserved:
- `public.save_draft_invoice(...)`
- `public.post_invoice(uuid)`

The line JSON simply accepts optional stock metadata keys. Service/non-inventory/legacy lines remain stock-neutral and retain existing financial behavior.

## Six-decimal quantity precision issue found and fixed
The first D rehearsal correctly failed on a test quantity `0.123456`.

Root cause:
- legacy helper used `numeric(20,3)`, **and**
- physical `public.invoice_lines.quantity` was also `numeric(20,3)`.

Fix candidate:
- widen the column losslessly to `numeric(20,6)` (`RC1_4_D0_INVOICE_QUANTITY_PRECISION.sql`);
- D1 wrapper validates quantity against the selected base unit's `decimal_places` and restores exact item quantity after legacy financial validation;
- item line totals and invoice total are recomputed at the canonical integer-Toman boundary.

Second full rehearsal then PASSed.

## Transactional integration rehearsal — PASS
Validated in one transaction and rolled back:
1. Created a test unit supporting 6 decimal places.
2. Receipt `10.123456` units @ 100 Toman.
3. Sales invoice issued `0.123456` units.
   - exact six-decimal invoice quantity retained;
   - deterministic invoice line total = 37 Toman;
   - linked Inventory Issue created;
   - stock became exactly 10 units.
4. Direct financial-only sales reversal attempt was blocked.
   - invoice remained Posted;
   - Inventory Issue remained linked/consistent.
5. `reverse_invoice` successfully reversed both financial + inventory sides.
   - stock restored to `10.123456`;
   - invoice became Reversed;
   - reversal inventory link populated.
6. Posted a second Receipt: 5 units @ 200 Toman.
   - stock became `15.123456`.
7. Posted linked purchase invoice.
   - purchase line was mapped to GRNI;
   - Dr GRNI = 1000;
   - Cr AP = 1000;
   - stock remained exactly `15.123456` (no double count).
8. Attempted to post a second purchase invoice against the same Posted Receipt line.
   - rejected with `PURCHASE_RECEIPT_ALREADY_INVOICED`;
   - failed duplicate invoice remained Draft.
9. Reversed the purchase invoice.
   - original Receipt remained Posted;
   - stock remained unchanged;
   - no inventory reversal document was linked to the purchase invoice.

## Security / bypass hardening rehearsal — PASS
D1 narrows old private invoice implementations to internal use:
- authenticated direct execute on legacy `private.save_draft_invoice(...)` = blocked;
- authenticated direct execute on legacy `private.post_invoice(uuid)` = blocked;
- authenticated direct execute on `public.sync_invoice_status_from_journal()` trigger function = blocked;
- public `save_draft_invoice` / `post_invoice` remain SECURITY INVOKER wrappers.

Privilege assertions PASSed transactionally and were rolled back.

## Production rollback verification
After all rehearsals:
- RC1.4 new Production tables = 0
- Production inventory items = 0
- Inventory account roles = 0
- Journal entries = 30
- Journal lines = 67
- Debit = Credit = `201581351` canonical Toman
- Production `invoice_lines.quantity` remains `numeric(20,3)` until an explicit RC1.4 migration gate.

## Next phase
**RC1.4-E — Inventory UI + Reports**

Planned user-facing scope:
- کالاها / خدمات
- واحدهای اندازه‌گیری
- انبارها
- رسید، حواله، انتقال، تعدیل
- stock-aware sales/purchase invoice lines
- کارت کالا
- موجودی به تفکیک انبار
- ارزش موجودی و میانگین موزون
- گردش کالا
- کمبود موجودی / حداقل موجودی
- inventory-financial reconciliation visibility

No RC1.4 schema or frontend code is promoted to Production before its own regression + Live Gate + explicit Production promotion approval.
