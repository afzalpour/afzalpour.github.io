# Avan — RC1.4 Inventory / Warehouse Kickoff

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
- **RC1.4-A schema foundation: DRY-RUN PASS / not applied.**
- **RC1.4-B1 stock Posting/Reversal Engine: TRANSACTIONAL PASS / not applied.**
- **Next: RC1.4-C/D — accounting roles + exact Inventory ↔ Financial Ledger bridge.**

Production RC1.3 remains untouched. All RC1.4 work is isolated from Production until its own regression + Live Gate + explicit promotion approval.

## Existing Production foundation discovered
The current database already contains a partial Inventory foundation:
- `public.inventory_units`
- `public.inventory_items`
- `public.inventory_settings`
- `public.warehouses`

Important existing behavior:
- RLS enabled on Inventory master tables.
- `inventory_units` and `warehouses` have composite `(workspace_id, id)` uniqueness.
- `inventory_items` enforces workspace SKU uniqueness and Company-owned base units.
- configured costing method = `weighted_average`.
- Company setting `allow_negative_stock` already exists.
- master-data write roles are owner / manager / accountant; read is Company-access scoped.

RC1.4 upgrades this foundation; it does **not** create a parallel Inventory model.

## Core accounting rule
Inventory is a ledger, not an editable balance field.

- stock is derived from posted inventory movements;
- inventory value is derived from signed movement value;
- posted movements are immutable;
- corrections use exact reversal links;
- inventory must reconcile to the financial Ledger before RC1.4 Production promotion.

## RC1.4-A — Domain + Schema Foundation — PASS in dry-run
Candidate adds:
- `inventory_documents`
- `inventory_document_lines`
- `inventory_movements`
- explicit Data API grants + RLS
- Company-scoped composite FKs
- derived `inventory_on_hand` security-invoker view

Validation:
- 3/3 candidate tables created in transaction;
- 3/3 RLS enabled;
- Company-scoped relationships validated;
- transaction rolled back;
- permanent Production RC1.4 tables after rollback = 0.

Artifact:
`avan-staging/RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`

## RC1.4-B1 — Stock Posting / Reversal Engine — PASS in transactional rehearsal
Implemented candidate behavior:
- receipt / opening posting;
- issue posting;
- warehouse transfer;
- positive/negative adjustment shape;
- moving weighted outgoing cost from the movement ledger;
- Company negative-stock policy enforcement;
- deterministic item/warehouse advisory locks for concurrent posting;
- per-fiscal-year inventory document numbering;
- exact movement reversal links;
- Draft → Posted → Reversed lifecycle;
- browser RLS blocks Posted document writes;
- DB triggers protect Posted documents/lines and all movements from destructive mutation;
- public SECURITY INVOKER command wrappers + private privileged implementation pattern.

Transactional test results:
- receipt 10 @ 100 → on-hand 10 / value 1000;
- issue 4 → outgoing weighted cost 100 / on-hand 6 / value 600;
- transfer 2 → source 4 / destination 2;
- exact transfer reversal → source 6 / destination 0;
- attempted issue of 999 rejected with `NEGATIVE_STOCK_FORBIDDEN`, with no leaked movement;
- cross-Company reference blocked by RLS and independently by composite FK;
- Posted document/line/movement mutation guards PASS;
- all test data and candidate schema rolled back.

Artifact:
`avan-staging/RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql`

Evidence/status:
`avan-staging/RC1_4_B_STATUS.md`

## RC1.4-C/D — NEXT: Cost Accounting + Financial Ledger bridge
Standard chart already contains raw/non-postable headings:
- `130` — موجودی مواد و کالا
- `520` — بهای تمام‌شده کالا و خدمات

They intentionally remain non-postable. Next work must create controlled **postable system accounts / account roles** below these headings rather than posting directly to the raw headings.

Next objectives:
1. add standard postable Inventory and COGS roles for every Company and onboarding;
2. define deterministic integer-Toman rounding at the financial boundary;
3. extend inventory Posting/Reversal so accounting-impacting stock documents create/reverse balanced journal entries atomically;
4. require exact `inventory_document ↔ journal_entry` linkage;
5. ensure stock value and financial Inventory balance reconcile;
6. then connect purchase/sales invoice lines and COGS.

## Later RC1.4-E — UI / Reports
- کالاها
- انبارها
- رسید / حواله / انتقال / تعدیل
- کارت کالا
- موجودی به تفکیک انبار
- ارزش موجودی
- گردش کالا
- low-stock indicators

## Release blockers
Any violation is Blocker/Critical:
1. Cross-Company inventory visibility or mutation.
2. Posted movement update/delete.
3. Posted inventory document without complete movements.
4. Reversal without exact source links.
5. Negative stock when policy forbids it.
6. Quantity balance disagrees with movement ledger.
7. Inventory valuation disagrees with financial accounting after bridge integration.
8. Canonical money persistence depends on floating-point browser math.

## Precision
- Quantity: `numeric(20,6)`.
- Inventory unit cost: `numeric(20,6)` Toman basis.
- Financial journal amounts remain canonical integer Toman; the bridge must round explicitly and deterministically.

## Zero-charge constraint
- no paid Supabase branch/project;
- no paid queue/worker dependency;
- no paid costing service;
- DB development is validated with transaction/rollback until the RC migration gate.
