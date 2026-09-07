# RC1.4 v60 — Catalog + Settlement

Status: **Backend Functional PASS / Security PASS / Staging publication pending**

## Applied Supabase migrations

- `20260907100526` — `rc1_4_settlement_terms_checks_and_catalog_level3`
- `20260907101016` — `rc1_4_catalog_level3_constraint`
- `20260907102149` — `rc1_4_settlement_reversal`
- `20260907105417` — `rc1_4_v60_settlement_fk_index_hardening`

The exact applied SQL is retained by Supabase in `supabase_migrations.schema_migrations.statements` under the versions above.

## Catalog architecture

- Grouping depth: **3 classification levels**.
- Level 1: main group.
- Level 2: subgroup.
- Level 3: model / family.
- Inventory quantity/value remains on the actual `inventory_items` SKU only.
- Existing SKUs are preserved; no forced history rewrite.
- `min_stock = 0` disables low-stock warning only; it does not permit negative stock.

## Settlement architecture

Invoice financial recognition remains independent from settlement:

- sale invoice → Accounts Receivable / revenue
- purchase invoice → expense/GRNI / Accounts Payable
- cash/bank settlement clears A/R or A/P through financial accounts
- check settlement transfers A/R or A/P to checks receivable/payable
- check clearance transfers checks receivable/payable to/from bank
- installment schedules remain open until individually settled

Provisioned account roles for every current workspace:

- `checks_receivable` → `1202 — چک‌های دریافتنی`
- `checks_payable` → `2102 — چک‌های پرداختنی`

## Functional rehearsal

All tests executed under `authenticated` role inside transaction and rolled back:

- cash sale + automatic settlement: PASS
- check sale + recognition + bank clearance: PASS
- three-installment purchase + individual installment settlement: PASS
- cash settlement reversal + invoice reversal: PASS
- cleared check settlement reversal + invoice reversal: PASS
- ledger debit = credit throughout rehearsals

## Security / integrity gate

After rollback:

- public SECURITY DEFINER executable by `authenticated`: **0**
- new settlement tables RLS: **enabled**
- browser grants on settlement tables: **SELECT only**
- direct Data API INSERT/UPDATE/DELETE grants: **none**
- settlement writes only via public SECURITY INVOKER RPC wrappers → private privileged implementations
- orphan journal lines: **0**
- unbalanced Posted/Reversed journals: **0**
- current ledger remains balanced

Security Advisor: no new v60 security warning. Existing Free-plan `auth_leaked_password_protection` warning remains open by policy.

Performance hardening removed the v60 duplicate invoice index and covered v60 settlement/check foreign keys. Newly created indexes may appear as unused until live traffic exercises them.
