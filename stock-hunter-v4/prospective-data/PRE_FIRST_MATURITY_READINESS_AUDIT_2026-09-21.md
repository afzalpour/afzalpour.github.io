# Stock Hunter — Pre-First-Maturity Readiness Audit

DATE: 2026-09-21
STATUS: PRE_HORIZON_READY / FIRST_COHORT_EXPECTED_ZERO_MATURE / NO_BACKFILL

## Horizon

Canonical first-maturity deadline:
- 2026-09-22 14:55 UTC

Scheduled operational verifier:
- 2026-09-22 15:05 UTC
- workflow: `.github/workflows/stock-hunter-live-first-maturity-horizon.yml`

## First cohort state

Trade date: 2026-09-19

Shadow Samples:
- total: 12
- eligible (`gate_reason=''`): 8
- reversal: 5
- acceleration: 7

Observed outcome state before the third future session:
- rows with `future_sessions_observed=0`: 4
- rows with `future_sessions_observed=1`: 8
- 2026-09-20 observation missing for all 8 eligible samples
- 2026-09-21 observation missing for 2 of 8 eligible samples
- current Calibration rows: 0

No historical/prospective observation is fabricated or backfilled.

Because the 2026-09-20 observation is genuinely absent, the 2026-09-19 cohort is not expected to produce mature Calibration rows at the first horizon. The first-horizon verifier is allowed to return PASS with zero expected mature rows only when no eligible first-cohort row actually reached three complete future sessions.

## Downstream job coverage repair

Required daily jobs:
1. `stock-hunter-outcomes-v416-close-a`
2. `stock-hunter-outcomes-v416-close-b`
3. `stock-hunter-shadow-outcomes-v416-close-a`
4. `stock-hunter-shadow-outcomes-v416-close-b`
5. `stock-hunter-candidate-evaluator-v416`

Coverage:
- 2026-09-20: 5/5 job names have a successful run
- 2026-09-21: initially 4/5 because candidate evaluator run `9070` failed with `job startup timeout`

Candidate evaluator recovery:
- job id: 9
- canonical schedule: `45 14 * * 0-3,6`
- command: `select public.snapshot_stock_hunter_candidate_evaluation_v416();`
- function definition was inspected before recovery
- when `calibration_ready=false`, function returns NULL before any candidate-evaluation insert
- schedule was temporarily changed to `* * * * *`
- recovery run `9111` at 2026-09-21 14:55:00 UTC: `succeeded`
- schedule immediately restored to `45 14 * * 0-3,6`
- 2026-09-21 downstream coverage after recovery: 5/5
- candidate evaluation runs after recovery: 0

This is an operational cron-coverage repair only; it does not create statistical evidence or advance lifecycle state.

## Quarantine interaction

The 2026-09-21 Shadow quality quarantine contains 438 samples from pre-v7 capture incidents.

It does not alter the 2026-09-19 first cohort numerically.

The first-maturity and rolling-maturity verifiers both explicitly reject any quarantined sample that leaks into Calibration.

Live verifier checks on 2026-09-21:
- first-maturity verifier: PASS
- rolling-maturity verifier: PASS

## Production safety

Unchanged:
- Champion: 4.1.6
- engine: `4.1.6-hunt-v2`
- routing: `CHAMPION_ONLY`
- challenger traffic: 0%
- kill switch: ON
- state_version: 1
- activation_review_id: null
- candidate evaluation runs: 0
- no OOS release
- no Promotion Proposal
- no Activation Review
- no final release freeze

## Operational expectation for 2026-09-22

Do not reinterpret missing 2026-09-20 observations as data to be repaired.

The legitimate sequence is:
1. let the 2026-09-22 outcome/close jobs execute normally;
2. require 5/5 successful downstream job-name coverage for 2026-09-22;
3. run the canonical first-maturity verifier after 14:55 UTC;
4. accept zero mature first-cohort rows if that is the empirical result;
5. do not advance OOS/Promotion/Canary unless later genuine prospective cohorts satisfy the frozen readiness thresholds.
