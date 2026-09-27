# Stock Hunter 4.1.7 Staged Real Canary Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_CANARY_NOT_STARTED
CONTRACT: MANUAL_STATE_BOUND_ONE_SHOT_5_10_25_50

## Live state

Production remains fully on the 4.1.6 champion path:

- `routing_mode = CHAMPION_ONLY`
- `challenger_traffic_percent = 0`
- `kill_switch_engaged = true`
- `activation_review_id = null`
- `authorization_id = null`
- `state_version = 1`
- activation authorizations = 0
- initial authorization consumptions = 0
- expansion authorizations = 0
- activation events = 0

No 5% Canary was started and no synthetic Review, Admission telemetry, authorization, expansion authorization or event was created.

Current Admission state is intentionally blocked:

- `admission_ready = false`
- `admission_reason = NO_ACTIVATION_REVIEW_BOUND`
- per-mode pairs = 0 / 100
- per-mode symbols = 0 / 30
- per-mode buckets = 0 / 3
- required Recommendation = `PASS`
- max telemetry age = 20 minutes
- `auto_start = false`

## Frozen staged path

The live activation policy requires exactly:

`5% -> 10% -> 25% -> 50%`

The first stage is fixed at 5%. Full activation is a separate gate and is not part of this step.

Expansion thresholds are frozen as:

| From | To | Min duration | Min routed pairs/mode | Min routed symbols/mode | Min routed buckets/mode | Max telemetry age |
|---:|---:|---:|---:|---:|---:|---:|
| 5% | 10% | 30 min | 30 | 10 | 3 | 20 min |
| 10% | 25% | 45 min | 60 | 15 | 4 | 20 min |
| 25% | 50% | 60 min | 100 | 25 | 6 | 20 min |

All stages require the current divergence recommendation to remain `PASS`.

Automation remains disabled:

- `auto_start = false`
- `auto_expand = false`
- `auto_activate = false`
- `auto_recover = false`
- `auto_rollback = false`

## Initial 5% one-shot hardening

Audit found that expansion authorizations already had explicit state-version binding and `consumed_at`, but the initial `APPROVE_CANARY` authorization relied on Review uniqueness and safe-state checks rather than an explicit consumption ledger.

Migration `stock_hunter_staged_canary_one_shot_20260918` adds:

`private.stock_hunter_activation_authorization_consumptions_v417`

Each successful initial Canary start now atomically records:

- authorization id
- review id
- from state version
- to state version
- full status-before snapshot
- full status-after snapshot
- consumption timestamp

The ledger is private, API-denied, RLS-protected and immutable after insert.

`private.start_stock_hunter_canary_v417(...)` now additionally requires:

1. exact frozen `5,10,25,50` activation policy;
2. runtime routing enabled;
3. manual Review and manual authorization enabled;
4. auto activation/expansion disabled;
5. exact expected state version;
6. review-bound Champion-only safe state;
7. an `APPROVE_CANARY` authorization whose frozen status snapshot has the same state version and Review;
8. an authorization whose frozen Admission snapshot was `admission_ready=true` for the same Review;
9. no prior consumption row for that authorization;
10. a fresh live Admission recheck immediately before traffic mutation.

The state mutation, one-shot consumption and `CANARY_STARTED` audit event execute in the same PostgreSQL transaction. Any failure rolls the whole transition back.

## Expansion one-shot contract

Existing live expansion control already enforces:

- exact next-step policy lookup; arbitrary percentage jumps fail;
- expected state-version match;
- active Canary state required;
- Review match required;
- stage duration, routed pairs, routed symbols and routed buckets required;
- fresh telemetry required;
- `PASS` recommendation required;
- separate one-time expansion authorization for the current state version;
- authorization `consumed_at` update on successful expansion;
- Recovery Gate check both when approving expansion and again on the status transition;
- same Review cannot re-enter after rollback.

The manual mutation functions are executable by `postgres` only; `anon`, `authenticated`, and `service_role` cannot authorize, start, expand, or rollback the Canary.

## Negative controls

Two live negative controls were executed without synthetic data:

1. initial `start(5%)` with no bound Review/Admission;
2. `advance(10%)` while still in Champion-only state.

Both were rejected. After the probes, routing mode, traffic percent, kill switch, state version, Review id, authorization id and all authorization/event counts remained unchanged.

Reusable verifier result:

`stock-hunter-staged-canary-v417: PASS`

## Security Advisor

After the migration, Supabase Security Advisor reported no new warning/error. The only remaining notice is the pre-existing INFO `rls_enabled_no_policy` on the private table `private.stock_hunter_canary_expansion_authorizations_v417`. The table has no API grants and is intentionally private; this step did not weaken that access model.

## Migration history note

The idempotent migration payload was submitted twice during verification, producing two migration-history versions with the same name:

- `20260917221339 stock_hunter_staged_canary_one_shot_20260918`
- `20260917221514 stock_hunter_staged_canary_one_shot_20260918`

The second execution made no additional logical schema change because table creation, policies/triggers and function replacement are idempotent. Supabase internal migration history was deliberately not edited manually after the duplicate submission.

## Completion semantics

This step is structurally and live-contract complete, but no real Canary is running. Actual 5% traffic remains correctly blocked until a real Activation Review exists and Admission reaches natural maturity from prospective telemetry.

The next roadmap gate is the independent `50% -> 100%` Full Activation Gate. It must remain separate from staged expansion and requires its own authorization and stricter readiness criteria.
