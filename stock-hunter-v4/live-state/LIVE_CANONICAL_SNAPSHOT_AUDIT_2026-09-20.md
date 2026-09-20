# Stock Hunter — Canonical Live Snapshot Audit

DATE: 2026-09-20
STATUS: LIVE_EXECUTION_PASS

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

Repository/runtime closure completed after the intermittent Supabase data-plane incident recovered.

Final deployed bridge under test:
- Edge Function: `stock-hunter-ci-live-check-v417`
- deployment version: 14
- SHA-256: `5b90c51a783f6d733ef361e4fdf035b4da235bd791e48d69ff08f1c4900e43d6`
- `verify_jwt=false` remains intentional because the function enforces exact GitHub OIDC claims in code before database access.

Final regression:
- canonical workflow run: `35465143770`
- attempt: 12
- job: `106146921421`
- mandatory First-Day EOD verifier: PASS
- OIDC safety contract: PASS
- snapshot transaction: `READ ONLY`
- `snapshot_error`: null

Snapshot query was intentionally simplified during hardening:
- it uses base signal/status/count tables rather than heavyweight Calibration/Maturity/OOS computation views;
- it reports operational evidence only;
- it does not compute or substitute any lifecycle readiness decision;
- stale pg_cron bookkeeping rows are excluded from the current in-flight count while historical rows are preserved.

Observed sanitized state in the final regression:
- feed rows: 1935;
- fresh 180-second feed rows: 0;
- local Agent heartbeat still at 2026-09-19 16:26:36 UTC;
- shadow samples: 12;
- calibration dataset rows: 0;
- routing: CHAMPION_ONLY / 0% challenger / kill switch ON / state_version 1;
- active v417 cron callers: 0;
- OOS manifests/results, promotions, activation reviews and release pins: all 0;
- latest completed Stock Hunter cron jobs: succeeded;
- current in-flight Stock Hunter cron runs: 0 at snapshot time.

The snapshot is therefore usable as a sanitized operational observation channel without becoming a lifecycle authority.
