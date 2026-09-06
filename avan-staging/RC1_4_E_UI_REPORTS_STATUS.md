# Avan — RC1.4-E Inventory UI & Reports Status

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**CODE COMPLETE / STATIC PASS / BACKEND ENABLED / LIVE GATE PENDING**

The RC1.4 transactional backend is now enabled by RC1.4-M on the connected Supabase project. Production frontend/root has not been promoted or modified. No permanent inventory test rows were retained.

## Frontend artifacts
- `rc14-inventory-foundation.js` / `.css` — existing master data UI retained.
- `rc14-inventory-operations.js` — documents, lifecycle and reports UI.
- `rc14-inventory-operations.css` — responsive desktop/mobile layout.
- `rc14-invoice-inventory-ui.js` — stock-aware invoice companion and RPC bridge.
- `index.html` — loads RC1.4-E assets after the foundation.
- `sw.js` — Staging cache remains `avan-staging-rc1-v51`.

## Inventory navigation
The existing `کالا و انبار` page is extended, not replaced. It has three sub-sections:
1. کالاها و انبارها — master data foundation.
2. اسناد انبار — receipt, issue, transfer, adjustment and opening drafts; post/reverse/details.
3. گزارش‌ها — valuation, moving average, low-stock alerts, Ledger reconciliation and item movement card.

## Backend activation
RC1.4-E remains schema-aware, but the required backend schema is now present after the successful RC1.4-M migration.

Expected active Staging behavior now:
- item/unit/warehouse master data remains usable;
- inventory documents and reports use the live RC1.4 backend;
- stock-aware invoice metadata is accepted by the existing `save_draft_invoice` contract;
- service/non-inventory invoice lines remain stock-neutral and backward-compatible;
- atomic stock-aware invoice reversal uses `reverse_invoice`.

The former pre-migration preparation notice should no longer be shown once the refreshed Staging client sees the reloaded PostgREST schema.

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

With the D backend now active:
- stock-aware sale line: item + base unit + source warehouse.
- stock-aware purchase line: item + base unit + exact Posted receipt line.
- line metadata is appended to the existing `save_draft_invoice` RPC payload.
- invoice reversal requests from the old UI are redirected to atomic `reverse_invoice`.
- item quantities above the legacy 3-decimal UI path use the guarded 6-decimal submit path.
- service/non-inventory lines remain stock-neutral.

## Static checks
- `rc14-inventory-operations.js`: `node --check` PASS before repository write.
- `rc14-invoice-inventory-ui.js`: `node --check` PASS before repository write.
- a DOM binding defect found during static review was fixed to explicit `querySelector` bindings before Gate closure.
- `app.js` was not modified by RC1.4-E.
- Auth/session files were not modified by RC1.4-E.

## Backend verification from RC1.4-M
- backend migration: PASS.
- transaction-scoped weighted-average / issue / transfer / reversal regression: PASS.
- six-decimal stock-aware sale: PASS.
- atomic sale reversal: PASS.
- matched purchase GRNI/AP flow: PASS.
- duplicate receipt guard: PASS.
- purchase reversal: PASS.
- Inventory ↔ Financial Ledger reconciliation: PASS.
- authenticated RLS isolation and Posted immutability: PASS.
- public authenticated SECURITY DEFINER functions: 0.
- final financial baseline: Debit = Credit = `201581351` canonical Toman.

See `RC1_4_M_STATUS.md` and `RC1_4_M_BACKEND_MIGRATION_MANIFEST.sql` for the migration and regression evidence.

## Next gate
**RC1.4-L — Live Staging Inventory Acceptance**

Only browser-facing acceptance remains before any later release decision:
1. inventory page/tabs activate without the old backend-pending notice;
2. create an inventory item and post a receipt; stock/report must update;
3. post one stock-aware sale and reverse it; stock and invoice status must restore correctly;
4. verify inventory tabs and document modal on iPhone/mobile.

Production frontend promotion remains a later explicit release gate.