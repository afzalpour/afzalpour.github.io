# Avan — RC1.4-A Inventory Foundation Gate

Date: 2026-09-06

## Phase
**RC1.4 — Inventory / Warehouse / Costing**

RC1.4-A scope is the safe master-data foundation only. Stock movement ledger, valuation posting, invoice stock effects and COGS journal integration are intentionally deferred to the next gates.

## Backend — PASS
Applied migration: `rc1_4_a_inventory_foundation`
Evidence: `APPLIED_RC1_4_A_INVENTORY_FOUNDATION.sql`

Created Company-scoped tables:
- `public.inventory_units`
- `public.warehouses`
- `public.inventory_items`
- `public.inventory_settings`

Security/integrity:
- RLS enabled on all 4 tables.
- authenticated SELECT requires Company access.
- INSERT/UPDATE requires `owner`, `manager` or `accountant` Company role.
- direct DELETE is not granted to `authenticated`; master data uses active/inactive state.
- `anon` has no table access.
- composite `(workspace_id, base_unit_id)` FK blocks cross-Company unit references.
- private bootstrap helpers are not executable by `authenticated`.
- public SECURITY DEFINER executable by `authenticated` remains 0.

Existing Company bootstrap result:
- Workspaces: 6
- standard units: 42 = exactly 7 per Company
- default warehouses: 6 = exactly 1 per Company
- inventory settings: 6 = exactly 1 per Company
- inventory items at gate start: 0
- bad standard-unit seed Companies: 0
- bad default-warehouse Companies: 0

New-Company bootstrap test: **PASS**
- 7 standard units
- 1 default warehouse
- 1 inventory settings row
- cleanup/cascade PASS

Cross-Company composite-FK test: **PASS**

Authenticated RLS read test using a real Company owner:
- own units: 7
- foreign units: 0
- own warehouses: 1
- foreign warehouses: 0
- own settings: 1
- foreign settings: 0

Security Advisor after DDL:
- no new RC1.4 warning.
- existing intentional RLS/no-policy INFO notices remain unchanged.
- existing Free-plan Leaked Password Protection WARN remains unchanged.

## Default inventory policy
- costing method: **weighted average / میانگین موزون**
- negative stock: **disabled**
- quantity precision: 3 decimals
- standard units: عدد، کیلوگرم، گرم، متر، لیتر، بسته، کارتن
- default warehouse: `انبار اصلی`

The current standard chart already contains the raw/non-postable headings:
- `130 موجودی مواد و کالا`
- `520 بهای تمام‌شده کالا و خدمات`

RC1.4-A does not mutate chart-of-accounts structure. Postable inventory/COGS mapping belongs to a later accounting-integration gate.

## Staging UI
Added:
- `rc14-inventory-foundation.js`
- `rc14-inventory-foundation.css`
- Sidebar entry: `کالا و انبار`
- Mobile `بیشتر` entry: `کالا و انبار`
- Staging cache: `avan-staging-rc1-v50`

UI supports:
- list/create/edit/activate/deactivate کالا / خدمت
- list/create/edit انبار (default warehouse protected in this gate)
- list standard units
- create/edit/activate/deactivate custom units
- Company-scoped data through active `CompanyContext`
- summary of weighted-average method and negative-stock policy

## Production boundary
Production runtime was **not promoted** as part of RC1.4-A. The already accepted RC1.3 Production release remains the live production runtime.

## Live Gate — user
On Staging only:
1. Open `کالا و انبار` on desktop; page must load without error and show `انبار اصلی` plus 7 standard units.
2. Create one inventory item with a unique code, choose `عدد`, save, edit its name, then deactivate/reactivate it.
3. Create one custom unit and one additional warehouse; both must appear immediately.
4. Switch to another Company; the item/unit/warehouse created in the first Company must not appear.
5. On iPhone open `بیشتر → کالا و انبار`; page and add/edit modal must remain usable without bad overflow.

Pass phrase:
`Gate RC1.4-A پاس شد`

After PASS, proceed to **RC1.4-B — immutable stock movement ledger + opening/receipt/issue/transfer/adjustment + negative-stock enforcement**, still without Production promotion until its own release gate.
