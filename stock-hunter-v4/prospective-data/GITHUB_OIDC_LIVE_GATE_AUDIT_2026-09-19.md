# GitHub OIDC → Supabase Read-Only Live Gate — 2026-09-19

Status: DEPLOYED / first main workflow run pending.

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
- The only accepted purpose in v1 is `first-day-eod-v416`.
- The embedded SQL is the canonical `verify-first-day-eod-quality-v416.sql` from main at deployment time.

This bridge is a verifier, not a lifecycle transition mechanism. It must not be used to unlock OOS, create promotions, change routing, or mutate capture state.
