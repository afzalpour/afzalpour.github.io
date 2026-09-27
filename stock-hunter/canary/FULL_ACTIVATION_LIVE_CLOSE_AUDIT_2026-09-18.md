# Stock Hunter 4.1.7 Independent Full Activation Live Closure

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_FULL_ACTIVATION_NOT_STARTED
TARGET_PROJECT: summnepwuziwulzvpcms
LIVE_MIGRATION: 20260918090234 stock_hunter_full_activation_live_close_20260918
CONTRACT: EXACT_50_TO_100_SEPARATE_ONE_SHOT_MANUAL_AUTHORIZATION

## Current live state

No Full Activation authorization or traffic transition was created.

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- state_version = 1
- Full Activation authorizations = 0
- activation events = 0
- full_activation_ready = false
- full_activation_reason = NO_ACTIVATION_REVIEW_BOUND

## Frozen Full Activation policy

The live policy remains:

- protocol = 4.1.7-full-activation-v1
- required_from_percent = 50
- min_stage_minutes = 120
- min_routed_pairs_per_mode = 250
- min_routed_symbols_per_mode = 50
- min_routed_buckets_per_mode = 8
- max_telemetry_age_minutes = 15
- required_recommendation = PASS
- auto_activate = false

The policy is immutable.

## Structural blocker found and fixed

Before this closure, Full Activation readiness selected the latest rows from stock_hunter_canary_telemetry_recommendation_v417 and counted rows where recommendation='PASS'.

That telemetry recommendation view does not emit PASS.

Its healthy recommendation is STABLE; other outcomes are INSUFFICIENT_DATA, HOLD_CANARY, and KILL_SWITCH_RECOMMENDED.

Therefore the previous condition requiring two PASS recommendation rows was structurally unreachable even if the 50% Canary was healthy.

The Full Activation gate now normalizes only:

STABLE -> PASS

inside the Full Activation readiness contract.

No unsafe state is normalized:

- INSUFFICIENT_DATA remains non-PASS
- HOLD_CANARY remains non-PASS
- KILL_SWITCH_RECOMMENDED remains non-PASS

The frozen policy continues to require PASS.

## Freshness hardening

The 15-minute Full Activation freshness gate now requires all three evidence clocks to be fresh:

1. telemetry health last_success_at;
2. latest routed evidence at the exact 50% current state;
3. latest normalized recommendation evidence for both modes.

Routed and recommendation evidence must also be at or after the current stage transition.

Explicit failure reasons now include:

- TELEMETRY_STALE
- ROUTED_EVIDENCE_STALE
- RECOMMENDATION_EVIDENCE_STALE

## Exact-state binding

The gate requires:

- routing_mode = CANARY
- challenger_traffic_percent = exactly 50
- kill switch disengaged
- Activation Review bound
- stage duration >= 120 minutes
- telemetry Review binding
- stage metrics Review/state_version/stage_percent binding
- both modes
- >=250 routed pairs/mode
- >=50 routed symbols/mode
- >=8 routed buckets/mode
- both latest mode recommendations normalized to PASS
- Hold/Rollback gate clear
- Recovery state clear
- no automatic actions

The Full Activation readiness view remains a 49-column security_invoker view.

## Independent authorization

private.authorize_stock_hunter_full_activation_v417 is separate from staged Canary expansion authorization.

It requires:

- exact active 50% Canary;
- matching expected state_version;
- live Full Activation readiness PASS;
- readiness bound to the same Review/state/version.

It records a separate Full Activation authorization snapshot/fingerprint.

The private authorization table remains postgres-only.

## 50 -> 100 transition

private.activate_stock_hunter_challenger_v417 independently rechecks the Full Activation gate and current exact 50% state.

It requires one unconsumed authorization for the same Review/state_version/from_percent=50.

The authorization is consumed exactly once when the transition succeeds.

Only then may activation state become:

- routing_mode = CHALLENGER_ONLY
- challenger_traffic_percent = 100
- kill_switch_engaged = false
- state_version incremented

Both authorization and activation functions are postgres-only SECURITY DEFINER functions with an explicit pg_catalog search_path.

No cron invokes either function.

## Runtime semantics

The browser runtime core only routes all eligible Challenger modes when all of these are true:

- routingMode = CHALLENGER_ONLY
- trafficPercent = 100
- killSwitch = false
- runtimeRoutingEnabled = true
- challengerAvailable = true

The CI runtime contract also proves that CHALLENGER_ONLY with 50%, a kill switch, disabled runtime routing, or missing challenger config fails closed.

The browser exposes no activation RPC/POST path.

## Negative controls

Before any real Activation Review, live calls to:

- authorize_stock_hunter_full_activation_v417(...)
- activate_stock_hunter_challenger_v417(...)

were both rejected.

After the probes:

- Full Activation authorizations = 0
- activation events = 0
- activation status is unchanged.

## Verification

Reusable live verifier:

stock-hunter-full-activation-live-close-v417: PASS

Regression verifiers:

- stock-hunter-staged-canary-live-close-v417: PASS
- stock-hunter-canary-admission-maturity-v417: PASS
- stock-hunter-promotion-forward-shadow-live-close-v417: PASS

## Security Advisor

No new WARN/ERROR was introduced.

The only remaining finding is the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417. No cosmetic policy was added.

## Supabase platform compatibility

Current Supabase guidance still requires explicit grants for Data API exposure as platform defaults move away from automatic exposure. This closure preserves explicit SELECT grants on the public Full Activation readiness view and does not expose private mutators or authorization tables.

## Completion semantics

Roadmap item #12 is live-closed structurally.

Real 100% activation remains forbidden until the natural sequence reaches a healthy exact 50% Canary for the full 120-minute observation window, with fresh routed and recommendation evidence, clear Hold/Rollback and Recovery gates, then a separate manual one-shot Full Activation authorization.
