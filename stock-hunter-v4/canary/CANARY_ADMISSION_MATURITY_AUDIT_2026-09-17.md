# Stock Hunter 4.1.7 — Shadow Canary Telemetry / Admission Maturity Audit

AUDIT_DATE: 2026-09-17
STATUS: PASS
LIVE_DDL_APPLIED: YES
LIVE_MIGRATION: 20260917194700 stock_hunter_canary_admission_maturity_hardening_20260917
CONTRACT: REVIEW_BOUND_REAL_DATA_MANUAL_ONLY

## Result

Roadmap step #11 is live-verified and fail-closed.

No Promotion Proposal, Activation Review, Canary authorization, routed Challenger traffic, or synthetic Canary telemetry was created in this step. Current live counts remain:

- Promotion proposals: 0
- Activation reviews: 0
- Canary telemetry rows: 0

The current activation state remains `CHAMPION_ONLY`, challenger traffic is `0%`, and the kill switch is engaged. The Admission gate reports `NO_ACTIVATION_REVIEW_BOUND` and `admission_ready=false`.

These zeros are expected and correct before the preceding OOS / Promotion / Forward Shadow / Activation Review sequence matures.

## Frozen Admission maturity contract

The live policy requires, per mode:

- at least 100 paired Champion/Challenger telemetry rows,
- at least 30 distinct symbols,
- at least 3 distinct time buckets,
- telemetry freshness within 20 minutes,
- telemetry recommendation exactly `PASS`,
- both Reversal and Acceleration modes,
- a bound Activation Review,
- safe Champion-only state while admission is being evaluated.

`auto_start=false`; Canary admission remains manual-only.

## Telemetry divergence contract

The existing telemetry policy remains unchanged:

- minimum pairs before divergence recommendation maturity: 100 per mode,
- status disagreement HOLD: 0.20,
- status disagreement severe: 0.35,
- strong disagreement HOLD: 0.10,
- strong disagreement severe: 0.20,
- P95 absolute score delta HOLD: 15,
- P95 absolute score delta severe: 25,
- extreme status jump HOLD: 0.05,
- extreme status jump severe: 0.12,
- `auto_kill=false`.

This step does not alter any of those thresholds. It freezes them against ad-hoc runtime mutation.

## Gap found and fixed

Two live hardening gaps were found:

1. `stock_hunter_canary_admission_policy_v417` was already immutable, but `stock_hunter_canary_telemetry_policy_v417` was not. Since telemetry thresholds directly influence PASS/HOLD/BLOCK recommendations and therefore Admission, they must not be mutable outside a reviewed migration.
2. `stock_hunter_canary_monitor_v417` retained legacy DML privileges for Data API roles even though it is an operator read-only view.

Migration `20260917194700` fixes both:

- installs `stock_hunter_canary_telemetry_policy_immutable_v417`,
- removes telemetry-policy write privileges from `anon`, `authenticated`, and `service_role`,
- makes Canary monitor/metrics/admission views SELECT-only for Data API roles.

A live mutation probe confirmed that even a no-op UPDATE of the telemetry policy is rejected.

## Prospective / real-data provenance

`capture_stock_hunter_canary_telemetry_v417()` is SECURITY INVOKER, has an empty `search_path`, and is executable only by `service_role` / postgres, not by `anon` or `authenticated`.

The capture path is review-bound and prospective:

- no Activation Review -> `IDLE_NO_CHALLENGER` and no telemetry rows,
- source rows come from `stock_hunter_shadow_samples_v416`,
- only observations at or after the bound Activation Review time are eligible,
- Proposal/Review/candidate configuration is validated before capture,
- both Reversal and Acceleration challenger weights must exist and be valid,
- telemetry is paired by Champion and Challenger calculations from the same shadow observation,
- a unique key prevents duplicate `(trade_date, bucket_minute, symbol_id, activation_review_id)` telemetry pairs.

No historical synthetic backfill is used to green the Admission gate.

## Cron / freshness

The Canary telemetry capture cron remains active:

`stock-hunter-canary-telemetry-v417` -> every 5 minutes on configured market weekdays.

Before a Review is bound, the cron only records the healthy idle state; it does not manufacture telemetry.

## Live verification

Reusable verifier:

`stock-hunter-v4/canary/verify-canary-admission-maturity-v417.sql`

Live result:

`stock-hunter-canary-admission-maturity-v417: PASS`

It verifies policy values, immutable threshold policy, least-privilege ACLs, capture EXECUTE ACLs, review-bound provenance, RLS binding, active cron, and the natural-zero pre-review state.

## Security Advisor

Security Advisor after DDL reports no WARN/ERROR findings for this change.

The only remaining finding is INFO `rls_enabled_no_policy` on `private.stock_hunter_canary_expansion_authorizations_v417`. That table is in the private schema with direct API privileges revoked; no cosmetic allow policy was added solely to silence the informational advisor entry.

## Completion semantics

Step #11 is CLOSED at the protocol/security level.

Maturity itself is intentionally not fabricated. The gate will stay blocked until real prospective data exists after a real Activation Review and both modes naturally reach the frozen 100-pair / 30-symbol / 3-bucket / freshness / PASS requirements.

The next roadmap step is staged real Canary authorization and rollout (`5% -> 10% -> 25% -> 50%`), but it must remain inactive until this Admission gate becomes genuinely ready.
