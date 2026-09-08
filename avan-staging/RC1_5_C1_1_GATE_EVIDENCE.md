# RC1.5-C.1.1 Gate Evidence

Status: **ENGINEERING READY / LIVE PASS PENDING**

## Persian-only activity report
- Operational audit summaries are translated before rendering; raw backend `summary` is never shown directly.
- Unknown summaries containing Latin text fall back to a Persian-safe message.
- Regression coverage includes `Company member added as accountant`, `شرکت member added as accountant`, `Document uploaded`, and the inventory financial-bridge event.

## Custom reports — inventory and goods
Safe semantic sources added to `run_custom_report`:
- `inventory_items` — item catalog, groups, units, barcode, minimum stock.
- `inventory_stock` — on-hand quantity by warehouse, inventory value, average unit cost, below-minimum flag.
- `inventory_movements` — dated stock movements with document number/type, quantity and value deltas.

Authenticated RLS rehearsal on an existing Company with inventory data returned:
- items: 5 rows
- stock: 5 rows
- movements: 10 rows (limit 10)

No data was written by the rehearsal.

Security contract:
- `run_custom_report` is `SECURITY INVOKER` (`prosecdef=false`).
- EXECUTE: `authenticated`, `service_role`, `postgres`.
- no EXECUTE for `anon` or `PUBLIC`.

## Platform Admin UX
- `ثبت عملیات` and `دسترسی پشتیبانی` are compact sibling actions under each Company name; each opens one inline panel.
- Operations table reduced to 7 columns.
- Management audit is compact and limited to latest 12 rendered events (backend request limit 20).
- Tax rule family is shown in Persian; raw `IR_GENERAL_VAT` is not user-facing.
- Tax rule start/end inputs are Jalali text inputs converted to ISO only at the RPC boundary.
- Tax rule entry controls are one horizontal row on desktop and responsive below 900px.

## PWA
- Staging cache bumped to `avan-staging-rc1-v69-c1-1`.
- New pure localization catalog is included in the offline asset list.

## Release safety
- Production root runtime is unchanged.
- Changes are limited to `avan-staging/` plus the applied backend report-source migration.
- Live PASS requires explicit user verification.
