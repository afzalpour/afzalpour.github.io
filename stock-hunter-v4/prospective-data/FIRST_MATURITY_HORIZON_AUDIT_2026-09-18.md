# Stock Hunter First Prospective Maturity Horizon Audit

AUDIT_DATE: 2026-09-18
STATUS: STRUCTURAL_PASS / FIRST_MATURITY_HORIZON_PENDING
FIRST_COHORT_TRADE_DATE: 2026-09-19
THREE_FUTURE_SESSIONS: 2026-09-20, 2026-09-21, 2026-09-22
HORIZON_DEADLINE_UTC: 2026-09-22T14:55:00Z
HORIZON_DEADLINE_TEHRAN: 2026-09-22 18:25

## Live maturity contract

public.stock_hunter_calibration_dataset_v416 only admits Shadow rows when:

- future_sessions_observed >= 3;
- gate_reason = '';
- observed_at >= prospective_start_at;
- trade_date matches the Tehran date of observed_at;
- created_at is no earlier than observed_at - 2 minutes;
- created_at is no later than observed_at + max_capture_lag_seconds.

For the first prospective cohort on 2026-09-19, the required future sessions are:

1. 2026-09-20
2. 2026-09-21
3. 2026-09-22

Therefore no first-cohort row may enter Calibration before the 2026-09-22 close/outcome cycle.

## First-horizon verifier

Repository verifier:

stock-hunter-v4/prospective-data/verify-first-maturity-horizon-v416.sql

Current pre-horizon live result:

stock-hunter-first-maturity-horizon-v416: PASS

The verifier proves that the first-cohort Calibration row count exactly equals the number of first-day Shadow samples that independently satisfy the live maturity/provenance contract.

Every first-cohort Calibration row must:

- have future_sessions_observed >= 3;
- retain source_version 4.1.6-shadow-v2-parity;
- retain gate_reason = '';
- remain prospective-only;
- have a non-null return_3d_pct;
- have outcome observations on all three dates 2026-09-20, 2026-09-21, and 2026-09-22.

Before the horizon deadline, any first-cohort Calibration row is a failure.

At the first horizon, later cohorts must still be absent from Calibration because they cannot yet have three future sessions.

## Downstream lifecycle isolation

Around the first horizon, the verifier also requires:

- control plane remains CHAMPION_ONLY / 0%;
- no Activation Review exists;
- Calibration cannot be globally ready because there is at most one mature trade date;
- OOS remains locked;
- no candidate evaluation run exists;
- no OOS release manifest exists;
- no Promotion Proposal exists;
- no final release-pin manifest exists.

This is a maturity-horizon check, not an authorization to advance the release train.

## Operational completeness

After the horizon deadline, each of the five downstream jobs must have a succeeded run on each of the three future sessions, for 15 job/day successes total:

- stock-hunter-outcomes-v416-close-a
- stock-hunter-outcomes-v416-close-b
- stock-hunter-shadow-outcomes-v416-close-a
- stock-hunter-shadow-outcomes-v416-close-b
- stock-hunter-candidate-evaluator-v416

A zero mature count is not artificially converted into a failure merely because it is zero. It remains valid only when no same-sample combination exists that is both gate-eligible and complete through all three future sessions.

No synthetic maturity rows are created.

## Expected first-horizon state

After a healthy 2026-09-22 close, the first cohort may begin contributing mature Calibration rows.

Even then the overall maturity state must remain:

COLLECTING

because the frozen global policy still requires 20 trade dates, 120 total mature samples, 40 samples per mode, and 30 OOS samples before later lifecycle gates can open.
