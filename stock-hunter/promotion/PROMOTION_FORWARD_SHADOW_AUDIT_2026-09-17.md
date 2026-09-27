# Stock Hunter 4.1.7 Promotion Proposal / Forward Shadow / Activation Review Audit

AUDIT_DATE: 2026-09-17
STATUS: REPO_IMPLEMENTED_GATED_ON_OOS_LIVE_APPLY
DEPENDENCY: stock-hunter-v4/oos/oos-release-freeze-v416.sql
CONTRACT: OOS_FROZEN_MANUAL_ONLY_PROSPECTIVE_PAIRED

## Current blocker

The Stock Hunter Supabase project still reports healthy project metadata, but all database-backed connector paths used in this audit (`execute_sql`, Security Advisor, and migration listing) time out. The OOS freeze migration from the prior roadmap step therefore remains repo-ready but not live-verified.

This step does **not** bypass that dependency. No Promotion Proposal, Forward Shadow sample, Activation Review, traffic change, or production activation was created during this work.

The repo implementation is deliberately fail-closed: it requires the one-time OOS integrity surface to exist, and all downstream writes remain blocked until `stock_hunter_oos_release_integrity_v416.integrity_state = 'FROZEN_PASS'`.

## Historical contract reused

The existing Stock Hunter rollout surfaces already define the prior Promotion / Forward Shadow / Activation Review protocol:

- `stock_hunter_promotion_policy_v416`
- `stock_hunter_promotion_readiness_v416`
- `stock_hunter_promotion_proposals_v416`
- `stock_hunter_rollout_policy_v417`
- `stock_hunter_rollout_readiness_v417`
- `stock_hunter_champion_challenger_metrics_v417`
- `stock_hunter_challenger_shadow_samples_v417`
- `stock_hunter_activation_review_readiness_v417`
- `stock_hunter_activation_reviews_v417`

The historical dashboard proves two structural Forward Shadow minimums:

- minimum fresh paired trade dates: **10**
- minimum Challenger selections per mode: **30**

The existing policy also contains the frozen coverage, utility lift, 3-day return lift, MAE deterioration, and positive-rate deterioration guards. This hardening migration does not invent replacement values for those fields; it preserves and consumes the live policy row as the source of truth.

Automatic Promotion and automatic Activation remain OFF.

## Promotion Proposal guard

`promotion-forward-shadow-gate-v417.sql` adds a `BEFORE INSERT` guard to the existing Promotion Proposal table.

A Proposal can only be inserted when all of the following hold:

1. OOS integrity is exactly `FROZEN_PASS`.
2. `release_id` equals the single frozen OOS release.
3. `dataset_fingerprint` equals the frozen OOS manifest fingerprint.
4. `target_engine_version` equals the existing Promotion policy target version.
5. `stock_hunter_promotion_readiness_v416.proposal_ready = true`.
6. exactly two modes are assessed and both pass the OOS Promotion gate.
7. no Proposal already exists for the same OOS release and target version.

The database overwrites Proposal `created_at` with the actual insert time, preventing a caller from back-dating the start of Forward Shadow.

This step creates a proposal only as a frozen audit/progression artifact. It does not modify runtime routing or production traffic.

## Forward Shadow guard

Each `stock_hunter_challenger_shadow_samples_v417` row is treated as one paired Champion/Challenger observation keyed by:

`proposal_id + trade_date + symbol_id + bucket_minute + hunt_mode`

A unique index enforces one row per pair key.

Each new row must:

- bind to an existing Promotion Proposal,
- be observed strictly after the Proposal creation time,
- use `reversal` or `acceleration`,
- have `trade_date` equal to the Tehran calendar date of `observed_at`,
- arrive no earlier than two minutes before the observation timestamp and no later than ten minutes after it,
- be created only while OOS integrity remains `FROZEN_PASS`.

This makes Forward Shadow prospective-only and prevents historical backfill from satisfying readiness.

Raw prospective monitoring may continue, but only properly bound paired rows are eligible for the existing Forward Shadow metrics/readiness contract.

## Activation Review guard

Activation Review remains an audit/review step, not a deployment action.

A Review can only be inserted when:

1. OOS integrity remains `FROZEN_PASS`.
2. its Promotion Proposal exists.
3. the existing `stock_hunter_activation_review_readiness_v417` says `can_record_review = true` for that exact Proposal.
4. no previous Review exists for that Proposal.
5. `production_activated` is false.

A unique index enforces one Review per Proposal.

The guard rejects any Review row that attempts to set `production_activated=true`. Passing Forward Shadow therefore cannot change traffic or activate 4.1.7.

## Automatic-action lock

The policy tables receive a manual-only trigger. Any attempt to turn on:

- `auto_promote`, or
- `auto_activate`

is rejected.

The reusable verifier also fails if an active cron command references Promotion Proposal writes, Activation Review writes, `production_activated`, or challenger traffic mutation.

## Unified lifecycle state

The migration adds read-only view:

`stock_hunter_promotion_forward_shadow_gate_v417`

Possible states are:

- `BLOCKED_OOS_NOT_FROZEN`
- `BLOCKED_PROMOTION_ASSESSMENT`
- `READY_FOR_MANUAL_PROPOSAL`
- `HOLD_PROPOSAL_BINDING`
- `COLLECTING_FORWARD_SHADOW`
- `HOLD_ACTIVATION_REVIEW_GATE`
- `READY_FOR_MANUAL_ACTIVATION_REVIEW`
- `REVIEW_RECORDED_NO_ACTIVATION`
- `HOLD_UNEXPECTED_PRODUCTION_ACTIVATION`

Until the prior OOS freeze is live and reports `FROZEN_PASS`, the only acceptable state is `BLOCKED_OOS_NOT_FROZEN` and there must be zero downstream artifacts.

## Reusable verification

`verify-promotion-forward-shadow-v417.sql` checks:

- Promotion/Forward policy automation remains OFF.
- 10 fresh trade dates and 30 per-mode selected samples remain the structural Forward Shadow minimums.
- every Proposal is tied to the exact frozen OOS release and fingerprint.
- Forward Shadow rows are prospective, Tehran-date consistent, capture-lag bounded, and unique by pair key.
- Activation Reviews are tied to a Proposal and never activate production.
- no duplicate Review per Proposal.
- no active cron path automates Proposal/Review/traffic mutation.
- no privileged Proposal/Review mutator is executable by `anon` or `authenticated`.
- before `FROZEN_PASS`, the lifecycle fails closed and no downstream artifact exists.

Expected result after both the prior OOS freeze and this migration are live-applied:

`stock-hunter-promotion-forward-shadow-v417: PASS`

## Completion semantics

This roadmap step is **repo-implemented but intentionally inactive**. It is not live PASS while the database management connection is unavailable and the preceding OOS freeze migration has not been applied and verified.

Correct sequence when database access returns:

1. Apply OOS freeze + ACL migration.
2. Run OOS freeze verifier and Security Advisor.
3. Confirm pre-release integrity is `LOCKED_AWAITING_MATURITY` (or, after real maturity and manual release, `FROZEN_PASS`).
4. Apply this Promotion/Forward Shadow guard migration.
5. Run this verifier and Security Advisor.
6. Do not create a Promotion Proposal until real OOS release is `FROZEN_PASS` and existing Promotion OOS assessment passes both modes.
7. Collect Forward Shadow prospectively; do not backfill historical pairs.
8. Record an Activation Review only after real Forward Shadow maturity; Review remains non-activating.
