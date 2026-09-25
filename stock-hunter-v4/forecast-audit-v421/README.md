# Stock Hunter Forecast Audit v4.2.1

This release hardens the five-model validation introduced in v4.2.0.

## What changed

1. **Dated corporate-action/discontinuity evidence**
   - The audit no longer returns only a boolean warning.
   - It records each suspicious date, previous close, TSETMC `priceYesterday`, opening price, gap percentages, and the triggered rule.
   - Detection is conservative evidence of a discontinuity, not a claim about the legal/corporate cause.

2. **Validation quarantine**
   - If a discontinuity is detected anywhere from the retained training-window start through the evaluated target session, the case is marked:
     `EXCLUDED_CORPORATE_ACTION`.
   - The raw report is preserved.
   - The case is excluded from batch model aggregates.

3. **Raw vs display-rounded interval coverage**
   - `range_covered_raw`: exact numeric inclusion.
   - `range_covered_display_rounded`: both actual and model bounds rounded to the integer-rial display used by the UI.
   - This prevents a difference such as 2563 vs 2563.396 from being hidden while still showing whether the displayed interval includes the displayed price.

4. **Baseline comparison**
   - Every model row reports whether its center APE beats the no-change baseline.

5. **Batch validation**
   - `--batch <csv>` runs up to 500 cases.
   - Histories are cached per instrument within a run.
   - Aggregate metrics use only `CLEAN` cases:
     mean/median APE, direction accuracy, raw/display interval coverage, and baseline-beat rate.

## Included 90-case research batch

`BATCH_SAMPLE_30X3.csv` contains 30 project-Universe symbols over three exact two-session date windows:
- 2026-09-07 -> 2026-09-09
- 2026-09-14 -> 2026-09-16
- 2026-09-21 -> 2026-09-23

Rows with missing exact dates, insufficient data, fetch failure, or detected discontinuity do not silently become clean evidence.

## One-click Windows use

Single Shpaksa case:

`RUN_SHPAKSA_BACKTEST.cmd`

90-case batch:

`RUN_BATCH_30X3.cmd`

The batch writes:

`forecast_batch_audit_v421.json`

Send that JSON back for model-by-model review.

## Frozen boundary

This is a research/validation tool only. It does not alter:
- Frozen Hunt `4.1.6-hunt-v2`;
- Hunt formulas or thresholds;
- Action Now / Radar / Universe behavior;
- production routing.
