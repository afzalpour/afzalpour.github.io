# RC1.5 — Regulatory Baseline at Cycle Start (1405)

Snapshot date: 2026-09-08

This file is an engineering baseline, not legal advice. Before enabling actual external tax submission, Avan must re-check the then-current official Tax Administration rules and technical specifications.

## Confirmed design-relevant points
- General VAT rate applicable to ordinary goods/services in 1405 is 10% under the final 1405 budget/tax implementation baseline.
- Electronic invoices and taxpayer-system workflows remain a core statutory mechanism.
- Tax treatment is not universally one rate: exempt, special-rate and special-base cases exist.
- Therefore Avan must not hard-code a single rate in invoice UI or permanently infer historical tax from today's rule.

## Engineering consequences
- rules need effective_from/effective_to and immutable historical versions.
- invoices need line-level tax snapshots.
- item/service tax classification is required.
- party/company tax settings must be Company-scoped.
- external e-invoice integration must use an adapter and pre-validation layer.
- submission must be explicit/Human-controlled.
- source metadata must be retained per rule version.

## Initial sources checked
- ADR-0007 in this repository.
- 1405 Tax Administration budget implementation circular references.
- final 1405 budget/tax summaries confirming 10% general VAT baseline.
- Law on Store Terminals and Taxpayer System, including electronic-invoice workflow requirements and later amendments.
