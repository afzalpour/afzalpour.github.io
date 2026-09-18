# Stock Hunter 4.1.7 Staged Canary Live Closure Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_CANARY_NOT_STARTED
TARGET_PROJECT: summnepwuziwulzvpcms
LIVE_MIGRATION: 20260918085347 stock_hunter_staged_canary_live_close_20260918
CONTRACT: MANUAL_5_10_25_50_STAGE_SCOPED_RECOVERY_GATED

## Current live state

No real Canary action was taken.

- routing_mode = CHAMPION_ONLY
- challenger_traffic_percent = 0
- kill_switch_engaged = true
- activation_review_id = null
- state_version = 1
- activation authorizations = 0
- expansion authorizations = 0
- activation events = 0
- expansion_ready = false
- expansion_reason = NO_ACTIVATION_REVIEW_BOUND

runtime_routing_enabled was already true before this step. This migration did not enable it. Browser routing still fails closed because the control-plane state is CHAMPION_ONLY / 0% / kill-switch engaged and no Activation Review is bound.

## Frozen staged policy

Initial Canary:

5%

Only the following staged transitions exist:

- 5 -> 10: 30 minutes, 30 routed pairs/mode, 10 symbols/mode, 3 buckets/mode
- 10 -> 25: 45 minutes, 60 routed pairs/mode, 15 symbols/mode, 4 buckets/mode
- 25 -> 50: 60 minutes, 100 routed pairs/mode, 25 symbols/mode, 6 buckets/mode

All stages require:

- max telemetry age = 20 minutes
- recommendation = PASS
- auto_expand = false

Initial start remains manual and rechecks Canary Admission at execution time. First start is constrained to exactly 5%.

Expansion authorization remains state-version/review/from/to bound and one-shot. Advance rechecks the live Expansion gate before consuming the authorization.

## Gap 1: routed-evidence freshness

Before this migration, stock_hunter_canary_expansion_readiness_v417 used telemetry_health.last_success_at as pass_freshness.

The Expansion monitor already calculated last_routed_observed_at, but readiness did not require it to be fresh.

That allowed a theoretical state where the telemetry capture heartbeat was fresh while the evidence satisfying routed pairs/symbols/buckets was old.

The live gate now requires both:

- telemetry health last_success_at is within max_telemetry_age_minutes;
- last_routed_observed_at is within max_telemetry_age_minutes and belongs to the current stage.

A distinct failure state is now exposed:

ROUTED_EVIDENCE_STALE

The browser Expansion surface understands and displays this reason.

## Gap 2: stage-version binding

The staged metrics previously scoped rows by:

- current Activation Review;
- observed_at >= current last_transition_at;
- current deterministic route bucket.

The metrics now additionally require:

telemetry.state_version = activation_status.state_version

This prevents evidence from a different control-plane state version from satisfying a later stage.

## Read-only observability ACL closure

The following security_invoker views are now explicitly SELECT-only for anon/authenticated/service_role:

- stock_hunter_canary_expansion_stage_metrics_v417
- stock_hunter_canary_expansion_readiness_v417
- stock_hunter_canary_expansion_monitor_v417
- stock_hunter_canary_hold_rollback_gate_v417
- stock_hunter_canary_recovery_gate_v417

Legacy DML grants on those views were removed.

## Recovery / rollback contract

The existing Hold/Rollback policy remains:

- HOLD stale after 20 minutes
- rollback stale after 40 minutes
- minimum rollback evidence = 30 routed pairs/mode
- capture error can HOLD
- severe divergence can recommend rollback
- auto_rollback = false

The existing Recovery policy remains:

- cooldown = 15 minutes
- 3 consecutive healthy PASS captures
- max healthy capture gap = 10 minutes
- same Review re-entry after rollback = blocked
- auto_recover = false

Recovery guards remain installed on both expansion authorization and activation-status transitions.

## Manual mutator security

These functions remain postgres-only:

- authorize_stock_hunter_canary_v417
- start_stock_hunter_canary_v417
- authorize_stock_hunter_canary_expansion_v417
- advance_stock_hunter_canary_v417
- rollback_stock_hunter_canary_v417

anon/authenticated/service_role cannot execute them.

There is no active cron invoking Canary authorization, start, advance, rollback, or full activation.

## Deterministic routing parity

SQL and browser routing both implement FNV-1a 32-bit on the ASCII key:

YYYY-MM-DD|numeric_symbol_id

followed by modulo 100.

Frozen parity fixtures:

- 2026-09-19|1 -> 65
- 2026-09-19|12345 -> 49
- 2026-09-20|12345 -> 97
- 2026-10-01|987654321 -> 82

The repository CI runs these fixtures against hunt-runtime-core-v417.js.

## Live verification

Reusable verifier:

stock-hunter-staged-canary-live-close-v417: PASS

Regression verifiers:

- stock-hunter-oos-live-close-v416: PASS
- stock-hunter-promotion-forward-shadow-live-close-v417: PASS
- stock-hunter-canary-admission-maturity-v417: PASS

No authorization/event/traffic residue was created.

## Security Advisor

No new WARN/ERROR was introduced.

The only remaining finding is the pre-existing INFO rls_enabled_no_policy on private.stock_hunter_canary_expansion_authorizations_v417. The table is private and has no API privileges; no cosmetic allow policy was added.

## Completion semantics

Roadmap item #11 is live-closed structurally.

A real staged Canary remains forbidden until the natural sequence reaches:

OOS FROZEN_PASS -> Promotion Proposal -> mature Forward Shadow -> non-activating Activation Review -> mature Canary Admission -> manual APPROVE_CANARY -> exact 5% start.

Only after fresh stage-scoped routed evidence and Recovery PASS may a separate manual one-shot authorization advance 5 -> 10 -> 25 -> 50.
