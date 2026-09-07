# Avan — RC1.4-L Full Regression / Promotion Readiness Gate

Date: 2026-09-07
Supabase project: `dkyqsxnllvxypigxpygo`
Staging runtime: `avan-staging/`, cache `avan-staging-rc1-v57`

## Status
**ENGINEERING REGRESSION PASS / FINAL USER LIVE GATE PENDING / NOT YET AUTHORIZED FOR PRODUCTION PROMOTION**

RC1.4 backend, accounting integration, RLS boundaries, valuation, and rollback integrity passed a fresh transaction-scoped regression against the current database state after all RC1.4 account/item hierarchy migrations and the v56/v57 inventory UI stability work.

The root Production frontend was not changed by this Gate.

## User-accepted browser items already closed
The user has explicitly accepted the following current Staging behaviors and they are not reopened by this Gate:
- four-level Accounts hierarchy behaves correctly;
- Accounts page flicker is resolved;
- inventory Receipt freeze is resolved (`رسید حل شد`);
- redesigned single-window Receipt modal was accepted (`عالی عالی`).

## Fresh current-state transaction regression
A complete authenticated-owner scenario was executed inside `BEGIN ... ROLLBACK` on 2026-09-07. Test records used a fresh six-decimal unit, fresh inventory item, and fresh secondary warehouse and were fully rolled back.

PASS assertions:
1. Cross-Company inventory document visibility was blocked by RLS.
2. Cross-Company inventory Draft save was rejected.
3. Receipt `10 @ 100` posted successfully.
4. Receipt `10 @ 200` posted successfully.
5. Moving weighted average became exactly `150`; stock/value `20 / 3000`.
6. Issue `5` produced stock/value `15 / 2250` and COGS `750`.
7. Transfer `2` preserved total Company inventory value and produced source/destination `13/1950` and `2/300`.
8. Exact transfer reversal restored `15/2250` and destination `0/0`.
9. Oversized Issue was blocked with `NEGATIVE_STOCK_FORBIDDEN`; Draft stayed Draft and no movement leaked.
10. Browser direct mutation of a Posted inventory document remained blocked.
11. `authenticated` has no direct INSERT privilege on `inventory_movements`.
12. Exact Issue reversal restored stock/value to `20 / 3000`.
13. Six-decimal stock-aware sale `0.123456` retained exact invoice quantity and reduced stock to `19.876544`.
14. Sale had both financial journal link and linked inventory Issue.
15. Direct financial-only reversal of that stock sale was blocked with `INVOICE_INVENTORY_REVERSAL_REQUIRED`.
16. Atomic `reverse_invoice` restored stock/value to `20 / 3000` and populated the inventory reversal link.
17. Purchase Receipt `5 @ 200` raised stock/value to `25 / 4000`.
18. Matched Purchase Invoice cleared GRNI to AP without creating a second inventory movement/document.
19. A second Purchase Invoice against the same Posted Receipt line was blocked with `PURCHASE_RECEIPT_ALREADY_INVOICED` and remained Draft.
20. Purchase Invoice reversal left the original Receipt Posted and stock/value unchanged at `25 / 4000`.
21. All Posted/Reversed journals remained balanced.
22. Orphan journal lines remained zero.
23. Inventory ↔ Financial Ledger reconciliation remained PASS.
24. Account hierarchy invariant remained intact: no active postable parent has active children; no Level-4 account has children.

## Post-rollback real baseline
No regression data was retained.

Current real state immediately after rollback:
- inventory items: `2`
- inventory documents: `1`
- inventory document lines: `2`
- inventory movements: `0`
- journal entries: `30`
- journal lines: `67`
- total debit: `201581351` Toman
- total credit: `201581351` Toman
- orphan journal lines: `0`
- unbalanced Posted/Reversed journals: `0`
- public SECURITY DEFINER executable by authenticated: `0`
- postable accounts with active children: `0`
- Level-4 accounts with children: `0`

The one real inventory document is the user's current Draft and was not modified by the engineering regression.

## Security Advisor
No new RC1.4 security WARN/ERROR was introduced.

Expected remaining notices:
- INFO notices for intentional deny-by-default / no-policy tables, including `private.inventory_document_number_sequences`.
- existing `auth_leaked_password_protection` WARN. It remains unavailable on the current Free plan and is not falsely marked fixed. Free compensating password controls remain the project path.

## Frontend / deployment state
- Staging cache: `avan-staging-rc1-v57`.
- v56 fixed the Receipt form freeze and zero-decimal frontend validator.
- v57 changed only Receipt modal UX/CSS + cache, leaving the solved JS/backend accounting path untouched.
- GitHub Pages deployment for v57 completed successfully.

## Remaining final user Live Gate
Engineering evidence is complete, but Production promotion is not yet authorized because the following browser-facing workflows still need explicit user acceptance on the current Staging build:
1. Inventory Reports: on-hand quantity/value, weighted average, item movement card, reconciliation indicator.
2. Stock-aware Sales Invoice: post and atomic reversal; stock must decrease and restore.
3. Matched Purchase Invoice: select the Posted Receipt line; posting must not increase stock again.
4. iPhone/mobile: current full-screen inventory document modal plus Reports/Invoice inventory fields must remain usable without overflow.

After these four user checks pass, RC1.4 can be marked **Promotion Ready**. Root Production promotion still requires explicit user authorization and must not happen automatically.
