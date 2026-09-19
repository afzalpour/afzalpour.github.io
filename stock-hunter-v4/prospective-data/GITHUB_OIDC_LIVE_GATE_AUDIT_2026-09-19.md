# GitHub OIDC → Supabase Read-Only Live Gate — 2026-09-19

Status: DEPLOYED V2 / FIRST-DAY LIVE PASS / FIRST-MATURITY PENDING.

Purpose:
Provide a secure independent path for canonical live SQL verification when the interactive Supabase SQL connector is unavailable.

Trust boundary:
- GitHub Actions requests a short-lived OIDC token.
- Edge Function validates GitHub issuer + custom audience.
- It additionally requires:
  - exact repository name;
  - immutable repository id;
  - repository owner id;
  - ref = main;
  - exact workflow_ref;
  - event = push or workflow_dispatch.
- No Supabase DB password, service-role key, access token, or management token is stored in GitHub.
- The function uses Supabase-provided `SUPABASE_DB_URL` only inside the Edge runtime.
- The SQL runs in `SET TRANSACTION READ ONLY` with a statement timeout.
- v1 accepted only `first-day-eod-v416`.
- v2 preserves that purpose and adds `first-maturity-horizon-v416`.
- each purpose is bound to its own exact workflow_ref and allowed event set.
- the maturity purpose is hard-blocked before `2026-09-22T14:55:00Z` with `horizon_not_reached`.
- embedded SQL is taken from the canonical repository verifiers at deployment time:
  - `verify-first-day-eod-quality-v416.sql`
  - `verify-first-maturity-horizon-v416.sql`.

This bridge is a verifier, not a lifecycle transition mechanism. It must not be used to unlock OOS, create promotions, change routing, or mutate capture state.


## First live execution

- main commit: `5843b478ae9af3d583d5529a07cf966d89cfc348`;
- workflow run: `35465143770`;
- OIDC request: PASS;
- canonical first-day EOD verifier: PASS;
- safety contract: PASS.

The interactive Supabase SQL connector outage was therefore bypassed without storing a Supabase database/admin credential in GitHub and without weakening the verifier to a static contract.


## v2 regression evidence

- bridge version: 2;
- original First-Day EOD workflow re-run `35465143770`, job `105974476473`: PASS;
- missing OIDC token: 401;
- invalid OIDC token: 401;
- maturity workflow remains pending until the real horizon.

The bridge remains a read-only verifier only. It still cannot mutate lifecycle state or authorize promotion/routing.
