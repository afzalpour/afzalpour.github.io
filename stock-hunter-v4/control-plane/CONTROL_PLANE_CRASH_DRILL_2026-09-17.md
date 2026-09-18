# Stock Hunter 4.1.7 — Control Plane Crash / Partial-Failure Drill

Status: **MODEL CONTRACT PASS / LIVE_DB_PROOF: PENDING**

## Scope

This drill covers the database-side transitions that can change real runtime routing:

- START: Champion-only → 5% Challenger
- ADVANCE: 5% → 10% → 25% → 50%
- ROLLBACK: active Canary → 0% Challenger

The browser is intentionally out of scope as a writer. The 4.1.7 browser surfaces are SELECT-only and the runtime router consumes `stock_hunter_activation_status_v417` as read-only state.

## Atomicity invariants

A transition is accepted as atomic only if all of the following belong to one PostgreSQL transaction and become visible together:

1. advisory lock / transition serialization;
2. `state_version` precondition check;
3. manual one-shot authorization validation and consumption;
4. routing mutation (`routing_mode`, `challenger_traffic_percent`, `kill_switch_engaged` as applicable);
5. `state_version` increment and transition metadata;
6. audit event insert;
7. any hold/recovery ancillary state required by that transition.

A forced error at any point must leave **all** externally visible state exactly equal to the pre-transition snapshot. In particular, these states are forbidden:

- traffic changed but authorization is still reusable;
- authorization consumed but traffic/state did not change;
- audit row exists without the corresponding state transition;
- `state_version` advanced without the routing mutation;
- rollback traffic reached 0% but recovery/hold metadata was only partially written.

## CI model drill

`atomicity-model-v417.cjs` injects a crash at five transaction boundaries for START, every current ADVANCE stage, and ROLLBACK:

- `AFTER_LOCK_AND_PRECONDITIONS`
- `AFTER_AUTHORIZATION_CONSUME`
- `AFTER_ROUTING_MUTATION`
- `AFTER_STATE_VERSION_MUTATION`
- `AFTER_AUDIT_INSERT`

The model currently executes 25 forced-crash assertions plus successful-transition, one-shot authorization, and stale-`state_version` assertions. A failed model assertion must block further control-plane work.

## Live PostgreSQL drill — required before this item can be closed

The live proof must run against the **actual Stock Hunter Supabase project**, not another connected Supabase project. The currently connected Supabase environment in this ChatGPT project does not contain the Stock Hunter control-plane objects, so no live mutation or migration was attempted.

Before executing the live drill, identify from `pg_proc` and `pg_catalog` the private RPC/function(s) that implement START, ADVANCE and ROLLBACK, plus the authorization and audit tables used by those functions. Do not guess object names and do not expose a new public fault-injection RPC.

For each transition, take an exact pre-snapshot of activation status, the authorization row, audit cardinality/content, and transition-specific hold/recovery state. Then inject an error *inside the same database transaction* at each critical write boundary. Safe techniques are a staging/isolated database copy or transaction-scoped test triggers owned by a privileged test role; production HTTP callers must never receive a failpoint parameter.

For every forced failure, assert byte/JSON-equivalent equality of the pre/post snapshot for all mutable objects. For the success path assert exactly one state-version increment, exactly one authorization consumption, exactly one audit event, and the expected traffic/routing mutation.

## Exit criteria

This roadmap item may be marked **DONE** only when both are true:

- CI model contract is PASS; and
- live database failpoint evidence is captured for START, ADVANCE and ROLLBACK on the correct Stock Hunter database.

Until then, the correct project status is **PARTIAL — live proof pending**, not PASS.
