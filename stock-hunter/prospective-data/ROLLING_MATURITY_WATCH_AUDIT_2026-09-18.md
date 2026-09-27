# Stock Hunter Rolling Prospective Maturity Watch

AUDIT_DATE: 2026-09-18
STATUS: LIVE_STRUCTURAL_PASS / REAL_DATA_ACCUMULATION_PENDING
CONTRACT: PROSPECTIVE_3_SESSION_MATURITY_MANUAL_DOWNSTREAM_ONLY

## Frozen maturity thresholds

The live Calibration policy remains:

- engine_version = 4.1.6-hunt-v2
- min_total_samples = 120
- min_mode_samples = 40
- min_oos_samples = 30
- min_trade_dates = 20
- train / validation / OOS = 60% / 20% / 20%
- prospective_start_at = 2026-09-19T05:30:00Z
- max_capture_lag_seconds = 600
- auto_promote = false

The Robustness policy remains:

- require_both_modes = true
- auto_unlock_oos = false

Candidate auto-promote also remains false.

## Current live progress

At audit time:

- mature total = 0 / 120
- mature reversal = 0 / 40
- mature acceleration = 0 / 40
- mature OOS = 0 / 30
- mature trade dates = 0 / 20
- calibration_ready = false
- maturity_state = COLLECTING
- candidate evaluation runs = 0
- OOS release manifests = 0
- Promotion Proposals = 0
- Activation Reviews = 0
- final release-pin manifests = 0
- routing = CHAMPION_ONLY / 0%

This is expected before the first prospective market window and first three-session maturity horizon.

## Rolling verifier

Repository verifier:

stock-hunter-v4/prospective-data/verify-rolling-maturity-watch-v416.sql

Current live result:

stock-hunter-rolling-maturity-watch-v416: PASS

The verifier independently recomputes mature total/mode/OOS/trade-date counts from the Calibration dataset and requires exact equality with:

- stock_hunter_calibration_readiness_v416
- stock_hunter_candidate_evaluator_status_v416
- stock_hunter_maturity_status_v416

It also recomputes calibration_ready as the exact conjunction of all frozen thresholds. A boolean drift between the data and readiness view is a failure.

## Row-level maturity integrity

Every Calibration row must retain:

- future_sessions_observed >= 3
- return_1d_pct present
- return_3d_pct present
- source_version = 4.1.6-shadow-v2-parity
- gate_reason = ''
- hunt_mode in reversal / acceleration
- split in train / validation / oos
- positive cluster_weight <= 1
- prospective-only observed_at
- Tehran trade-date identity
- capture provenance within the frozen lag window

No row can be counted merely because a summary counter increased.

## Downstream isolation while collecting

While calibration_ready=false, the verifier requires:

- maturity_state = COLLECTING
- OOS remains locked
- can_unlock_oos = false
- candidate evaluation runs = 0
- OOS release manifests = 0
- Promotion Proposals = 0
- Activation Reviews = 0
- final release-pin manifests = 0
- routing remains CHAMPION_ONLY / 0%
- kill switch remains engaged

Once Calibration becomes naturally ready, the verifier stops asserting that candidate evaluation must remain zero. It still does not authorize OOS release, Promotion, Canary, or activation.

## Watch semantics

A recurring operational watch begins after the first cohort maturity horizon.

It reports material progress or failures, including:

- current mature counts and remaining gaps;
- new mature trade dates;
- reversal/acceleration balance;
- OOS split count;
- latest mature cohort;
- cron/capture/outcome health if progress stalls;
- first transition to calibration_ready=true;
- first transition to READY_FOR_MANUAL_OOS_RELEASE, if/when robustness later passes.

No automatic downstream action is permitted.
