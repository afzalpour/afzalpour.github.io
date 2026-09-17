# Stock Hunter 4.1.6 Prospective Real-Data Collection Audit

AUDIT_DATE: 2026-09-17
STATUS: ARMED_REAL_DATA_MATURITY_PENDING
PROSPECTIVE_START_AT_UTC: 2026-09-19T05:30:00Z
PROSPECTIVE_START_AT_TEHRAN: 2026-09-19 09:00 Asia/Tehran
MAX_CAPTURE_LAG_SECONDS: 600
SYNTHETIC_BACKFILL_TO_CALIBRATION: FORBIDDEN

## Live state at audit time

The capture scheduler had been installed after the final Wednesday market window. Thursday 2026-09-17 and Friday 2026-09-18 are outside the configured trading-day schedule, so zero capture runs and zero ledger rows are expected before the first eligible Saturday window.

At audit time:

- Hunt events: 0.
- Shadow samples: 0.
- Reversal samples: 0.
- Acceleration samples: 0.
- Special events: 0.
- Urgent events: 0.
- Mature Calibration samples: 0.
- Calibration readiness: false.
- Collection state: `ARMED_AWAITING_FIRST_MARKET_WINDOW`.

No sample counts were fabricated or backfilled to make readiness appear green.

## Scheduler proof

Three pg_cron capture jobs are active:

- `stock-hunter-capture-v416-open`: `30-59 5 * * 0-3,6`
- `stock-hunter-capture-v416-mid`: `* 6-12 * * 0-3,6`
- `stock-hunter-capture-v416-close`: `0-30 13 * * 0-3,6`

All three now read the project URL and dedicated capture token from Supabase Vault at execution time and send `X-Stock-Hunter-Capture-Token` to `stock-hunter-capture-v416`.

A live closed-market HTTP probe using exactly that Vault-backed scheduler path returned HTTP 200 with `outside-market-window`. This proves the current scheduler credential reaches the deployed capture function and passes authentication without performing a market scan or writing ledger data.

The scheduler state was re-versioned in migration `stock_hunter_prospective_collection_guard_v416_20260917`, so the authenticated cron definition is no longer only mutable live state.

## Calibration provenance guard

`stock_hunter_calibration_policy_v416` now contains:

- `prospective_start_at = 2026-09-19T05:30:00Z`
- `max_capture_lag_seconds = 600`

`stock_hunter_calibration_dataset_v416` preserves its existing output contract but only admits mature samples when all of the following are true:

1. `future_sessions_observed >= 3`.
2. `gate_reason = ''`.
3. `observed_at >= prospective_start_at`.
4. `trade_date` equals the Tehran calendar date of `observed_at`.
5. database `created_at` is no more than 2 minutes before `observed_at` and no more than 600 seconds after it.

This does not delete raw ledger rows. It only prevents pre-cutover or late historical replay/backfill from entering Calibration, Validation, or OOS selection.

## Backfill drill

A synthetic Reversal shadow sample was inserted inside an explicit transaction with a pre-cutover observation date and enough synthetic outcome observations to satisfy the three-session maturity rule. The test asserted that its `sample_id` was absent from `stock_hunter_calibration_dataset_v416`, then rolled the entire transaction back.

Post-probe residue:

- probe shadow rows: 0
- probe Calibration rows: 0
- real shadow rows: 0
- real event rows: 0

Therefore the drill did not contaminate the real ledger or Calibration dataset.

## Security check

Supabase Security Advisor was rerun after the migration. It introduced no new finding. The only existing INFO finding remains the unrelated private Canary authorization table with RLS enabled and no policy.

## Completion semantics

Roadmap item #6 is not statistically complete yet. Infrastructure and provenance enforcement are complete, but real-data maturity must happen prospectively after the first eligible market window. The correct current state is `ARMED_REAL_DATA_MATURITY_PENDING`, not PASS-by-synthetic-data.

The next maturity checks should watch real sample counts by Reversal/Acceleration, Special/Urgent coverage, trade-date breadth, symbol breadth, and three-session outcome maturity before Candidate/Calibration logic is trusted.
