# Avan — RC1.4 Inventory / Warehouse Kickoff

Date: 2026-09-06
Branch: `rc1-4-inventory`

## Status
**STARTED — architecture/schema foundation only.**

Production RC1.3 remains untouched. All RC1.4 work is isolated from Production until its own regression + Live Gate + explicit promotion approval.

## Goal
Add a professional inventory/warehouse accounting foundation without weakening the existing Ledger, Company/RLS, journal immutability, or zero-charge constraints.

## Core accounting rule
Inventory is a **ledger**, not an editable balance field.

- Current stock is derived from posted inventory movements.
- Current inventory value is derived from posted inventory movements/cost layers.
- Posted inventory movements are immutable.
- Corrections use reversal, not destructive edits.
- Inventory accounting must reconcile to the financial Ledger before any RC1.4 Production promotion.

## Phase plan
### RC1.4-A — Domain + Schema Foundation
- Items / کالاها
- Warehouses / انبارها
- Inventory documents / اسناد انبار
- Inventory document lines
- Immutable posted movement ledger
- Company/RLS boundary
- Draft → Posted → Reversed lifecycle contract
- no permanent DB migration until dry-run validation passes

### RC1.4-B — Posting Engine
- Receipt / issue / transfer / adjustment posting
- inventory movement generation
- negative-stock protection configurable per item/company
- transactional posting and reversal
- exact source linkage to journal entries where accounting impact exists

### RC1.4-C — Costing
Initial method: **moving weighted average**.

Reason:
- understandable to SME users,
- compatible with perpetual inventory,
- efficient without paid infrastructure,
- deterministic and auditable.

FIFO can be a later release if required.

### RC1.4-D — Sales/Purchase Integration
- stock-affecting invoice lines
- sales issue → COGS + inventory reduction
- purchase receipt → inventory increase
- invoice reversal restores stock/accounting links atomically

### RC1.4-E — UI / Reports
- کالاها
- انبارها
- رسید / حواله / انتقال / تعدیل
- کارت کالا
- موجودی به تفکیک انبار
- ارزش موجودی
- گردش کالا
- low-stock indicators

## Invariants / release blockers
Any violation below is Blocker/Critical:
1. Cross-Company inventory visibility or mutation.
2. Posted movement update/delete.
3. Inventory document marked Posted without complete movements.
4. Reversal without exact link to original document/movements.
5. Negative stock when policy forbids it.
6. Quantity balance disagrees with movement ledger.
7. Inventory valuation disagrees with accounting posting after integration.
8. Unit/cost math uses floating-point browser arithmetic for canonical persisted amounts.

## Data precision
- Quantity: `numeric(20,6)`.
- Unit cost: `numeric(20,6)` canonical Toman basis.
- Financial journal amounts remain existing canonical integer Toman rules; inventory-to-ledger posting must round explicitly and deterministically at the accounting boundary.

## RLS model
All inventory tables are Company-scoped via `workspace_id`.

- Read: `public.has_workspace_access(workspace_id)`.
- Browser may CRUD Draft/master data only where role allows.
- Posted movement ledger must not expose browser UPDATE/DELETE.
- Posting/reversal will use narrow command RPC boundaries following the existing public SECURITY INVOKER → private privileged implementation pattern.

## Zero-charge constraint
- no paid Supabase branch/project;
- no paid queue/worker dependency;
- no external paid costing service;
- development DDL is first validated with transaction-scoped dry runs against current PostgreSQL and kept only as repository migration evidence until promotion is approved.

## First technical artifact
`avan-staging/RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql`

This file is a migration candidate, **not yet applied to Production**.
