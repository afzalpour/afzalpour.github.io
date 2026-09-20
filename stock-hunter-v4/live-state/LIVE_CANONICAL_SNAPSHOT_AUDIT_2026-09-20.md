# Stock Hunter — Canonical Live Snapshot Audit

DATE: 2026-09-20
STATUS: PREPARED / LIVE_EXECUTION_PENDING

## Purpose
Provide a current, sanitized, read-only operational snapshot when the interactive Supabase SQL connector is unavailable or times out.

No separate privileged workflow is introduced. The snapshot is attached to the responses of the existing exact-bound GitHub OIDC live-gate bridge after the original verifier SQL succeeds.

## Security model
- Existing GitHub OIDC issuer/audience/repository/repository-id/owner-id/ref/workflow_ref/event validation remains unchanged.
- GitHub receives no Supabase database/admin credential.
- Database work remains inside `SET TRANSACTION READ ONLY`.
- The original First-Day EOD and First-Maturity verifier SQL runs first; snapshot collection cannot replace or bypass it.
- Snapshot Auth data is aggregate-only: counts by account status/role and total rows.
- No email, user id, user metadata, access token, credential, Feed key or service-role value is selected.

## Snapshot scope
The JSON snapshot covers:
- Feed freshness, integrated-row count and Feed health;
- prospective collection/shadow/event counts;
- maturity and Calibration readiness;
- OOS unlock readiness and release counts;
- Routing/Activation status;
- capture/outcome controls and active v417 cron-caller count;
- aggregate Auth/profile/role/account-status counts;
- Promotion/Activation Review/release-pin counts;
- latest Stock Hunter cron job status/timestamp.

## Lifecycle rule
This snapshot is observational only. It cannot unlock OOS, create Promotion/Activation state, alter routing, or change 4.1.6.

4.1.6 remains the frozen production Champion unless the user explicitly authorizes a later canonical lifecycle decision.

## Live closure
Pending:
1. repository CI/type verification;
2. exact-source deployment of the upgraded read-only bridge;
3. regression re-run of the already-passed First-Day EOD workflow;
4. extraction and review of the live sanitized snapshot;
5. merge to main after all evidence is PASS.
