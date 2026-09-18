# Stock Hunter 4.1.6 Calibration / Validation / Robustness Audit

AUDIT_DATE: 2026-09-17
STATUS: STRUCTURAL_PASS_REAL_DATA_MATURITY_PENDING
MIGRATION: stock_hunter_validation_robustness_maturity_v416_20260917

## Current live maturity

At audit time the prospective ledger is still empty because the first eligible market window after the collection cutover has not happened yet.

Current state:

- mature Calibration samples: 0 / 120 minimum
- Reversal mature samples: 0 / 40 minimum
- Acceleration mature samples: 0 / 40 minimum
- trade dates: 0 / 20 minimum
- selected challengers: 0
- robust modes: 0
- OOS unlocked: false
- can unlock OOS: false
- maturity state: `COLLECTING`

No synthetic rows were inserted to make these thresholds pass.

## Selection-order defect found and fixed

Before this audit, `stock_hunter_candidate_validation_selection_v416` correctly implemented:

1. build a shortlist from Train,
2. evaluate that shortlist on Validation,
3. rank by Validation metrics.

However, `stock_hunter_candidate_selected_v416` read directly from `stock_hunter_candidate_leaderboard_v416`. That could allow a candidate outside the Train shortlist to become the selected challenger later.

The migration changes `stock_hunter_candidate_selected_v416` so the selected challenger must come from `stock_hunter_candidate_validation_selection_v416`, must still satisfy the leaderboard eligibility thresholds, and must be non-baseline.

If the frozen baseline ranks first on Validation, the system now abstains for that mode rather than selecting a weaker challenger merely to populate a slot.

## Robustness contract

The live robustness policy remains:

- minimum Validation trade dates: 6
- minimum paired Candidate/Baseline trade dates: 4
- required time slices: exactly 3 in the robustness view
- minimum passing slices: 2
- minimum selected symbol-days per slice: 3
- block bootstrap repetitions: 200
- bootstrap block length: 2 trade days
- minimum bootstrap win rate: 0.60
- minimum bootstrap p10 utility difference: -0.15
- require both modes: true
- automatic OOS unlock: false

The existing robustness pipeline uses paired Candidate/Baseline Validation dates, three time slices, and deterministic block bootstrap. OOS is not used for candidate selection (`oos_used_for_selection=false`).

## OOS readiness hardening

`stock_hunter_oos_unlock_readiness_v416` now counts distinct non-baseline hunt modes and distinct robust non-baseline hunt modes.

With `require_both_modes=true`, manual OOS readiness requires exactly two selected challenger modes and both modes robust. A baseline row cannot satisfy challenger mode count.

There are no active cron jobs that release OOS, set `oos_unlocked`, or automate robustness release.

## Unified maturity status

The migration adds internal service-role view `stock_hunter_maturity_status_v416` with fail-closed states:

- `COLLECTING`
- `VALIDATION_SELECTION_PENDING`
- `ROBUSTNESS_PENDING`
- `READY_FOR_MANUAL_OOS_RELEASE`
- `OOS_RELEASED`
- `HOLD`

At audit time it reports `COLLECTING`.

## Negative-control drills

Two live negative controls passed:

1. With the immature zero-sample dataset, `stock_hunter_candidate_selected_v416` returned zero rows and all selected-row invariants passed.
2. A real call to `private.release_stock_hunter_oos_v416('maturity negative-control probe')` was attempted inside an exception-controlled test. It failed with `OOS robustness gate is not ready`. Manifest count and `oos_unlocked` state were unchanged.

Reusable verifier result:

`stock-hunter-calibration-robustness-v416: PASS`

## Completion semantics

Roadmap item #7 is structurally complete: Train -> Validation selection, paired-date robustness, three slices, block bootstrap, both-mode requirement, and abstention are enforced and verified.

Statistical maturity is not complete and cannot be manufactured. The system must remain in `COLLECTING` / pending states until prospective real samples satisfy the live thresholds.

The next roadmap step is the one-time OOS release protocol. It must remain inaccessible until `stock_hunter_maturity_status_v416.maturity_state = 'READY_FOR_MANUAL_OOS_RELEASE'` and then freeze the candidate/baseline snapshot plus dataset fingerprint exactly once.
