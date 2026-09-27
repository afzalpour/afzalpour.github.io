# Stock Hunter 4.1.7 — Live Control-Plane Proof

DATE: 2026-09-19
STATUS: PASS
SCOPE: atomicity + real contention
PRODUCTION_MUTATION_PERSISTED: NO

## Production transition functions tested

- private.start_stock_hunter_canary_v417
- private.advance_stock_hunter_canary_v417
- private.rollback_stock_hunter_canary_v417

The function definitions were discovered from pg_catalog on the actual Stock Hunter project before testing.

## Atomicity method

Synthetic review/authorization state was created only inside explicit outer PostgreSQL transactions. Setup used transaction-local trigger suppression only to construct otherwise-impossible pre-maturity test fixtures. Before invoking the real transition function, normal trigger behavior was restored.

Failpoints were transaction-scoped AFTER triggers. Every drill finished with outer ROLLBACK. Successful transition paths were asserted inside a PL/pgSQL exception subtransaction and deliberately rolled back after the assertions.

### START PASS
- stale state_version clean failure
- fail after status + recovery synchronization: complete rollback
- fail after one-shot authorization consumption: complete rollback
- fail after audit insert: complete rollback
- success path: 0→5, version +1, exactly one consumption, exactly one audit event, recovery MONITORING

### ADVANCE PASS
- stale state_version clean failure
- fail after status + recovery synchronization: complete rollback
- fail after expansion authorization consumption: complete rollback
- fail after audit insert: complete rollback
- success path: 5→10, version +1, exactly one expansion authorization consumption, exactly one audit event

### ROLLBACK PASS
- stale state_version clean failure
- fail after status + recovery retirement sync: complete rollback
- fail after audit insert: complete rollback
- success path: active CANARY→ROLLED_BACK, 0% traffic, kill switch ON, version +1, recovery REVIEW_RETIRED

## Real concurrency proof

Supabase Branching was unavailable on the current plan, so the race proof used a temporary non-exposed drill schema in the same production PostgreSQL instance. No production control-plane tables were used by the race fixture.

The race transition uses the same common serialization key as production:
`pg_advisory_xact_lock(417,1)`

Two independent PostgreSQL connections were forced to overlap. The left contender acquired the common advisory transaction lock and held it briefly so the right contender blocked. After the winner committed, the loser acquired the lock and failed on stale state_version.

Protocol: `control-plane-real-contention-v1`

PASS races:
1. START vs START → one winner, final 5%, version 101, loser stale, loser authorization unconsumed.
2. ADVANCE vs ADVANCE → one winner, final 10%, version 201, loser stale, loser authorization unconsumed.
3. ROLLBACK vs ROLLBACK → one winner, final 0%/ROLLED_BACK, version 301, loser stale.
4. ADVANCE vs ROLLBACK → ADVANCE winner, final 50%, version 401, rollback stale.
5. ROLLBACK vs ADVANCE → ROLLBACK winner, final 0%/ROLLED_BACK, version 501, losing ADVANCE authorization unconsumed.

## Cleanup proof

After the test:
- temporary race schema: deleted
- one-time Vault race token: deleted
- transaction-scoped failpoint triggers: 0 remaining
- race Edge Function: resealed, verify_jwt=true, HTTP behavior 410/selftest sealed
- production_state_after_cleanup: CHAMPION_ONLY / 0% / kill-switch ON / state_version=1
- production activation_review_id: null
- production authorization_id: null
- production recovery state: IDLE / state_version=1

## Interpretation

The control-plane atomicity item is closed. The live tests prove that the real transition functions do not leak partial persistent state under injected failures at their actual write boundaries, and the real Postgres contention drill proves common advisory-lock + state_version gives one winner and a clean stale loser.

This proof does not authorize activation. Calibration, OOS, promotion, forward-shadow and activation-review gates remain independent and closed until their evidence matures.
