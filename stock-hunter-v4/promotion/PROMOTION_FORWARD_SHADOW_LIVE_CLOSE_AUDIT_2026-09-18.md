# Stock Hunter 4.1.7 Promotion / Forward Shadow / Activation Review Live Closure

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_OOS_RELEASE_AND_FORWARD_SHADOW_PENDING
TARGET_PROJECT: summnepwuziwulzvpcms
LIVE_MIGRATION: 20260918084704 stock_hunter_promotion_forward_shadow_live_close_20260918
CONTRACT: OOS_FROZEN_MANUAL_ONLY_PROSPECTIVE_PAIRED

## Live closure

The Promotion -> Forward Shadow -> Activation Review control-plane is now live-hardened.

No real Promotion Proposal, Forward Shadow artifact, Activation Review, Canary authorization, or traffic transition was created.

Current lifecycle state:

- OOS integrity = LOCKED_AWAITING_MATURITY
- Promotion proposals = 0
- Forward Shadow rows = 0
- Activation Reviews = 0
- activation events = 0
- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- state_version = 1
- lifecycle gate = BLOCKED_OOS_NOT_FROZEN

## Architecture blocker found and fixed

The earlier repo hardening assumed stock_hunter_challenger_shadow_samples_v417 was a writable table with bucket_minute and created_at.

The live object is instead a 20-column security_invoker view.

More importantly, before this live closure the view sourced candidate scores from stock_hunter_candidate_scores_v416. That view reads stock_hunter_calibration_dataset_v416.

After the one-time OOS release, Calibration is deliberately switched to the immutable OOS release snapshot. Therefore a Promotion Proposal created after the OOS release would have created this impossible conjunction:

- candidate score source is frozen to pre-Proposal observations;
- Forward Shadow requires observed_at > Proposal created_at.

The result would be a structurally deadlocked Forward Shadow with zero future rows.

## Live Forward Shadow source

stock_hunter_challenger_shadow_samples_v417 is now rebuilt as a security_invoker view over:

- stock_hunter_shadow_samples_v416
- stock_hunter_shadow_outcomes_v416
- the frozen candidate result from stock_hunter_oos_release_results_v416
- the frozen baseline candidate in stock_hunter_candidate_library_v416

The source explicitly excludes Calibration and candidate_scores_v416.

Every eligible raw observation must:

- occur strictly after Proposal created_at;
- preserve the Tehran trade date;
- preserve source_version = 4.1.6-shadow-v2-parity;
- remain within the two-minute early / ten-minute late provenance window.

The view preserves the existing 20-column contract consumed by stock_hunter_champion_challenger_metrics_v417.

It also preserves the existing utility/scoring semantics:

- 1D/3D outcome utility formula;
- weighted candidate opportunity formula;
- risk/cancellation penalties;
- 0.82..1.00 continuation modifier;
- the existing شکار ویژه / هشدار فوری / شکار زودهنگام / رصد state thresholds.

For every sample/mode the view produces one champion and one challenger row.

## Promotion Proposal guard

Proposal insertion is now guarded by OOS integrity directly.

A Proposal can only be inserted when:

1. OOS integrity is exactly FROZEN_PASS.
2. release_id and dataset_fingerprint equal the frozen OOS artifact.
3. protocol/source/target versions match the frozen Promotion contract.
4. Promotion readiness is true for that same release/fingerprint.
5. exactly two modes exist and both pass.
6. created_at is set by the database at insert time.

The existing private create_stock_hunter_promotion_proposal_v416 function remains postgres/manual-only. Proposal audit rows remain immutable and API-read-only.

## Activation Review guard

Activation Review insertion now independently rechecks:

- OOS integrity = FROZEN_PASS;
- Proposal exists;
- release/fingerprint match both Proposal and frozen OOS release;
- champion = 4.1.6-hunt-v2;
- challenger = 4.1.7-proposed;
- production_activated = false;
- Forward Shadow readiness is true for that exact Proposal/release/fingerprint;
- activation control is still unbound CHAMPION_ONLY / 0% / kill-switch ON.

reviewed_at is set by the database.

The existing create_stock_hunter_activation_review_v417 function still performs the intentional non-traffic state binding after Review creation:

- activation_review_id becomes the new Review;
- state_version increments;
- last_transition becomes REVIEW_BOUND_FOR_TELEMETRY.

This binds later telemetry/Admission to the Review but does not start Challenger traffic.

## Frozen rollout thresholds

The live rollout policy remains:

- min_fresh_trade_dates = 10
- min_selected_per_mode = 30
- min_coverage_ratio = 0.5
- min_utility_lift = 0.03
- min_return_lift_3d_pct = 0.03
- max_mae_deterioration_3d_pct = 0.10
- max_positive_rate_deterioration_pp = 2.5
- require_both_modes = true
- auto_activate = false

Promotion auto_promote remains false.

## Negative controls

Live calls to both manual entry functions were attempted before OOS FROZEN_PASS:

- create_stock_hunter_promotion_proposal_v416(...)
- create_stock_hunter_activation_review_v417(...)

Both were rejected.

After the probes:

- proposals = 0
- Forward Shadow = 0
- Reviews = 0
- activation events = 0
- activation status is byte-for-byte unchanged.

## Verification

Reusable live verifier:

stock-hunter-promotion-forward-shadow-live-close-v417: PASS

Regression verification:

- stock-hunter-oos-live-close-v416: PASS
- stock-hunter-canary-admission-maturity-v417: PASS

The verifier also fails if Forward Shadow ever regresses back to frozen Calibration or stock_hunter_candidate_scores_v416.

## Security

Supabase Security Advisor reported no new WARN/ERROR after this migration.

The only remaining INFO is the existing rls_enabled_no_policy notice on private.stock_hunter_canary_expansion_authorizations_v417.

The Proposal and Activation Review tables remain read-only to anon/authenticated/service_role. Manual creation functions remain unavailable to those roles.

The unified stock_hunter_promotion_forward_shadow_gate_v417 view is service-role-only and security_invoker.

## Completion semantics

Roadmap item #9 is now live-closed structurally.

Real progression remains intentionally blocked until:

1. natural maturity and robustness make OOS releasable;
2. the one-time manual OOS release completes with FROZEN_PASS;
3. both Promotion OOS modes pass;
4. an operator records the single manual Proposal;
5. post-Proposal raw prospective outcomes accumulate for at least the frozen Forward Shadow thresholds;
6. an operator records the non-activating Activation Review.

No step in this migration automatically advances traffic.
