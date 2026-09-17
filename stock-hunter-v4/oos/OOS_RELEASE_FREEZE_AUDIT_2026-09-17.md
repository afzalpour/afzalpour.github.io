# Stock Hunter 4.1.6 One-Time OOS Release Freeze Audit

AUDIT_DATE: 2026-09-17
STATUS: REPO_HARDENING_READY_LIVE_APPLY_PENDING
TARGET_PROJECT: summnepwuziwulzvpcms
PROTOCOL: 4.1.6-oos-release-v1

## Why this hardening is required

The pre-existing release protocol already had important controls: manual/private release, a singleton manifest, immutable manifest/results, robustness readiness, irreversible `oos_unlocked`, candidate/robustness snapshots, and an audit fingerprint.

However, the live Calibration dataset split was still calculated dynamically from the full set of mature trade dates using 60% Train / 20% Validation / 20% OOS. If new mature dates were allowed to continue changing that split after the one-time OOS release, a date that had already been exposed as OOS could later migrate into Validation or Train. That would violate the one-time holdout contract even though the original manifest itself remained immutable.

## Proposed release-time freeze

`oos-release-freeze-v416.sql` adds `stock_hunter_oos_release_dataset_v416`, a full immutable snapshot of the exact mature dataset used by the release.

The controlled release transaction is designed to perform this sequence atomically:

1. Lock `stock_hunter_candidate_eval_control_v416`.
2. Reject an existing manifest and require `can_unlock_oos=true`.
3. Compute the live dataset counts and full-row JSONB fingerprint while the dataset is still live.
4. Freeze exactly two non-baseline selected challengers, two frozen baselines, both robustness records, and the control snapshot.
5. Set the private release transaction context.
6. Insert the singleton release manifest.
7. Copy the exact candidate-search dataset into `stock_hunter_oos_release_dataset_v416`.
8. Verify frozen row count and fingerprint against the manifest before continuing.
9. Write exactly four OOS result rows: candidate + baseline for Reversal and Acceleration.
10. Irreversibly set `oos_unlocked=true`.

Any exception rolls the entire transaction back, including the manifest, frozen dataset rows, OOS results, and unlock state.

## Atomic dataset switch

`stock_hunter_calibration_dataset_v416` keeps its current prospective-data logic before release.

After the frozen snapshot contains rows, the same view returns only the immutable snapshot rows and their already-frozen `train` / `validation` / `oos` labels. New raw/shadow observations may continue to be collected for monitoring, but they no longer enter the v4.1.6 Candidate search dataset.

The switch deliberately depends only on `exists(select 1 from stock_hunter_oos_release_dataset_v416)`.

This is important for two reasons:

- It avoids a circular view dependency through Calibration -> Candidate -> Robustness -> OOS readiness -> Calibration.
- It is transactionally atomic: before the snapshot insert the live dataset is visible; after the insert the frozen dataset is visible; if the release transaction rolls back the snapshot becomes empty again and the live dataset remains active.

Therefore a date that was evaluated as OOS cannot later drift into Train or Validation.

## Frozen audit artifacts

The manifest is extended with:

- `dataset_fingerprint_protocol = md5-jsonb-v2`
- `dataset_snapshot_rows`
- `baseline_snapshot`

The existing `candidate_snapshot`, `robustness_snapshot`, control snapshot and OOS release results remain part of the release audit.

The fingerprint is computed over the complete Calibration row JSON for every released sample, ordered by `sample_id`. The exact same fingerprint is recomputed from the frozen snapshot (excluding only `release_id` and `frozen_at`) before the transaction can unlock OOS.

## Immutability and authorization

The frozen dataset has RLS enabled and is read-only to Data API / service roles. Insert is accepted only while the private release transaction context is active. UPDATE, DELETE and TRUNCATE are rejected by the immutable OOS audit trigger.

The companion ACL migration also removes write privileges from `anon`, `authenticated`, `service_role` and `PUBLIC` on the manifest/results audit tables while preserving read access where needed.

`private.release_stock_hunter_oos_v416(text,text)` remains `SECURITY DEFINER` but is explicitly not executable by `anon`, `authenticated` or `service_role`; it is a manual database-admin operation only.

Candidate definition tables for v4.1.6 are guarded against mutation after OOS is unlocked so the frozen challenger definitions cannot silently drift after release.

Automatic OOS release remains forbidden. The existing policy must keep:

- `oos_used_for_selection = false`
- `auto_promote = false`
- `auto_unlock_oos = false`
- `require_both_modes = true`

## Integrity surface

The migration adds service-role-only view `stock_hunter_oos_release_integrity_v416`.

Before release its expected state is:

`LOCKED_AWAITING_MATURITY`

After the single valid release, it only reports:

`FROZEN_PASS`

when all of these hold simultaneously:

- exactly one manifest,
- OOS unlocked,
- frozen row count equals manifest row count,
- frozen fingerprint equals manifest fingerprint,
- exactly four OOS result rows,
- exactly two candidate and two baseline result rows,
- exactly two hunt modes,
- two frozen challenger snapshots,
- two frozen baseline snapshots,
- two robustness snapshots.

Any inconsistency maps to an explicit `HOLD_*` state.

## Reusable verifier

`verify-oos-release-freeze-v416.sql` is state-aware and safe both before and after release. It checks RLS, triggers, release RPC privileges, read-only audit ACL, no OOS cron release path, policy invariants, Calibration freeze wiring, and either the clean pre-release state or exact post-release snapshot equivalence.

Expected result after the migration is applied and while real-data maturity is still pending:

`stock-hunter-oos-release-freeze-v416: PASS`

with integrity state `LOCKED_AWAITING_MATURITY`.

## Live apply status

The Supabase project metadata currently reports `ACTIVE_HEALTHY` on Postgres 17, but database-backed connector operations (`execute_sql`, migration listing, and Security Advisor) repeatedly terminate with connection timeout during this audit. Because this migration changes the one-time holdout contract and release path, it was not applied blindly while verification access was unavailable.

No OOS release was performed and no synthetic maturity data was created.

This roadmap item is therefore **repo-implemented but not live-closed** until the migration and ACL companion are applied to the Stock Hunter project, the reusable verifier passes against the live database, Security Advisor is rerun, and the current pre-release integrity state is confirmed as `LOCKED_AWAITING_MATURITY`.
