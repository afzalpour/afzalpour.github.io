# Avan — RC1.4-E Inventory UI & Reports Status

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**CODE COMPLETE / STATIC PASS / BACKEND MIGRATION + LIVE GATE PENDING**

Production RC1.3 remains unchanged. No RC1.4 transactional table, inventory account role, invoice precision migration, or permanent inventory test data has been applied to the Production database.

## Frontend artifacts
- `rc14-inventory-foundation.js` / `.css` — existing master data UI retained.
- `rc14-inventory-operations.js` — documents, lifecycle and reports UI.
- `rc14-inventory-operations.css` — responsive desktop/mobile layout.
- `rc14-invoice-inventory-ui.js` — stock-aware invoice companion and safe RPC bridge.
- `index.html` — loads RC1.4-E assets after the foundation.
- `sw.js` — staging cache bumped to `avan-staging-rc1-v51`.

## Inventory navigation
The existing `کالا و انبار` page is extended, not replaced. It now has three sub-sections:
1. کالاها و انبارها — existing master data foundation.
2. اسناد انبار — receipt, issue, transfer, adjustment and opening drafts; post/reverse/details when backend is available.
3. گزارش‌ها — valuation, moving average, low-stock alerts, Ledger reconciliation and item movement card.

## Schema-aware staging behavior
A–D backend candidates are intentionally not yet migrated to Production. RC1.4-E probes for the transactional schema before using it.

Until migration:
- current item/unit/warehouse master data remains usable;
- existing service/non-inventory invoice behavior remains usable;
- transactional inventory tabs show an explicit preparation notice instead of surfacing REST/schema errors;
- invoice inventory metadata is not sent to the legacy backend.

After migration the same UI activates without a separate frontend rewrite.

## Inventory document UI
Implemented:
- Draft document creation.
- Multiple lines.
- item selection.
- quantity precision driven by the item's base unit (up to 6 decimals).
- receipt/opening destination warehouse.
- issue source warehouse.
- transfer source + destination warehouse.
- positive/negative adjustment direction.
- inbound unit cost.
- Draft delete.
- Post via `post_inventory_document`.
- exact reversal via `reverse_inventory_document`.
- detail view with generated movements.

The browser does not calculate canonical stock value for posting. Persisted quantity/cost values are sent as decimal strings; authoritative weighted-average cost and financial posting remain server-side.

## Reports UI
Implemented:
- stock by item / warehouse.
- moving weighted-average unit cost.
- canonical integer-Toman inventory value.
- sub-Toman rounding delta visibility.
- low-stock comparison against item minimum.
- Inventory ↔ Financial Ledger reconciliation status.
- item movement card ordered by immutable posting sequence.

## Invoice integration UI
The existing invoice modal is augmented rather than rewritten.

When the D backend exists:
- stock-aware sale line: item + base unit + source warehouse.
- stock-aware purchase line: item + base unit + exact Posted receipt line.
- line metadata is appended to the existing `save_draft_invoice` RPC payload.
- invoice reversal requests from the old UI are redirected to atomic `reverse_invoice` when the D schema is present.
- item quantities above the legacy 3-decimal UI path use a guarded 6-decimal submit path only after the D schema is detected.
- service/non-inventory lines remain stock-neutral.

When the D backend is absent, all of the above degrades safely to the existing RC1.3 invoice flow.

## Static checks
- locally-authored `rc14-inventory-operations.js`: `node --check` PASS before repository write.
- locally-authored `rc14-invoice-inventory-ui.js`: `node --check` PASS before repository write.
- a DOM binding defect found during static review (`div.name` assumptions for document-line controls) was fixed to explicit `querySelector` bindings before Gate closure.
- `app.js` was not modified by RC1.4-E.
- Auth/session files were not modified by RC1.4-E.

## Production baseline after RC1.4-E code work
- Journal entries: 30
- Journal lines: 67
- Debit = Credit = 201581351 canonical Toman
- Inventory items: 0
- RC1.4 transactional Production tables: 0
- Production `invoice_lines.quantity` scale: 3

This confirms that RC1.4-E frontend development did not silently migrate the Production database.

## Next gate
**RC1.4-M — Backend Migration / Staging Enablement Gate**

Before user Live testing:
1. consolidate A/B/C/C1/D/D0/D1 into one reviewed migration order;
2. run one final transaction rehearsal against current Production baseline;
3. apply the additive/hardening migration to the connected Supabase project only after migration-gate checks are green;
4. run Security Advisors and server regression immediately after migration;
5. activate and test the RC1.4-E Staging UI against the migrated backend;
6. request only the minimal user Live Gate for inventory workflows and iPhone layout;
7. Production frontend promotion remains a later explicit release gate.