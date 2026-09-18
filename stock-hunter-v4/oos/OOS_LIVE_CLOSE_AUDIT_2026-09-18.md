# Stock Hunter 4.1.6 OOS Live Closure Audit

AUDIT_DATE: 2026-09-18
STATUS: LIVE_CONTRACT_PASS / REAL_OOS_RELEASE_MATURITY_PENDING
TARGET_PROJECT: summnepwuziwulzvpcms
PROTOCOL: 4.1.6-oos-release-v1
LIVE_MIGRATION: 20260918084050 stock_hunter_oos_release_live_close_20260918

## Closure

The previously repo-only one-time OOS freeze contract is now applied to the live Stock Hunter database.

No OOS release was performed.

Current live state:

- manifest rows = 0
- frozen dataset rows = 0
- OOS result rows = 0
- oos_unlocked = false
- integrity_state = LOCKED_AWAITING_MATURITY
- can_unlock_oos = false

## Frozen dataset contract

public.stock_hunter_oos_release_dataset_v416 is a 40-column snapshot-compatible copy of the live Calibration dataset plus release_id/frozen_at metadata.

The live Calibration view preserved its exact 40-column output contract and remains security_invoker=true.

Before release, Calibration still returns the live prospective mature dataset.

After the controlled release transaction inserts the frozen snapshot, the same Calibration view switches to the immutable snapshot. Future raw observations can continue, but Candidate search for v4.1.6 can no longer re-partition previously revealed OOS dates into Train or Validation.

## Release atomicity

private.release_stock_hunter_oos_v416(text,text) remains postgres/manual-only.

The controlled transaction requires can_unlock_oos=true and then atomically:

1. freezes exact live Calibration counts and full-row JSONB fingerprint;
2. freezes exactly two selected non-baseline challengers;
3. freezes exactly two baseline definitions;
4. freezes both robustness records;
5. inserts one immutable manifest;
6. copies the exact Calibration dataset into the immutable release dataset;
7. verifies row count and fingerprint;
8. writes exactly four OOS result rows;
9. irreversibly sets oos_unlocked=true.

Any failure rolls back the entire transaction.

## ACL / immutability

anon, authenticated, and service_role have no INSERT/UPDATE/DELETE/TRUNCATE privilege on:

- frozen release dataset;
- OOS release manifest;
- OOS release results.

The release function is not executable by those roles.

The integrity view is service-role-only.

Manifest/results remain immutable. Frozen dataset UPDATE/DELETE/TRUNCATE is rejected, and INSERT is accepted only inside the controlled release context.

Candidate library and candidate weights receive post-OOS freeze triggers so selected definitions cannot drift after unlock.

## Negative controls and regressions

Before and after live hardening, calling the release function while can_unlock_oos=false was rejected with:

OOS robustness gate is not ready

Both probes left zero manifest/dataset/results rows and left oos_unlocked=false.

Reusable verifier:

stock-hunter-oos-live-close-v416: PASS

Legacy freeze verifier:

stock-hunter-oos-release-freeze-v416: PASS

Rolling prospective maturity regression:

stock-hunter-rolling-maturity-watch-v416: PASS

## Security

Supabase Security Advisor reported no new WARN/ERROR after the migration.

The only remaining INFO is the existing rls_enabled_no_policy notice on private.stock_hunter_canary_expansion_authorizations_v417. It remains a private/API-denied object and was not changed.

## Completion semantics

Roadmap item #8 is now live-closed structurally.

The actual one-time OOS release remains intentionally pending natural maturity and robustness:

- Calibration must mature;
- both non-baseline selected modes must exist;
- both must pass robustness;
- can_unlock_oos must become true;
- a manual postgres release note must be supplied.

Nothing in this migration auto-unlocks OOS or advances Promotion, Activation Review, Canary traffic, or final pinning.
