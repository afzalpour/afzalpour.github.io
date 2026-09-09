# ADR-0018 — Unified Money Runtime and Single-Writer Presentation

- Status: Proposed
- Date: 2026-09-09
- Preserves ADR-0001 and supersedes the fragmented RC1.1/RC1.5 money-presentation implementation.

## Context

Avan stores financial amounts canonically as integer Toman (ADR-0001), while the UI can operate in Toman or Rial. During incremental development, several compatibility modules independently converted, formatted, reparsed or rewrote money values in the DOM. This created multiple writers for the same amount, unit flicker, double Rial conversion, repeated unit labels, inconsistent tax/settlement totals and divergence between Web and cached PWA behavior.

Affected surfaces include opening balances, receipts, payments, transfers, journals, invoices, VAT summaries, settlement plans and checks, inventory costing/value, dashboard metrics, reports, detail views, CSV/PDF/print and PWA caching.

## Decision

Avan will use one money contract across all Web/PWA financial surfaces.

1. Canonical business and Ledger amount remains integer **Toman**.
2. The active display/input unit is resolved once for the **active Company** before financial UI rendering.
3. An unresolved unit is `unknown`; the runtime must never temporarily render Toman and later switch to Rial during the same render.
4. Conversion is permitted only at explicit boundaries:
   - canonical Toman -> display value when rendering backend data;
   - display value -> canonical Toman when constructing a financial command/payload.
5. Live DOM text is presentation only. Business calculations may never parse a previously-rendered money string.
6. No generic submit handler may temporarily mutate visible form values for conversion.
7. No generic MutationObserver may rewrite monetary values or switch units.
8. Each financial surface has exactly one writer for calculated amounts.
   - Tax UI owns tax metadata/profile fields, not invoice monetary totals.
   - Invoice Money Controller owns line totals, subtotal, tax and grand total.
   - Settlement owns settlement schedule presentation and consumes canonical invoice total.
9. `app.js` remains the Compatibility Shell, but all financial formatting/input boundaries delegate to the unified Money Runtime.
10. Reports, dashboard, detail views, inventory value views and print/CSV format canonical values through the same runtime.
11. Money-unit headings are metadata/presentation, never repeatedly appended live text.
12. Changing money preference persists for the active Company and performs a clean reload/re-render from canonical data instead of converting open forms in place.
13. Web and PWA load the same active money runtime; Service Worker must not cache retired money writers.

## Guardrails / Invariants

- Only `src/core/money/*` may implement numeric Rial/Toman conversion (`×10` / `÷10`).
- Active UI modules may display unit labels but may not implement conversion arithmetic.
- No active module may define a hard-coded money formatter that always returns `تومان` or `ریال`.
- No active module may read `window.AVAN_MONEY_DISPLAY_UNIT` directly.
- Invoice Tax Workspace must not write subtotal/tax/grand-total amounts.
- Settlement must never derive payable amount by parsing invoice DOM text.
- `10,005 Toman` renders as `10,005 Toman` or `100,050 Rial` according to active preference and must never receive a second conversion.
- Rial input that cannot map exactly to integer Toman is rejected at the command boundary, consistent with ADR-0001.
- Print/PDF/CSV expose the active unit explicitly and use the same display conversion as the live report/detail.

## Rejected alternatives

- More MutationObserver or timeout patches to make one renderer the last writer.
- Temporarily changing visible input values to Toman during submit, then restoring them.
- Parsing strings such as `10,005 تومان` or `100,050 ریال` as business truth.
- Maintaining separate Web and PWA money implementations.

## Gate

The Money Architecture Gate must cover:

- opening balance;
- receipt / payment / transfer;
- manual journal;
- sale / purchase invoice;
- VAT subtotal/tax/grand-total;
- settlement/check/installment/mixed plan;
- inventory unit cost/value;
- dashboard and standard reports;
- invoice/journal/detail views;
- print/PDF/CSV unit metadata;
- unit change + reload;
- Web/PWA runtime and cache parity.

RC1.5-C Live testing cannot continue until this gate is Engineering PASS and then user Live PASS.
