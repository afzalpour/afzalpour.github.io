# Stock Hunter — Foreign-Key Covering Index Audit

DATE: 2026-09-20
STATUS: PREPARED / LIVE_APPLY_PENDING

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
