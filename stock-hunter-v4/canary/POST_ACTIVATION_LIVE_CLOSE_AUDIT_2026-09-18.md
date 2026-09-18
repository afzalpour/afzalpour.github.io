# Stock Hunter 4.1.7 Post-Activation Live Closure

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_POST_ACTIVATION_STABILITY_NOT_STARTED
TARGET_PROJECT: summnepwuziwulzvpcms
LIVE_MIGRATION: 20260918124656 stock_hunter_post_activation_live_close_20260918
CONTRACT: MANUAL_POST_ACTIVATION_STABILITY_WITH_416_ROLLBACK_TARGET

## Current live state

No Full Activation, rollback, release-pin preparation, finalization, or version-promotion action was performed.

Current state remains:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- state_version = 1
- activation events = 0
- release-pin manifests = 0
- stabilization_ready_for_version_promotion = false
- stabilization_reason = NOT_AT_FULL_ACTIVATION

## Existing hardening retained

The earlier Post-Activation hardening already provided:

- an immutable policy trigger;
- a frozen CHECK contract;
- a security_invoker monitor;
- read-only Data API ACLs;
- prospective current Review/state_version telemetry filtering;
- automatic rollback OFF;
- automatic finalization OFF;
- 4.1.6 rollback target preservation.

This live-close migration complements that implementation rather than recreating it.

## Frozen stability policy

The live policy remains:

- protocol = 4.1.7-post-activation-v1
- minimum stability trade dates = 5
- minimum pairs per mode = 500
- minimum symbols per mode = 75
- minimum buckets per mode = 8
- maximum evidence age = 15 minutes
- required recommendation = PASS
- auto_rollback = false
- auto_finalize = false

The policy is immutable and read-only to anon/authenticated/service_role.

## Structural recommendation mismatch fixed

Before this live-close, the monitor counted latest rows from stock_hunter_canary_telemetry_recommendation_v417 where recommendation='PASS'.

That source does not emit PASS for healthy telemetry. Its healthy state is STABLE.

This made the post-activation stability gate structurally unreachable even after five healthy trade dates.

The monitor now normalizes only:

STABLE -> PASS

inside the post-activation stability contract.

Unsafe or immature states remain non-PASS:

- INSUFFICIENT_DATA
- HOLD_CANARY
- KILL_SWITCH_RECOMMENDED

latest_recommendations now reflects the normalized post-activation contract.

## Two-mode freshness hardening

The previous pass_freshness only required a fresh telemetry capture heartbeat.

The live-close now requires all of these to be within the frozen 15-minute window:

1. telemetry health last_success_at;
2. the latest routed observation for each mode;
3. the latest recommendation evidence for each mode.

The routed and recommendation evidence must also be at or after the current Full Activation transition.

The gate therefore cannot mature on:

- a fresh capture heartbeat with stale routed observations;
- one fresh mode and one stale mode;
- fresh routed observations with stale recommendation evidence.

Explicit failure reasons include:

- POST_ACTIVATION_TELEMETRY_STALE
- POST_ACTIVATION_ROUTED_EVIDENCE_STALE
- POST_ACTIVATION_RECOMMENDATION_EVIDENCE_STALE

## Prospective stability boundary

Coverage evidence is still restricted to telemetry that:

- matches the current activation_review_id;
- matches the current activation state_version;
- has observed_at >= current last_transition_at;
- belongs to reversal or acceleration.

For each mode the monitor independently requires:

- 5 stability trade dates;
- 500 pairs;
- 75 symbols;
- 8 time buckets.

No pre-Full-Activation Canary evidence can satisfy the stability gate.

## Rollback target is operational

The rollback target remains exactly:

4.1.6-hunt-v2

This is not only metadata.

private.rollback_stock_hunter_canary_v417(...) accepts both live routing states:

- CANARY
- CHALLENGER_ONLY

and on manual rollback moves the system to:

- routing_mode = ROLLED_BACK
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- state_version incremented

The function is postgres-only and state-version checked.

private.kill_switch_stock_hunter_v417(...) is also postgres-only.

There is no automatic rollback cron.

## Capture continuity after 100%

public.capture_stock_hunter_canary_telemetry_v417() does not require routing_mode='CANARY'.

As long as the Activation Review remains bound, it continues to:

- read the active Review/state_version;
- score the frozen challenger;
- capture telemetry;
- write the current state_version.

Therefore prospective post-activation evidence can continue accumulating after a real CHALLENGER_ONLY / 100% transition.

## Recovery / incident state

The existing activation recovery sync trigger explicitly recognizes CHALLENGER_ONLY / 100%.

At Full Activation it binds recovery status to the new state_version and enters MONITORING with:

- no active incident;
- zero healthy-capture streak;
- POST_ACTIVATION_OBSERVING marker.

Post-activation stability requires:

- Review/state_version match;
- recovery_state in MONITORING or RECOVERED;
- incident_started_at is null;
- current Review has not been retired by rollback.

## Release-pin compatibility

private.prepare_stock_hunter_release_pin_v417(...) consumes the full 54-column stock_hunter_post_activation_monitor_v417 row type.

The live-close preserved that 54-column interface.

Release preparation still fails unless:

stabilization_ready_for_version_promotion = true

The release-pin function is postgres-only.

Current release-pin state remains:

- target_release_version = 4.1.7
- previous_stable_version = 4.1.6
- auto_freeze = false
- manifests = 0

No release-pin action was performed in this step.

## Negative controls

Two live negative controls were executed from the current safe pre-activation state.

1. A no-op UPDATE against the post-activation policy was rejected by the frozen policy trigger.
2. A manual rollback request was rejected because the system is not in CANARY or CHALLENGER_ONLY routing.

After both probes:

- activation state was unchanged;
- activation event count remained 0.

## Verification

Reusable live verifier:

stock-hunter-post-activation-live-close-v417: PASS

Legacy monitoring verifier, upgraded to semantic rather than alias-specific view matching:

stock-hunter-post-activation-monitoring-v417: PASS

Regression verifiers:

- stock-hunter-full-activation-live-close-v417: PASS
- stock-hunter-staged-canary-live-close-v417: PASS
- stock-hunter-canary-admission-maturity-v417: PASS
- stock-hunter-promotion-forward-shadow-live-close-v417: PASS

## Security Advisor

No new WARN/ERROR was introduced.

The only remaining finding is the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417.

That table remains private/API-denied; no cosmetic allow policy was added.

## Completion semantics

Roadmap item #13 is live-closed structurally.

Real post-activation stability remains naturally pending because no real Full Activation has occurred.

Final release pinning must remain blocked until the system reaches a real CHALLENGER_ONLY / 100% state and the current Review/state accumulates all frozen five-day, two-mode, fresh evidence requirements with no unresolved incident and with automatic rollback/finalization still OFF.
