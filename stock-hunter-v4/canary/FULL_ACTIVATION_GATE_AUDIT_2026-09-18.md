# Stock Hunter 4.1.7 Independent Full Activation Gate Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_FULL_ACTIVATION_NOT_STARTED
CONTRACT: INDEPENDENT_MANUAL_ONE_SHOT_50_TO_100

## Live state

Production remains on the 4.1.6 champion path:

- `routing_mode = CHAMPION_ONLY`
- `challenger_traffic_percent = 0`
- `kill_switch_engaged = true`
- `activation_review_id = null`
- `authorization_id = null`
- `state_version = 1`
- full-activation authorizations = 0
- `CHALLENGER_FULL_ACTIVATED` events = 0

No synthetic Review, telemetry, authorization, Canary stage, or 100% activation was created.

Current readiness is intentionally fail-closed:

- `full_activation_ready = false`
- `full_activation_reason = NO_ACTIVATION_REVIEW_BOUND`
- `pass_exact_50_stage = false`

## Independent strict gate

Full activation is not the next ordinary expansion step. It requires an exact active 50% Canary and a separate authorization.

Frozen Full Activation policy after hardening:

| Criterion | Full Activation | Prior 25% -> 50% stage |
|---|---:|---:|
| Minimum stage duration | 120 min | 60 min |
| Routed pairs / mode | 250 | 100 |
| Routed symbols / mode | 50 | 25 |
| Routed buckets / mode | 8 | 6 |
| Maximum telemetry age | 15 min | 20 min |
| Required recommendation | PASS | PASS |

The Full Activation gate is therefore strictly stronger in every numeric coverage/freshness dimension than the final staged expansion gate.

Additional readiness requirements already present in the live gate remain mandatory:

- both hunt modes;
- exact 50% active Canary;
- current Activation Review bound;
- current-state telemetry binding;
- both mode recommendations = PASS;
- Hold/Rollback gate clear;
- Recovery state bound to the current stage and clear;
- no automatic action taken;
- `auto_activate = false`.

## Policy immutability and ACL hardening

Migration `stock_hunter_full_activation_gate_hardening_20260918` was applied once as live migration version `20260917222508`.

It:

- raises `min_routed_buckets_per_mode` from 5 to 8;
- adds a database CHECK enforcing the strict Full Activation floor;
- freezes the Full Activation policy with an immutable trigger;
- removes all write privileges from `anon`, `authenticated`, and `service_role`;
- keeps policy/readiness as read-only surfaces;
- explicitly keeps `stock_hunter_full_activation_readiness_v417` as `security_invoker=true`.

## Separate one-time authorization

`private.authorize_stock_hunter_full_activation_v417(...)` is executable only by `postgres` and now explicitly requires:

1. frozen Full Activation policy values;
2. expected `state_version` match;
3. active review-bound Canary;
4. exact 50% traffic;
5. live `full_activation_ready=true`;
6. readiness bound to the same Review, state version, and exact 50% stage.

The authorization stores immutable readiness and status snapshots.

`private.stock_hunter_full_activation_authorizations_v417` remains private and API-denied. A guard now makes all audit fields immutable; the only permitted update is one transition of `consumed_at` from NULL to a timestamp. Delete and truncate are rejected.

A unique partial index continues to allow only one open authorization per `(review_id, state_version)`.

## 100% activation recheck

`private.activate_stock_hunter_challenger_v417(...)` now requires, in the same transaction:

- runtime routing enabled;
- auto activation disabled;
- exact current state version;
- exact active 50% Canary;
- Review bound;
- fresh live Full Activation readiness PASS;
- an unconsumed one-time Full Activation authorization for the same Review/state;
- frozen authorization readiness snapshot with `full_activation_ready=true` for the same Review/state/50%;
- frozen authorization status snapshot for the same Review/state/50%.

Only then does the transaction switch routing to `CHALLENGER_ONLY / 100%`, increment state version once, consume the authorization once, and append one `CHALLENGER_FULL_ACTIVATED` event. Any failure rolls the transaction back.

## Negative controls

Two live negative controls were executed from the current Champion-only state:

1. attempt to create Full Activation authorization;
2. attempt to activate the challenger to 100%.

Both were rejected. After the probes:

- traffic remained 0%;
- routing remained `CHAMPION_ONLY`;
- state version remained 1;
- full-activation authorization count remained 0;
- full-activation event count remained 0.

Reusable verifier result:

`stock-hunter-full-activation-gate-v417: PASS`

## Security Advisor

After DDL, Security Advisor reported no new warning/error. The only remaining notice is the pre-existing INFO `rls_enabled_no_policy` on `private.stock_hunter_canary_expansion_authorizations_v417`, which is private/API-denied and was not weakened by this step.

## Completion semantics

This step is live-contract complete. It does not authorize or perform a real 100% activation. Actual Full Activation remains unreachable until the entire prospective path reaches a real 50% Canary and the stricter independent readiness gate naturally passes.

The next roadmap step is Post-Activation Monitoring. Its live contract may already exist, but must be inspected before any new DDL. It must preserve 4.1.6 as rollback target, keep automatic rollback disabled, and require prospective stabilization evidence before final version pinning.
