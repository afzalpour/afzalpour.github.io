# Stock Hunter — Foreign-Key Covering Index Audit

DATE: 2026-09-20
STATUS: LIVE_APPLY_PASS

## Scope

Performance-only hardening for four existing foreign keys reported by Supabase Performance Advisor.

Indexes:
- activation authorization consumptions by `review_id`;
- release-pin manifests by `component_attestation_id`;
- release-pin manifests by `proposal_id`;
- release-pin manifests by `activation_review_id`.

## Safety

This change creates indexes only. It does not update application rows, change RLS/ACLs, invoke lifecycle functions, alter routing, modify scoring, or authorize any 4.1.7 traffic.

4.1.6 remains the frozen Champion and 4.1.7 remains fail-closed.


## Live closure

Applied migration:
- `stock_hunter_performance_fk_indexes_20260920` — PASS.

Post-DDL Supabase Performance Advisor:
- `unindexed_foreign_keys` finding count: **0**;
- only `unused_index` INFO findings remain.

The four new indexes are expected to be initially unused because their lifecycle tables are fail-closed/pre-activation. They are retained to cover referential actions and future lifecycle lookups; they are not candidates for immediate deletion based solely on zero usage statistics.

No runtime/lifecycle state was changed by this migration.
