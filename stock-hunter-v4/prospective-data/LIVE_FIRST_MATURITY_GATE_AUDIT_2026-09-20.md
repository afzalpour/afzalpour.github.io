# Stock Hunter — Live First Maturity Horizon Gate

DATE: 2026-09-20
STATUS: DEPLOYED_V2 / BACKWARD_COMPAT_PASS / HORIZON_NOT_REACHED

Purpose:
Prepare the first real three-future-session maturity verifier before the 2026-09-22 horizon without creating any synthetic maturity data or advancing lifecycle state.

## Deadline

- first cohort: 2026-09-19
- required future sessions: 2026-09-20, 2026-09-21, 2026-09-22
- live eligibility deadline: 2026-09-22T14:55:00Z
- Tehran: 2026-09-22 18:25

The live bridge returns `horizon_not_reached` before this deadline. A pre-horizon structural PASS from the SQL file is never surfaced as a live horizon PASS.

## Trust boundary

The existing GitHub OIDC → Supabase read-only bridge is extended with a second purpose:
`first-maturity-horizon-v416`

Purpose is bound to the exact workflow ref:
`.github/workflows/stock-hunter-live-first-maturity-horizon.yml@refs/heads/main`

Allowed events for this purpose:
- schedule
- workflow_dispatch

The first-day EOD purpose remains bound to its original exact workflow and allowed events.

## Database safety

Every verifier execution:
- uses the Edge-only `SUPABASE_DB_URL`;
- opens a transaction;
- executes `SET TRANSACTION READ ONLY`;
- sets a 45-second statement timeout;
- runs the canonical repository verifier;
- performs no lifecycle mutation.

## Schedule

The workflow has a one-shot operational schedule at 15:05 UTC on 22 September, with an explicit date guard so later annual cron recurrences are skipped.

The schedule is ten minutes after the canonical 14:55 UTC horizon deadline to allow close/outcome cron completion.

## Expected result

A successful run proves the first-cohort Calibration row count matches independently mature eligible Shadow outcomes, all required future-session observations exist, downstream 3-day cron coverage is complete, and no downstream lifecycle gate advanced prematurely.

It does not authorize OOS, Promotion, Canary, or routing changes.

Current status remains pending until the real deadline and run.


## Deployment / regression closure — 2026-09-20

Edge Function:
- `stock-hunter-ci-live-check-v417`
- deployed version: 2
- verify_jwt: false by design; in-function GitHub OIDC verification remains mandatory
- deployment hash: `6716d469eb2d0ede5754bdfff06ba55f0116d251a7974aeb00848f66522d9044`

Backward compatibility:
- original First-Day EOD workflow run `35465143770` was re-run against bridge v2;
- re-run job `105974476473`: PASS;
- GitHub OIDC acquisition: PASS;
- canonical first-day EOD verifier through READ ONLY bridge: PASS;
- safety-contract verification: PASS.

Negative authorization:
- missing OIDC token -> HTTP 401 / `missing_oidc_token`;
- invalid OIDC token -> HTTP 401 / `oidc_verification_failed`.

The maturity purpose is still time-ineligible. No claim of first maturity PASS is made before `2026-09-22T14:55:00Z`.
