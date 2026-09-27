# Stock Hunter 4.1.7 — Control Plane Crash / Partial-Failure Drill

Status: **MODEL CONTRACT PASS / LIVE_DB_PROOF: PASS**

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

## Live PostgreSQL drill — completed 2026-09-19

The live proof was executed on the actual Stock Hunter Supabase project against the real private transition functions identified from `pg_proc`:

- `private.start_stock_hunter_canary_v417`
- `private.advance_stock_hunter_canary_v417`
- `private.rollback_stock_hunter_canary_v417`

The atomicity drill used transaction-scoped synthetic review/authorization state plus transaction-scoped failpoint triggers. Every outer drill transaction ended in `ROLLBACK`, so no synthetic activation state became durable.

### START
PASS:
- stale `state_version` rejects before writes;
- forced failure after activation/recovery status mutation leaves status, recovery, consumption and audit unchanged;
- forced failure after authorization consumption leaves all visible state unchanged;
- forced failure after audit insert leaves all visible state unchanged;
- success path produced CANARY 5%, exactly one version increment, exactly one authorization consumption, one audit event and MONITORING recovery state; success case was then subtransaction-rolled-back.

### ADVANCE
PASS:
- stale `state_version` rejects before writes;
- forced failure after status/recovery mutation rolls back;
- forced failure after expansion authorization consumption rolls back;
- forced failure after audit insert rolls back;
- success path produced 5→10%, exactly one version increment, exactly one one-shot expansion authorization consumption, one audit event and synchronized recovery state; success case was then subtransaction-rolled-back.

### ROLLBACK
PASS:
- stale `state_version` rejects before writes;
- forced failure after status + recovery-retirement mutation rolls back;
- forced failure after audit insert rolls back;
- success path produced CANARY→ROLLED_BACK, traffic 0%, kill switch ON, exactly one version increment, one audit event and `REVIEW_RETIRED` recovery metadata; success case was then subtransaction-rolled-back.

### Real contention drill
A separate isolated drill schema in the same production PostgreSQL instance used the same common advisory lock key `pg_advisory_xact_lock(417,1)` and the same state-version/one-shot write pattern. Two independent PostgreSQL connections were forced into real lock contention.

All five races PASS:
- START vs START: one winner; loser `STALE_STATE_VERSION`; losing authorization unconsumed.
- ADVANCE vs ADVANCE: one winner; loser `STALE_STATE_VERSION`; losing authorization unconsumed.
- ROLLBACK vs ROLLBACK: one winner; loser `STALE_STATE_VERSION`.
- ADVANCE vs ROLLBACK: ADVANCE winner; ROLLBACK clean stale-version failure.
- ROLLBACK vs ADVANCE: ROLLBACK winner; losing ADVANCE authorization remained unconsumed.

The isolated race schema and Vault token were deleted after the proof. The race Edge Function was resealed with `verify_jwt=true` and returns 410.

## Exit criteria

This roadmap item may be marked **DONE** only when both are true:

- CI model contract is PASS; and
- live database failpoint evidence is captured for START, ADVANCE and ROLLBACK on the correct Stock Hunter database.

Both exit criteria are now satisfied. The correct project status is **DONE — model + live PostgreSQL proof PASS**.
