# Stock Hunter 4.1.7 — Release Hardening State (2026-09-17)

This file is the operational handoff for the 4.1.6 → 4.1.7 promotion path. It records only verified implementation state. It must not be used to bypass prospective-data, OOS, review, authorization, canary, or stabilization gates.

## Production baseline

- Production branch: `main`
- Baseline/champion engine: `4.1.6-hunt-v2`
- Challenger label while under evaluation: `4.1.7-proposed`
- Runtime state after drills was restored to `CHAMPION_ONLY`, `0%`, kill switch engaged, `state_version=1`, transition `INITIAL_CHAMPION_LOCK`.
- Allowed Hunt modes remain `reversal` and `acceleration` only. The 10-day models are display-only.
- No synthetic/backfilled Hunt, Calibration, OOS, Shadow, Review, or Canary samples may be inserted.

## Verified hardening completed

### Browser ↔ Backend parity / Capture auth

The parity workflow compares browser fixtures to the deployed capture backend and asserts deep equality. Capture POST requires the custom capture token; missing/wrong token returns 401 before scan/claim work begins. `verify_jwt=false` is retained only because custom caller authentication is performed in the function.

### Security Advisor cleanup

Migration `stock_hunter_security_advisor_cleanup_20260917` fixed the three legacy findings without dropping dependencies:

- `stock_hunter_normalize_fa_v4(text)` now has a fixed `search_path`.
- Direct `PUBLIC/anon/authenticated` EXECUTE was removed from `stock_hunter_feed_status_v4()` and `stock_hunter_sync_signal_to_universe_v4()`; service-role access remains.
- The sync trigger and normalized-search column default remain intact.

Current Security Advisor has no ERROR from those findings. The remaining INFO is the private canary-expansion authorization table with RLS enabled and no policy; it is intentionally not exposed to anon/authenticated.

### Reversal outcome refinement

Migrations:

- `stock_hunter_reversal_reference_tracking_20260917`
- `stock_hunter_reference_capture_trigger_20260917`
- `stock_hunter_shadow_reference_preserve_insert_contract_20260917`

Prospective Hunt Events and Shadow Samples now capture `reference_yesterday_price`. Existing historical rows remain NULL by design. Outcome views expose:

- `reference_yesterday_price`
- `reversal_crossed_reference_same_day`
- `reversal_closed_above_reference_same_day`

The reference is reconstructed at INSERT from the same snapshot (`price / (1 + day_change/100)`) if not explicitly supplied; no future information is used.

### Control Plane partial-failure drill

A temporary audit failpoint was installed only for the drill and then removed. The real rollback transition was forced to fail at the audit insert after its in-transaction state mutation. Result:

- exception: forced audit failure
- activation state remained at the pre-call drill state
- no drill audit row was committed

This proves transaction rollback prevents a `state changed / audit missing` half-state on the tested transition path.

Temporary probe objects were removed by `stock_hunter_control_plane_probe_cleanup_20260917`.

### Real concurrency / lock contention drill

Two independent PostgreSQL sessions were launched through `pg_cron`, both calling the real rollback transition with the same `expected_state_version=1001`.

Observed result:

- exactly one winner committed `state_version=1002` / `ROLLED_BACK`
- exactly one loser failed cleanly with `activation state version mismatch`
- exactly one activation audit row was produced
- test jobs self-unscheduled
- drill audit rows/helpers were removed
- activation and recovery state were restored to the original production baseline

Separate stale-version calls for Start, Advance, and Rollback also failed before mutation with the same state-version mismatch.

## Full Activation Gate: 50% → 100%

Migration: `stock_hunter_full_activation_gate_v417_20260917`

The old direct 50→100 path was replaced by a separate gate plus one-time authorization. Defaults:

- exact pre-full stage: `50%`
- minimum stage observation: `120 minutes`
- minimum routed pairs per mode: `250`
- minimum symbols per mode: `50`
- minimum time buckets per mode: `5`
- maximum telemetry age: `15 minutes`
- both Hunt modes must have current recommendation `PASS`
- Hold/Rollback/Kill guards must be clear
- Recovery must be synchronized and clear
- separate one-time Full Activation authorization is mandatory
- `auto_activate=false`

The 100% transition rechecks readiness and consumes the authorization atomically with state change + audit.

## Post-Activation stabilization

Migration: `stock_hunter_post_activation_stability_v417_20260917`

After `CHALLENGER_ONLY=100%`, paired telemetry continues because the telemetry capture function is review-bound rather than CANARY-only. Recovery is synchronized to the new post-activation `state_version`.

The post-activation monitor requires, for each mode and for the current post-activation state only:

- at least `5` trading dates
- at least `500` paired observations
- at least `75` symbols
- at least `8` time buckets
- telemetry freshness ≤ `15 minutes`
- latest recommendation for both modes = `PASS`
- no unresolved recovery/rollback incident
- previous champion remains the rollback target
- `auto_rollback=false`
- `auto_finalize=false`

Only then can `stabilization_ready_for_version_promotion=true`.

## Final Release Pin Gate

Migrations:

- `stock_hunter_release_pin_gate_v417_20260917`
- `stock_hunter_release_pin_readiness_service_only_20260917`

A release manifest cannot be prepared until Post-Activation stabilization passes. The final `4.1.7` manifest must pin all of the following together:

- full Git commit SHA
- engine asset release tag `4.1.7`
- dashboard release tag `4.1.7`
- Service Worker cache in the `shikar-sahm-v4.1.7-*` family
- capture function slug `stock-hunter-capture-v417`
- capture deployment version and release tag `4.1.7`
- audit release tag `4.1.7`
- activation review / state version / proposal / dataset fingerprint
- previous stable release `4.1.6`

`auto_freeze=false`. The previous stable archive table exists so 4.1.6 is archived, never deleted. The actual coordinated frontend/capture pin and final manual freeze must not happen before all upstream gates pass.

## Gates intentionally still blocked by real data

As of this handoff:

- Hunt Events: `0`
- Shadow Samples: `0`
- OOS release manifests/results: `0`
- Promotion Proposals: `0`
- Activation Reviews: `0`
- Canary Telemetry rows: `0`
- Calibration readiness: `false`
- OOS unlock: `false`
- Promotion readiness: `false`
- Canary admission readiness: `false`

Therefore the following sequence must remain blocked and abstaining until genuine prospective market sessions provide data:

`Prospective Hunt Ledger → Calibration/Validation/Robustness → one-shot OOS → Promotion Proposal → Forward Shadow → Activation Review → Canary Admission → 5% → 10% → 25% → 50% → Full Activation Authorization → 100% → Post-Activation Stabilization → coordinated 4.1.7 release pin/freeze`.

## Legacy security follow-up (newly discovered)

The active legacy Edge Function `stock-hunter-market-scan-v4` still uses a legacy embedded caller credential. No repository or pg_cron consumer was found during this review, but an external caller may exist. Do **not** disable or rotate it blindly. Migrate the credential to Vault/custom validation (or retire the function only after caller verification). Never copy the credential into this repository or documentation.

## Dashboard follow-up

`rollout-v417` currently visualizes Forward Shadow / Canary telemetry but does not yet expose dedicated cards for:

- Full Activation 50→100 readiness
- Post-Activation stabilization readiness
- service-only Final Release Pin readiness

These are observability/UI tasks only; backend safety gates are already enforced in PostgreSQL.
