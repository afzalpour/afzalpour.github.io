# Stock Hunter 4.1.7 Post-Activation Monitoring Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_POST_ACTIVATION_STABILITY_NOT_STARTED
CONTRACT: MANUAL_POST_ACTIVATION_STABILITY_WITH_416_ROLLBACK_TARGET

## Live state

Production remains before Full Activation:

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- state_version = 1
- activation_review_id = null
- post-activation stabilization ready = false
- stabilization reason = NOT_AT_FULL_ACTIVATION
- release-pin manifests = 0

No synthetic Full Activation, post-activation telemetry, incident, release manifest, or version-promotion evidence was created.

## Frozen stabilization policy

The live Post-Activation policy remains:

- protocol = 4.1.7-post-activation-v1
- minimum stability trade dates = 5
- minimum pairs per mode = 500
- minimum symbols per mode = 75
- minimum buckets per mode = 8
- maximum telemetry age = 15 minutes
- required recommendation = PASS
- auto_rollback = false
- auto_finalize = false

Migration stock_hunter_post_activation_monitoring_hardening_20260918 was applied once as version 20260918074636.

It freezes the policy with a database CHECK plus an immutable trigger, removes write privileges from anon/authenticated/service_role, and keeps the policy and monitor as read-only public surfaces.

## Prospective evidence boundary

stock_hunter_post_activation_monitor_v417 is security_invoker=true.

For coverage metrics it only counts telemetry that:

1. matches the current activation_review_id;
2. matches the current activation state_version;
3. has observed_at >= the current state's last_transition_at.

This prevents pre-full-activation Canary telemetry or a previous activation state from satisfying post-activation stabilization.

The monitor also requires:

- both hunt modes;
- at least 5 distinct trade dates per mode;
- the frozen sample/symbol/bucket thresholds;
- fresh telemetry for the current Review;
- latest recommendation PASS for both modes;
- no unresolved recovery incident;
- rollback/recovery state bound to the current activation state;
- automatic rollback disabled;
- automatic finalization disabled.

## Rollback target

The preserved rollback target remains:

4.1.6-hunt-v2

The live monitor currently reports:

- pass_rollback_target_preserved = true
- pass_automatic_rollback_off = true
- automatic_action_taken = false

4.1.7 remains the proposed challenger until final release pinning. This step does not overwrite the 4.1.6 rollback target.

## Negative control

A live call to private.prepare_stock_hunter_release_pin_v417(...) was attempted from the current Champion-only state.

It failed at the post-activation stabilization gate with no manifest residue. Manifest count remained zero.

Reusable verifier result:

stock-hunter-post-activation-monitoring-v417: PASS

## Security

After DDL, Supabase Security Advisor reported no new WARN/ERROR. The only notice remains the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417. That table remains private/API-denied and this migration did not alter it.

## Completion semantics

The Post-Activation Monitoring contract is live-complete, but prospective stability evidence does not yet exist because no real Full Activation has occurred.

Final version pinning must remain blocked until:

- the system reaches a real CHALLENGER_ONLY / 100% state;
- the current Review/state accumulates the frozen prospective stabilization evidence;
- both modes remain PASS;
- no unresolved incident exists;
- automatic rollback remains OFF;
- 4.1.6 remains the rollback target.

The next roadmap step is Final Version Promotion / Pinning for all 4.1.7 components and archival of the 4.1.6 rollback package only after the release-pin gate is naturally ready.
