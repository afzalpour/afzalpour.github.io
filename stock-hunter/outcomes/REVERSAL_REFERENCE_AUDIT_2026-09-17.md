# Stock Hunter Reversal Reference Outcome Audit — 2026-09-17

STATUS: LIVE_CONTRACT_PASS / PROSPECTIVE_DATA_PENDING

## Objective

Track Reversal success against the price reference that was known at prediction time, without using a later session's reference price and without synthetic historical backfill.

The frozen field is `reference_yesterday_price`.

## Live schema contract

The field exists on both prediction ledgers and both derived outcome views:

- `public.stock_hunter_hunt_events_v416.reference_yesterday_price`
- `public.stock_hunter_shadow_samples_v416.reference_yesterday_price`
- `public.stock_hunter_hunt_outcomes_v416.reference_yesterday_price`
- `public.stock_hunter_shadow_outcomes_v416.reference_yesterday_price`

The outcome views expose two Reversal-only labels:

- `reversal_crossed_reference_same_day`
- `reversal_closed_above_reference_same_day`

For `hunt_mode='reversal'`, they compare the same-day post-prediction high/close with the frozen `reference_yesterday_price`. For non-Reversal rows, these labels are `NULL`.

## Capture-time provenance and leakage guard

The reference is established on INSERT only. If the capture payload provides `reference_yesterday_price`, the recorders store it. If it is absent, INSERT triggers reconstruct the same prediction-time reference from the captured price and captured day change:

`reference = prediction_price / (1 + prediction_day_change / 100)`

The event recorder preserves the first non-null reference on later upserts. Shadow samples use insert-only bucket semantics, so a later observation cannot replace the original bucket reference.

This is deliberately prospective. Existing historical rows are not backfilled from later market state.

## Applied live migrations

- `20260917171826 stock_hunter_reversal_reference_tracking_20260917`
- `20260917171857 stock_hunter_reference_capture_trigger_20260917`
- `20260917171908 stock_hunter_shadow_reference_preserve_insert_contract_20260917`

These migrations add the ledger fields, derived Reversal labels, capture-time reconstruction triggers, and preservation semantics.

## Live rollback probe

A transactional probe was executed against the Stock Hunter database for both the event and shadow paths.

Probe input used prediction price `99` and day change `-1%`, which must freeze a reference of `100`. A same-day high of `100.2` and close of `100.1` must therefore produce:

- `reversal_crossed_reference_same_day = true`
- `reversal_closed_above_reference_same_day = true`

Both paths completed without assertion failure. The transaction was rolled back and a residue check confirmed zero probe rows remained.

The reusable rollback-only verification script is:

`stock-hunter-v4/outcomes/verify-reversal-reference-v417.sql`

## Prospective-data status

At audit time there were zero real `reversal` rows in both `stock_hunter_hunt_events_v416` and `stock_hunter_shadow_samples_v416`.

That is not an error and must not be "fixed" with synthetic historical rows. Real Special/Urgent and shadow observations must accumulate prospectively before calibration or validation can claim Reversal outcome coverage.

## Exit criteria

Roadmap item #5 is complete at the schema/logic level when:

1. the reference is frozen from prediction-time information;
2. later updates cannot replace the original reference;
3. Reversal crossing/close labels use same-day outcome prices against that frozen reference;
4. event and shadow paths both pass rollback-only probes;
5. no synthetic historical backfill is introduced.

All five contract criteria passed on 2026-09-17. Empirical Reversal sample maturity remains pending prospective real data and belongs to the later data/calibration stages.