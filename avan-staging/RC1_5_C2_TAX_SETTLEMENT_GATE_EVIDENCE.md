# RC1.5-C2 — Tax + Settlement Integration Gate Evidence

Date: 2026-09-08

Status: **ENGINEERING PASS / LIVE GATE PENDING**

## Scope

- Remove the final direct Avan Cloud client method overwrite.
- Make invoice settlement use the VAT-inclusive canonical invoice total.
- Keep the live settlement amount synchronized with the invoice tax grand total.
- Move settlement runtime onto Operation Pipeline and the centralized UI Lifecycle.
- Preserve all RC1.4 catalog, settlement, installment and check behavior.

## Frontend architecture

- Added `rc14-catalog-settlement-v61.js` as a safe successor to the legacy v60 runtime.
- Staging `index.html` now loads v61.
- The old `rc14-catalog-settlement-v60.js` JavaScript runtime was removed.
- Existing `rc14-catalog-settlement-v60.css` remains as styling only.
- Settlement draft interception now uses Operation Pipeline middleware:
  - method: `rpc`
  - id: `settlement:invoice-plan`
  - priority: `300`
- Tax invoice-line middleware remains earlier in the chain at priority `200`.
- Settlement UI enhancement now uses centralized UI Lifecycle handler `catalog-settlement:v61`; its former body-wide MutationObserver was removed.
- Added `src/ui/settlement/tax-settlement-sync.js` as a small integration adapter. It synchronizes the visible settlement total with the tax grand total using Lifecycle + input/change events; it adds no MutationObserver and no client monkey patch.

## Canonical amount contract

The live browser UI prefers the VAT-inclusive tax grand total and exposes it through the shared invoice-form amount contract.

Settlement persistence does **not** trust duplicated client-side tax arithmetic. After `save_draft_invoice` completes, v61 reads the persisted `invoices.total_amount` and uses that value as the canonical amount for `save_invoice_settlement_plan`.

Therefore settlement plans are validated against the same final total produced by the server-side tax snapshot.

## Architecture / unit CI

PR branch Quality Gate: PASS.

Tests include:

- `operation-pipeline.spec.mjs`: PASS
- `vat-calculator.spec.mjs`: PASS
- `lifecycle.spec.mjs`: PASS
- `user-facing-fa.spec.mjs`: PASS
- `tax-settlement-sync.spec.mjs`: PASS
  - verifies Persian formatted `۱۱٬۰۰۶ تومان` parses as 11,006;
  - verifies VAT-inclusive tax grand total wins over a stale/pre-tax 10,005 amount.

Final audit after deleting v60:

- `direct_client_method_overwrites`: **0**
- `quarantined_legacy_overwrites`: **0**
- `unauthorized_client_overwrites`: **0**
- `high_findings`: **0**
- `mutation_observers`: 30
- `body_wide_mutation_observers`: 8
- legacy overwrite allowlist: `{}`

Observer debt remains a separate incremental cleanup item; C2 removed the settlement module's own body-wide observer.

## Authenticated database rehearsal — ROLLBACK

A real `authenticated` owner context was used. Tax was enabled only inside the transaction.

Controlled sale invoice:

- taxable subtotal: **10,005 Toman**
- effective VAT rate: **10%**
- tax amount: **1,001 Toman**
- canonical invoice total: **11,006 Toman**
- tax treatment: `standard`
- tax profile snapshot: `VAT_STD`

Settlement assertions:

1. A deliberately incorrect settlement schedule of **10,005** (pre-tax amount) was rejected with `SETTLEMENT_PLAN_TOTAL_MISMATCH`.
2. A settlement schedule of **11,006** was accepted.
3. The accepted schedule sum equaled the persisted invoice total exactly.
4. The invoice posted successfully with the VAT-inclusive accounting journal.
5. The invoice was reversed successfully; its pending settlement plan/schedule were cancelled by the existing settlement-aware reversal contract.
6. Entire rehearsal transaction was rolled back.

## Post-rehearsal integrity

- test invoice residue: **0**
- tax-enabled companies: **0**
- ledger debit: **4,073,481,351 Toman**
- ledger credit: **4,073,481,351 Toman**
- orphan journal lines: **0**
- unbalanced Posted/Reversed journals: **0**
- public `SECURITY DEFINER` executable by `authenticated`: **0**

## Live gate still required

User must verify on Staging that:

- invoice tax summary and settlement plan show the same VAT-inclusive final amount;
- installment split uses the final amount including VAT;
- draft save succeeds without duplicate settlement behavior;
- normal catalog/inventory and settlement dashboard behavior remains intact.

Do not mark RC1.5-C2 Live PASS until the user explicitly confirms it.
